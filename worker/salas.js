import { seudonimoValido } from "../public/assets/js/seudonimos.js";
import { codigoAleatorio, tokenAleatorio } from "./seguridad.js";

const CUENTA_REGRESIVA_MS = 5000;
const MAX_JUGADORES = 200;
const VIDA_ESPERA_MS = 3 * 60 * 60 * 1000; // Una sala abandonada en espera deja de aceptar jugadores.
const TOP_PUBLICO = 5;

// El límite vencido no reescribe la fila: el estado real se calcula al leerla.
const estadoReal = (sala, ahora = Date.now()) =>
  sala.estado === "jugando" && ahora >= sala.limite ? "terminada" : sala.estado;

export async function salaEnCurso(env, salaId) {
  if (!salaId) return false;
  const sala = await env.DB.prepare("SELECT estado, limite FROM salas WHERE id = ?").bind(salaId).first();
  return Boolean(sala) && estadoReal(sala) !== "terminada";
}

async function tablaDeSala(env, sala, jugador = "") {
  const terminada = estadoReal(sala) === "terminada";
  const { results } = await env.DB.prepare(
    `SELECT j.seudonimo, j.jugador = ?1 AS soyYo, COALESCE(i.aciertos, 0) AS aciertos, COALESCE(i.errores, 0) AS errores,
            i.fin, i.inicio, i.limite
     FROM sala_jugadores j
     LEFT JOIN intentos i ON i.sala_id = j.sala_id AND i.jugador = j.jugador
     WHERE j.sala_id = ?2
     ORDER BY aciertos DESC, errores ASC, COALESCE(i.fin, i.limite, 9e15) ASC, j.unido ASC`
  ).bind(jugador, sala.id).all();
  return results.map((fila, indice) => ({
    posicion: indice + 1,
    seudonimo: fila.seudonimo,
    aciertos: fila.aciertos,
    errores: fila.errores,
    duracionMs: fila.inicio === null ? 0 : (fila.fin ?? (terminada ? fila.limite : Date.now())) - fila.inicio,
    termino: fila.fin !== null,
    soyYo: Boolean(fila.soyYo)
  }));
}

function resumenSala(sala) {
  const ahora = Date.now();
  const estado = estadoReal(sala, ahora);
  return {
    pin: sala.pin,
    titulo: sala.titulo,
    materia: sala.materia,
    letras: JSON.parse(sala.entradas).length,
    segundos: sala.segundos,
    estado,
    comienzaEnMs: estado === "jugando" ? Math.max(0, sala.inicio - ahora) : 0,
    restanteMs: estado === "jugando" ? sala.limite - Math.max(ahora, sala.inicio) : 0
  };
}

export async function manejarSalas({ request, env, ruta, metodo, ErrorApi, leerCuerpo, limitar, json, ipDe, exigirUsuario, payloadPartida, parseIntento }) {
  const jugadorDel = (valor) => {
    if (typeof valor !== "string" || !/^[0-9a-f-]{36}$/.test(valor)) throw new ErrorApi(400, "Jugador no válido.");
    return valor;
  };

  const salaPropia = async (id, usuario) => {
    const sala = await env.DB.prepare("SELECT * FROM salas WHERE id = ? AND usuario_id = ?").bind(id, usuario.id).first();
    if (!sala) throw new ErrorApi(404, "No encontramos esa sala.");
    return sala;
  };

  const salaPorPin = async (pin) => {
    const sala = await env.DB.prepare("SELECT * FROM salas WHERE pin = ?").bind(pin.toUpperCase()).first();
    if (!sala || (sala.estado === "espera" && Date.now() - sala.creada > VIDA_ESPERA_MS)) {
      throw new ErrorApi(404, "No hay ninguna sala con ese código.");
    }
    return sala;
  };

  const vistaAnfitrion = async (sala) => json({ id: sala.id, roscoId: sala.rosco_id, ...resumenSala(sala), jugadores: await tablaDeSala(env, sala) });

  // --- Quien abre la sala

  if (ruta === "/salas" && metodo === "POST") {
    const usuario = await exigirUsuario(request, env);
    await limitar(env, `sala:${usuario.id}`, 60, 3600);
    const { roscoId } = await leerCuerpo(request);
    if (typeof roscoId !== "string" || !/^[0-9a-f-]{36}$/.test(roscoId)) throw new ErrorApi(422, "Elegí un rosco.");
    const rosco = await env.DB.prepare("SELECT * FROM roscos WHERE id = ? AND usuario_id = ?").bind(roscoId, usuario.id).first();
    if (!rosco) throw new ErrorApi(404, "No encontramos ese rosco.");

    // Recargar la página de la sala no debe abrir otra con un código distinto.
    const abierta = await env.DB.prepare("SELECT id, pin, creada FROM salas WHERE rosco_id = ? AND estado = 'espera' ORDER BY creada DESC LIMIT 1").bind(rosco.id).first();
    if (abierta && Date.now() - abierta.creada < VIDA_ESPERA_MS) return json({ id: abierta.id, pin: abierta.pin }, 200);

    const id = crypto.randomUUID();
    for (let intento = 0; intento < 5; intento += 1) {
      const pin = codigoAleatorio(6);
      // Salas y roscos comparten el mismo campo de ingreso, así que el código no puede repetirse entre ambos.
      if (await env.DB.prepare("SELECT 1 FROM roscos WHERE codigo = ?").bind(pin).first()) continue;
      try {
        await env.DB.prepare(
          "INSERT INTO salas (id, pin, rosco_id, usuario_id, titulo, materia, segundos, entradas, creada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, pin, rosco.id, usuario.id, rosco.titulo, rosco.materia, rosco.segundos, rosco.entradas, Date.now()).run();
        return json({ id, pin }, 201);
      } catch (error) {
        if (!String(error).includes("UNIQUE")) throw error;
      }
    }
    throw new ErrorApi(503, "No pudimos generar el código. Probá otra vez.");
  }

  let m = ruta.match(/^\/salas\/([0-9a-f-]{36})$/);
  if (m && metodo === "GET") {
    const usuario = await exigirUsuario(request, env);
    return vistaAnfitrion(await salaPropia(m[1], usuario));
  }

  m = ruta.match(/^\/salas\/([0-9a-f-]{36})\/empezar$/);
  if (m && metodo === "POST") {
    const usuario = await exigirUsuario(request, env);
    const sala = await salaPropia(m[1], usuario);
    if (sala.estado !== "espera") throw new ErrorApi(409, "La sala ya empezó.");
    const { cuenta } = await env.DB.prepare("SELECT COUNT(*) AS cuenta FROM sala_jugadores WHERE sala_id = ?").bind(sala.id).first();
    if (!cuenta) throw new ErrorApi(409, "Esperá a que entre al menos una persona.");
    const inicio = Date.now() + CUENTA_REGRESIVA_MS;
    const cambio = await env.DB.prepare("UPDATE salas SET estado = 'jugando', inicio = ?, limite = ? WHERE id = ? AND estado = 'espera'")
      .bind(inicio, inicio + sala.segundos * 1000, sala.id).run();
    if (cambio.meta.changes !== 1) throw new ErrorApi(409, "La sala ya empezó.");
    return vistaAnfitrion(await salaPropia(sala.id, usuario));
  }

  m = ruta.match(/^\/salas\/([0-9a-f-]{36})\/terminar$/);
  if (m && metodo === "POST") {
    const usuario = await exigirUsuario(request, env);
    const sala = await salaPropia(m[1], usuario);
    if (estadoReal(sala) === "terminada") return vistaAnfitrion(sala);
    const ahora = Date.now();
    const limite = Math.max(ahora, sala.inicio ?? ahora);
    await env.DB.batch([
      env.DB.prepare("UPDATE salas SET estado = 'terminada', inicio = COALESCE(inicio, ?), limite = ? WHERE id = ?").bind(ahora, limite, sala.id),
      env.DB.prepare("UPDATE intentos SET limite = ?, fin = COALESCE(fin, ?) WHERE sala_id = ?").bind(limite, limite, sala.id)
    ]);
    return vistaAnfitrion(await salaPropia(sala.id, usuario));
  }

  // --- Quien juega: no necesita cuenta

  m = ruta.match(/^\/sala\/([A-Za-z0-9]{6})$/);
  if (m && metodo === "GET") {
    const sala = await salaPorPin(m[1]);
    const jugador = request.headers.get("x-jugador") ?? "";
    const yo = await env.DB.prepare("SELECT seudonimo FROM sala_jugadores WHERE sala_id = ? AND jugador = ?").bind(sala.id, jugador).first();
    const tabla = await tablaDeSala(env, sala, jugador);
    return json({
      ...resumenSala(sala),
      seudonimo: yo?.seudonimo ?? null,
      jugadores: tabla.length,
      tabla: tabla.filter((fila, indice) => indice < TOP_PUBLICO || fila.soyYo)
    });
  }

  m = ruta.match(/^\/sala\/([A-Za-z0-9]{6})\/unirme$/);
  if (m && metodo === "POST") {
    await limitar(env, `sala-ip:${ipDe(request)}`, 600, 600);
    const { jugador: crudo, seudonimo } = await leerCuerpo(request);
    const jugador = jugadorDel(crudo);
    if (!seudonimoValido(seudonimo)) throw new ErrorApi(400, "Elegí un seudónimo de la lista.");
    const sala = await salaPorPin(m[1]);
    const existente = await env.DB.prepare("SELECT seudonimo FROM sala_jugadores WHERE sala_id = ? AND jugador = ?").bind(sala.id, jugador).first();
    if (existente) return json({ seudonimo: existente.seudonimo });
    if (estadoReal(sala) === "terminada") throw new ErrorApi(409, "Esta sala ya terminó.");
    const { cuenta } = await env.DB.prepare("SELECT COUNT(*) AS cuenta FROM sala_jugadores WHERE sala_id = ?").bind(sala.id).first();
    if (cuenta >= MAX_JUGADORES) throw new ErrorApi(409, "La sala está completa.");
    try {
      await env.DB.prepare("INSERT INTO sala_jugadores (sala_id, jugador, seudonimo, unido) VALUES (?, ?, ?, ?)")
        .bind(sala.id, jugador, seudonimo, Date.now()).run();
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new ErrorApi(409, "Ese seudónimo ya está en la sala. Elegí otro.");
      throw error;
    }
    return json({ seudonimo }, 201);
  }

  m = ruta.match(/^\/sala\/([A-Za-z0-9]{6})\/partida$/);
  if (m && metodo === "POST") {
    await limitar(env, `sala-ip:${ipDe(request)}`, 600, 600);
    const jugador = jugadorDel((await leerCuerpo(request)).jugador);
    const sala = await salaPorPin(m[1]);
    const yo = await env.DB.prepare("SELECT seudonimo FROM sala_jugadores WHERE sala_id = ? AND jugador = ?").bind(sala.id, jugador).first();
    if (!yo) throw new ErrorApi(403, "Primero tenés que entrar a la sala.");
    const estado = estadoReal(sala);
    // Las definiciones recién salen al llegar la hora de inicio, para que nadie arranque con ventaja.
    if (estado === "espera" || Date.now() < sala.inicio) throw new ErrorApi(409, "La sala todavía no empezó.", { todaviaNo: true });
    if (estado === "jugando") {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO intentos (id, rosco_id, jugador, seudonimo, entradas, inicio, limite, sala_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(tokenAleatorio(), sala.rosco_id, jugador, yo.seudonimo, sala.entradas, sala.inicio, sala.limite, sala.id).run();
    }
    const fila = await env.DB.prepare("SELECT * FROM intentos WHERE sala_id = ? AND jugador = ?").bind(sala.id, jugador).first();
    if (!fila) throw new ErrorApi(409, "Esta sala ya terminó.");
    return payloadPartida(parseIntento(fila));
  }

  throw new ErrorApi(404, "Ruta no encontrada.");
}
