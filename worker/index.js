import {manejarGenerador,prepararBorradoresDiarios} from './generador.js';
import {ErrorGenerador} from './gemini.js';
import { modoDeLetra, respuestaCorrecta, revisarRosco } from "../public/assets/js/reglas.js";
import { seudonimoValido } from "../public/assets/js/seudonimos.js";
import { SECRETO_FALSO, codigoAleatorio, hashearSecreto, sha256, tokenAleatorio, verificarSecreto } from "./seguridad.js";
import { manejarClases } from "./clases.js";
import { listarMaterias, presentacionMateria } from './materias.js';
import { manejarSalas, salaEnCurso } from "./salas.js";

import { avatarValido, actividadUsuario } from './perfil.js';

const DIA = 86400;
const DURACION_SESION = 30 * DIA;
const GRACIA_MS = 2000; // Compensa la latencia de la última respuesta.
const MAX_ROSCOS = 100;
const MAX_CUERPO = 64 * 1024;
const COOKIE = "rosco_sesion";

class ErrorApi extends Error {
  constructor(estado, mensaje, extra = {}) {
    super(mensaje);
    this.estado = estado;
    this.extra = extra;
  }
}

const json = (datos, estado = 200, encabezados = {}) => new Response(JSON.stringify(datos), {
  status: estado,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...encabezados }
});

async function leerCuerpo(request) {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new ErrorApi(415, "Formato no admitido.");
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) throw new ErrorApi(413, "El contenido es demasiado grande.");
  try {
    const datos = JSON.parse(texto || "{}");
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Cuerpo no válido');
    return datos;
  } catch {
    throw new ErrorApi(400, "No se pudo leer el pedido.");
  }
}

// Ventana fija por clave. El tope por IP es alto porque un curso entero suele salir por la misma IP.
async function limitar(env, clave, maximo, ventanaSeg) {
  const ahora = Math.floor(Date.now() / 1000);
  const hueco = Math.floor(ahora / ventanaSeg);
  const id = await sha256(`${clave}:${ventanaSeg}:${hueco}`);
  const fila = await env.DB.prepare(
    "INSERT INTO limites (clave, cuenta, vence) VALUES (?, 1, ?) ON CONFLICT(clave) DO UPDATE SET cuenta = cuenta + 1 RETURNING cuenta"
  ).bind(id, (hueco + 1) * ventanaSeg).first();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM limites WHERE vence < ?").bind(ahora).run();
  if (fila.cuenta > maximo) throw new ErrorApi(429, "Demasiados intentos. Esperá unos minutos.");
}

const ipDe = (request) => request.headers.get("cf-connecting-ip") ?? "local";

function cookieSesion(request, valor, maxAge) {
  const segura = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${segura}`;
}

async function usuarioActual(request, env) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(/;\s*/).find((par) => par.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id, u.alias, u.rol FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND s.vence > ?"
  ).bind(await sha256(token), Date.now()).first();
}

async function exigirUsuario(request, env) {
  const usuario = await usuarioActual(request, env);
  if (!usuario) throw new ErrorApi(401, "Iniciá sesión para continuar.");
  return usuario;
}

async function abrirSesion(request, env, usuarioId) {
  const token = tokenAleatorio();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sesiones WHERE usuario_id = ? AND vence < ?").bind(usuarioId, Date.now()),
    env.DB.prepare("INSERT INTO sesiones (token_hash, usuario_id, vence) VALUES (?, ?, ?)")
      .bind(await sha256(token), usuarioId, Date.now() + DURACION_SESION * 1000)
  ]);
  return cookieSesion(request, token, DURACION_SESION);
}

function revisarCredenciales(alias, clave) {
  if (typeof alias !== "string" || !/^[a-zA-Z0-9_-]{3,20}$/.test(alias)) {
    throw new ErrorApi(400, "El usuario debe tener de 3 a 20 letras, números, guiones o guiones bajos, sin espacios.");
  }
  if (typeof clave !== "string" || clave.length < 8 || clave.length > 128) {
    throw new ErrorApi(400, "La contraseña debe tener entre 8 y 128 caracteres.");
  }
}

async function registrar(request, env) {
  await limitar(env, `registro:${ipDe(request)}`, 300, 3600); // Alto: toda una escuela suele salir por una sola IP.
  const { alias, clave, rol } = await leerCuerpo(request);
  if (!['docente', 'alumno'].includes(rol)) throw new ErrorApi(400, 'Elegí un perfil de profe o alumno.');
  revisarCredenciales(alias, clave);
  const existente = await env.DB.prepare("SELECT 1 FROM usuarios WHERE alias = ?").bind(alias).first();
  if (existente) throw new ErrorApi(409, "Ese usuario ya existe. Probá con otro.");
  const id = crypto.randomUUID();
  const codigoRecuperacion = `${codigoAleatorio(4)}-${codigoAleatorio(4)}-${codigoAleatorio(4)}`;
  try {
    await env.DB.prepare("INSERT INTO usuarios (id, alias, clave, recuperacion, creado, rol) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, alias, await hashearSecreto(clave), await hashearSecreto(codigoRecuperacion), Date.now(), rol).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new ErrorApi(409, "Ese usuario ya existe. Probá con otro.");
    throw error;
  }
  return json({ alias, rol, codigoRecuperacion }, 201, { "set-cookie": await abrirSesion(request, env, id) });
}

async function ingresar(request, env) {
  await limitar(env, `ingreso-ip:${ipDe(request)}`, 200, 900);
  const { alias, clave } = await leerCuerpo(request);
  if (typeof alias !== "string" || typeof clave !== "string" || alias.length > 20 || clave.length > 128) {
    throw new ErrorApi(401, "Usuario o contraseña incorrectos.");
  }
  await limitar(env, `ingreso:${alias.toLowerCase()}`, 10, 900);
  const usuario = await env.DB.prepare("SELECT id, alias, clave FROM usuarios WHERE alias = ?").bind(alias).first();
  const valido = await verificarSecreto(clave, usuario?.clave ?? SECRETO_FALSO);
  if (!usuario || !valido) throw new ErrorApi(401, "Usuario o contraseña incorrectos.");
  return json({ alias: usuario.alias }, 200, { "set-cookie": await abrirSesion(request, env, usuario.id) });
}

async function recuperar(request, env) {
  const { alias, codigoRecuperacion, clave } = await leerCuerpo(request);
  revisarCredenciales(alias, clave);
  await limitar(env, `recuperar:${alias.toLowerCase()}`, 5, 3600);
  const usuario = await env.DB.prepare("SELECT id, alias, recuperacion FROM usuarios WHERE alias = ?").bind(alias).first();
  const codigo = String(codigoRecuperacion ?? "").trim().toUpperCase();
  const valido = await verificarSecreto(codigo, usuario?.recuperacion ?? SECRETO_FALSO);
  if (!usuario || !valido) throw new ErrorApi(401, "Usuario o código de recuperación incorrectos.");
  // El código sirve una sola vez, y cambiar la contraseña cierra todas las sesiones abiertas.
  const nuevoCodigo = `${codigoAleatorio(4)}-${codigoAleatorio(4)}-${codigoAleatorio(4)}`;
  await env.DB.batch([
    env.DB.prepare("UPDATE usuarios SET clave = ?, recuperacion = ? WHERE id = ?")
      .bind(await hashearSecreto(clave), await hashearSecreto(nuevoCodigo), usuario.id),
    env.DB.prepare("DELETE FROM sesiones WHERE usuario_id = ?").bind(usuario.id)
  ]);
  return json({ alias: usuario.alias, codigoRecuperacion: nuevoCodigo }, 200, { "set-cookie": await abrirSesion(request, env, usuario.id) });
}

async function salir(request, env) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(/;\s*/).find((par) => par.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (token) await env.DB.prepare("DELETE FROM sesiones WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookieSesion(request, "", 0) });
}

async function validarRosco(datos, env, usuario) {
  const materias = (await listarMaterias(env)).map(m => m.nombre);
  const { errores, rosco } = revisarRosco(datos, materias);
  if (errores.length) throw new ErrorApi(422, errores[0].mensaje, { errores });
  if(datos.generacionId){
    if(typeof datos.generacionId!=='string'||!/^[-a-f0-9]{36}$/.test(datos.generacionId))throw new ErrorApi(422,'Borrador generado inválido.');
    const origen=await env.DB.prepare("SELECT id FROM generaciones WHERE id=? AND usuario_id=? AND estado='listo'").bind(datos.generacionId,usuario.id).first();
    if(!origen)throw new ErrorApi(404,'Borrador generado no encontrado.');
    if(datos.revisionConfirmada!==true)throw new ErrorApi(422,'Revisá las preguntas y confirmá la revisión del borrador.');
    rosco.generacionId=origen.id;
  }
  return rosco;
}

const resumenRosco = (fila) => ({
  id: fila.id,
  codigo: fila.codigo,
  titulo: fila.titulo,
  materia: fila.materia,
  segundos: fila.segundos,
  powerups: Boolean(fila.powerups),
  generacionId: fila.generacion_id ?? null,
  letras: JSON.parse(fila.entradas).length,
  jugadores: fila.jugadores ?? 0,
  actualizado: fila.actualizado
});

async function listarRoscos(usuario, env) {
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT COUNT(DISTINCT i.jugador) FROM intentos i WHERE i.rosco_id = r.id) AS jugadores
     FROM roscos r WHERE r.usuario_id = ? ORDER BY r.actualizado DESC`
  ).bind(usuario.id).all();
  return json({ roscos: results.map(resumenRosco) });
}

async function crearRosco(request, usuario, env) {
  await limitar(env, `crear:${usuario.id}`, 60, 3600);
  const rosco = await validarRosco(await leerCuerpo(request), env, usuario);
  const { cuenta } = await env.DB.prepare("SELECT COUNT(*) AS cuenta FROM roscos WHERE usuario_id = ?").bind(usuario.id).first();
  if (cuenta >= MAX_ROSCOS) throw new ErrorApi(409, `Llegaste al máximo de ${MAX_ROSCOS} roscos. Borrá alguno para crear otro.`);
  const id = crypto.randomUUID();
  const ahora = Date.now();
  for (let intento = 0; intento < 5; intento += 1) {
    const codigo = codigoAleatorio(6);
    try {
      await env.DB.prepare(
        "INSERT INTO roscos (id, usuario_id, codigo, titulo, materia, segundos, entradas, creado, actualizado, powerups, generacion_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, usuario.id, codigo, rosco.titulo, rosco.materia, rosco.segundos, JSON.stringify(rosco.entradas), ahora, ahora, rosco.powerups ? 1 : 0, rosco.generacionId ?? null).run();
      return json({ id, codigo }, 201);
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new ErrorApi(503, "No se pudo generar un código. Probá de nuevo.");
}

async function miRosco(id, usuario, env) {
  const fila = await env.DB.prepare("SELECT * FROM roscos WHERE id = ? AND usuario_id = ?").bind(id, usuario.id).first();
  if (!fila) throw new ErrorApi(404, "No encontramos ese rosco.");
  return fila;
}

async function actualizarRosco(request, id, usuario, env) {
  const previo=await miRosco(id, usuario, env);
  const datos=await leerCuerpo(request);
  if(previo.generacion_id)datos.generacionId=previo.generacion_id;
  const rosco = await validarRosco(datos, env, usuario);
  await env.DB.prepare("UPDATE roscos SET titulo = ?, materia = ?, segundos = ?, entradas = ?, actualizado = ?, powerups = ?, generacion_id = ? WHERE id = ? AND usuario_id = ?")
    .bind(rosco.titulo, rosco.materia, rosco.segundos, JSON.stringify(rosco.entradas), Date.now(), rosco.powerups ? 1 : 0, rosco.generacionId ?? null, id, usuario.id).run();
  return json({ ok: true });
}

async function roscoPorCodigo(codigo, env) {
  const fila = await env.DB.prepare("SELECT * FROM roscos WHERE codigo = ?").bind(codigo.toUpperCase()).first();
  if (!fila) throw new ErrorApi(404, "No hay ningún rosco con ese código.");
  return fila;
}

const parseIntento = (fila) => ({ ...fila, entradas: JSON.parse(fila.entradas) });

async function powerupsDeIntento(env, intento) {
  const {results} = await env.DB.prepare("SELECT tipo,pos FROM powerup_usos WHERE intento_id=? OR (sala_id=? AND tipo='tiempo')")
    .bind(intento.id,intento.sala_id ?? null).all();
  const usados = Object.fromEntries(results.map(r=>[r.tipo,r.pos]));
  const pistas = {};
  if (Object.hasOwn(usados,'pista')) pistas[usados.pista] = intento.entradas[usados.pista]?.pista;
  return {habilitados:Boolean(intento.powerups),usados,pistas};
}

async function usarPowerup(request, token, env) {
  const {tipo,pos} = await leerCuerpo(request);
  const intento = await buscarIntento(token,env);
  if (!['tiempo','pista','reintento'].includes(tipo)) throw new ErrorApi(400,'Ayuda no válida.');
  if (!intento.powerups) throw new ErrorApi(409,'Este rosco no tiene ayudas habilitadas.');
  if (intento.fin || Date.now()<intento.inicio || Date.now()>=intento.limite) throw new ErrorApi(409,'La ayuda requiere una partida en curso con tiempo disponible.');
  const entrada = intento.entradas[pos];
  if (tipo!=='tiempo' && (!Number.isInteger(pos)||!entrada)) throw new ErrorApi(400,'Elegí una letra válida.');
  if (tipo==='pista' && !entrada.pista) throw new ErrorApi(409,'El profe no cargó una pista para esta letra.');
  // Validación y efecto dentro de la transacción de SQLite: los pedidos simultáneos no duplican una ayuda.
  const condiciones = tipo==='pista'
    ? 'AND NOT EXISTS (SELECT 1 FROM respuestas WHERE intento_id=i.id AND pos=?4)'
    : tipo==='reintento' ? 'AND EXISTS (SELECT 1 FROM respuestas WHERE intento_id=i.id AND pos=?4 AND correcta=0)' : '';
  const sql = `INSERT OR IGNORE INTO powerup_usos (intento_id,tipo,pos,usado,sala_id)
    SELECT i.id,?2,?4,?3,i.sala_id FROM intentos i
    WHERE i.id=?1 AND i.powerups=1 AND i.fin IS NULL AND i.inicio<=?3 AND i.limite>?3
    AND (i.sala_id IS NULL OR EXISTS (SELECT 1 FROM salas s WHERE s.id=i.sala_id AND s.estado='jugando' AND s.limite>?3)) ${condiciones}`;
  const uso = await env.DB.prepare(sql).bind(token,tipo,Date.now(),tipo==='tiempo'?null:pos).run();
  const actualizado = await buscarIntento(token,env);
  if (uso.meta.changes===0) throw new ErrorApi(409,'La ayuda ya se usó o esa letra no permite usarla.');
  return payloadPartida(env,actualizado);
}

async function estadoDeIntento(env, intento) {
  const { results } = await env.DB.prepare("SELECT pos, correcta FROM respuestas WHERE intento_id = ?").bind(intento.id).all();
  return Object.fromEntries(results.map((fila) => [fila.pos, fila.correcta ? "correcta" : "incorrecta"]));
}

async function empezarIntento(request, codigo, env) {
  await limitar(env, `intento-ip:${ipDe(request)}`, 600, 600);
  const { jugador, seudonimo, avatar: seleccionado } = await leerCuerpo(request);
  const usuario=await usuarioActual(request,env);
  const perfil=usuario?await env.DB.prepare('SELECT avatar FROM usuarios WHERE id=?').bind(usuario.id).first():null;
  const avatar=await avatarValido(env,seleccionado,perfil?.avatar ?? 'voltio');
  if(!avatar) throw new ErrorApi(422,'Elegí un personaje del catálogo.');
  if (typeof jugador !== "string" || !/^[0-9a-f-]{36}$/.test(jugador)) throw new ErrorApi(400, "Jugador no válido.");
  if (!seudonimoValido(seudonimo)) throw new ErrorApi(400, "Elegí un seudónimo de la lista.");
  const rosco = await roscoPorCodigo(codigo, env);
  const ahora = Date.now();

  // Si recargó la página, retoma la partida en vez de regalarle un reloj nuevo.
  let fila = await env.DB.prepare(
    "SELECT * FROM intentos WHERE rosco_id = ? AND jugador = ? AND sala_id IS NULL AND fin IS NULL AND limite > ? AND COALESCE(usuario_id,'')=? ORDER BY inicio DESC LIMIT 1"
  ).bind(rosco.id, jugador, ahora, usuario?.id ?? '').first();

  if (!fila) {
    fila = {
      id: tokenAleatorio(), entradas: rosco.entradas, inicio: ahora, limite: ahora + rosco.segundos * 1000, seudonimo, powerups: rosco.powerups, avatar, usuario_id:usuario?.id ?? null
    };
    await env.DB.prepare("INSERT INTO intentos (id, rosco_id, jugador, seudonimo, entradas, inicio, limite, powerups, avatar, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(fila.id, rosco.id, jugador, seudonimo, fila.entradas, fila.inicio, fila.limite, fila.powerups, fila.avatar, fila.usuario_id).run();
  }
  return payloadPartida(env, parseIntento(fila));
}

async function payloadPartida(env, intento) {
  return json({
    token: intento.id,
    seudonimo: intento.seudonimo,
    avatar: intento.avatar,
    restanteMs: intento.limite - Date.now(),
    terminada: Boolean(intento.fin),
    respuestas: await estadoDeIntento(env, intento),
    powerups: await powerupsDeIntento(env, intento),
    items: intento.entradas.map((entrada, pos) => ({
      pos, letra: entrada.letra, modo: modoDeLetra(entrada.letra, entrada.palabra), definicion: entrada.definicion, tienePista: Boolean(entrada.pista)
    }))
  }, 201);
}

async function buscarIntento(token, env) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new ErrorApi(404, "Partida no encontrada.");
  const fila = await env.DB.prepare("SELECT * FROM intentos WHERE id = ?").bind(token).first();
  if (!fila) throw new ErrorApi(404, "Partida no encontrada.");
  return parseIntento(fila);
}

async function cerrarIntento(env, intento) {
  await env.DB.prepare("UPDATE intentos SET fin = MIN(?,limite) WHERE id = ? AND fin IS NULL").bind(Date.now(), intento.id).run();
  const respuestas = await estadoDeIntento(env, intento);
  const actual = await env.DB.prepare("SELECT aciertos, errores, inicio, fin FROM intentos WHERE id = ?").bind(intento.id).first();
  const salaAbierta = await salaEnCurso(env, intento.sala_id);
  return {
    salaAbierta,
    actividad: intento.usuario_id ? await actividadUsuario(env,intento.usuario_id) : null,
    aciertos: actual.aciertos,
    errores: actual.errores,
    total: intento.entradas.length,
    duracionMs: actual.fin - actual.inicio,
    correcciones: salaAbierta ? [] : intento.entradas.map((entrada, pos) => ({
      letra: entrada.letra, palabra: entrada.palabra, definicion: entrada.definicion, estado: respuestas[pos] ?? "sin-responder"
    }))
  };
}

async function responder(request, token, env) {
  const { pos, respuesta } = await leerCuerpo(request);
  const intento = await buscarIntento(token, env);
  if (intento.fin) throw new ErrorApi(409, "Esta partida ya terminó.");
  if (Date.now() < intento.inicio) throw new ErrorApi(409, "La sala todavía no empezó.");
  if (Date.now() > intento.limite + GRACIA_MS) return json({ terminado: true, resultado: await cerrarIntento(env, intento) });
  const entrada = intento.entradas[pos];
  if (!Number.isInteger(pos) || !entrada) throw new ErrorApi(400, "Letra no válida.");
  if (typeof respuesta !== "string" || !respuesta.trim() || respuesta.length > 120) throw new ErrorApi(400, "Escribí una respuesta.");
  const correcta = respuestaCorrecta(entrada, respuesta);

  // La clave primaria (intento, pos) impide contestar dos veces la misma letra, aun con pedidos simultáneos.
  const insercion = await env.DB.prepare("INSERT OR IGNORE INTO respuestas (intento_id, pos, correcta) SELECT id, ?, ? FROM intentos WHERE id=? AND fin IS NULL AND inicio<=? AND limite+? >= ? RETURNING pos")
    .bind(pos, correcta ? 1 : 0, intento.id, Date.now(), GRACIA_MS, Date.now()).first();
  if (!insercion) throw new ErrorApi(409, "Esa letra ya fue respondida o la partida terminó.");


  const { cuenta } = await env.DB.prepare("SELECT COUNT(*) AS cuenta FROM respuestas WHERE intento_id = ?").bind(intento.id).first();
  const ayudas = await powerupsDeIntento(env, intento);
  const hayErrores = Object.values(await estadoDeIntento(env,intento)).includes('incorrecta');
  const terminado = cuenta >= intento.entradas.length && !(ayudas.habilitados && !Object.hasOwn(ayudas.usados,'reintento') && hayErrores);
  return json({ correcta, terminado, resultado: terminado ? await cerrarIntento(env, intento) : undefined });
}

async function terminar(token, env) {
  const intento = await buscarIntento(token, env);
  return json({ terminado: true, resultado: await cerrarIntento(env, intento) });
}

// Se muestra el mejor resultado de cada jugador. No expone ids de jugador.
async function consultarRanking(env, roscoId, jugador) {
  const { results } = await env.DB.prepare(
    `WITH validos AS (
       SELECT jugador, seudonimo, avatar, aciertos, errores, COALESCE(fin, limite) - inicio AS duracion
       FROM intentos
       WHERE rosco_id = ?1 AND aciertos > 0 AND (fin IS NOT NULL OR limite < ?2)
     ), mejores AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY jugador ORDER BY aciertos DESC, errores ASC, duracion ASC) AS orden
       FROM validos
     )
     SELECT seudonimo, avatar, aciertos, errores, duracion, jugador = ?3 AS soyYo
     FROM mejores WHERE orden = 1
     ORDER BY aciertos DESC, errores ASC, duracion ASC LIMIT 50`
  ).bind(roscoId, Date.now(), jugador ?? "").all();
  return results.map((fila, indice) => ({
    posicion: indice + 1, seudonimo: fila.seudonimo, avatar: fila.avatar, aciertos: fila.aciertos, errores: fila.errores, duracionMs: fila.duracion, soyYo: Boolean(fila.soyYo)
  }));
}

async function infoPublica(codigo, env) {
  const rosco = await roscoPorCodigo(codigo, env);
  const entradas = JSON.parse(rosco.entradas);
  return json({
    codigo: rosco.codigo, titulo: rosco.titulo, materia: rosco.materia, segundos: rosco.segundos,
    presentacion: await presentacionMateria(env, rosco.materia), powerups: Boolean(rosco.powerups),
    letras: entradas.map((entrada) => entrada.letra)
  });
}

async function rutearApi(request, env, url) {
  const ruta = url.pathname.slice("/api".length);
  const metodo = request.method;
  const coincide = (patron) => ruta.match(patron);
  let m;

  if (metodo !== "GET") {
    const origen = request.headers.get("origin");
    if (origen && origen !== url.origin) throw new ErrorApi(403, "Origen no permitido.");
  }

  if (ruta === "/sesion" && metodo === "GET") {
    const usuario = await usuarioActual(request, env);
    return json({ alias: usuario?.alias ?? null, rol: usuario?.rol ?? null });
  }
  if (ruta === "/registro" && metodo === "POST") return registrar(request, env);
  if (ruta === '/perfil' && ['GET','PATCH'].includes(metodo)) {
    const usuario=await exigirUsuario(request,env);
    if(metodo==='PATCH') {
      const datos=await leerCuerpo(request), avatar=await avatarValido(env,datos.avatar);
      if(datos.avatar===undefined||!avatar) throw new ErrorApi(422,'Elegí un personaje del catálogo.');
      await env.DB.prepare('UPDATE usuarios SET avatar=? WHERE id=?').bind(avatar,usuario.id).run();
    }
    const perfil=await env.DB.prepare('SELECT alias,avatar FROM usuarios WHERE id=?').bind(usuario.id).first();
    return json({...perfil,actividad:await actividadUsuario(env,usuario.id)});
  }
  if (ruta === '/materias'  && metodo === 'GET') return json({ materias: await listarMaterias(env) });
  if (ruta === "/ingreso" && metodo === "POST") return ingresar(request, env);
  if (ruta === "/recuperar" && metodo === "POST") return recuperar(request, env);
  if (ruta === "/salir" && metodo === "POST") return salir(request, env);

  if(ruta.startsWith('/generador/'))return manejarGenerador({request,env,usuario:await exigirUsuario(request,env),ruta,metodo,leerCuerpo,json,limitar});

  if (ruta === '/clases' || ruta.startsWith('/clases/')) {
    const usuario = await exigirUsuario(request, env);
    return manejarClases({request,env,usuario,ruta,metodo,ErrorApi,leerCuerpo,limitar,json});
  }

  if (ruta === "/salas" || ruta.startsWith("/salas/") || ruta.startsWith("/sala/")) {
    return manejarSalas({
      request, env, ruta, metodo, ErrorApi, leerCuerpo, limitar, json, ipDe, exigirUsuario, parseIntento,
      usuarioActual: () => usuarioActual(request,env),
      payloadPartida: (intento) => payloadPartida(env, intento)
    });
  }

  if (ruta === "/roscos") {
    const usuario = await exigirUsuario(request, env);
    if (metodo === "GET") return listarRoscos(usuario, env);
    if (metodo === "POST") return crearRosco(request, usuario, env);
  }
  if ((m = coincide(/^\/roscos\/([0-9a-f-]{36})$/))) {
    const usuario = await exigirUsuario(request, env);
    if (metodo === "GET") {
      const fila = await miRosco(m[1], usuario, env);
      return json({ ...resumenRosco(fila), entradas: JSON.parse(fila.entradas) });
    }
    if (metodo === "PUT") return actualizarRosco(request, m[1], usuario, env);
    if (metodo === "DELETE") {
      await miRosco(m[1], usuario, env);
      await env.DB.prepare("DELETE FROM roscos WHERE id = ? AND usuario_id = ?").bind(m[1], usuario.id).run();
      return json({ ok: true });
    }
  }
  if ((m = coincide(/^\/roscos\/([0-9a-f-]{36})\/ranking$/)) && metodo === "DELETE") {
    const usuario = await exigirUsuario(request, env);
    await miRosco(m[1], usuario, env);
    await env.DB.prepare("DELETE FROM intentos WHERE rosco_id = ?").bind(m[1]).run();
    return json({ ok: true });
  }

  if ((m = coincide(/^\/r\/([A-Za-z0-9]{6})$/)) && metodo === "GET") return infoPublica(m[1], env);
  if ((m = coincide(/^\/r\/([A-Za-z0-9]{6})\/ranking$/)) && metodo === "GET") {
    const rosco = await roscoPorCodigo(m[1], env);
    return json({ ranking: await consultarRanking(env, rosco.id, request.headers.get("x-jugador")) });
  }
  if ((m = coincide(/^\/r\/([A-Za-z0-9]{6})\/intentos$/)) && metodo === "POST") return empezarIntento(request, m[1], env);
  if ((m = coincide(/^\/intentos\/([^/]+)\/powerups$/)) && metodo === 'POST') return usarPowerup(request,m[1],env);
  if ((m = coincide(/^\/intentos\/([^/]+)$/)) && metodo === 'GET') return payloadPartida(env,await buscarIntento(m[1],env));
  if ((m = coincide(/^\/intentos\/([^/]+)\/responder$/)) && metodo === "POST") return responder(request, m[1], env);
  if ((m = coincide(/^\/intentos\/([^/]+)\/terminar$/)) && metodo === "POST") return terminar(m[1], env);

  throw new ErrorApi(404, "Ruta no encontrada.");
}

export default {
  async scheduled(_evento,env,ctx){ctx.waitUntil(prepararBorradoresDiarios(env));},
  async fetch(request, env) {
    const url = new URL(request.url);
    const enlace = url.pathname.match(/^\/r\/([A-Za-z0-9]{6})$/);
    if (enlace) return Response.redirect(`${url.origin}/jugar?c=${enlace[1].toUpperCase()}`, 302);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await rutearApi(request, env, url);
    } catch (error) {
      if(error instanceof ErrorGenerador)return json({error:error.message},error.estado);
      if (error instanceof ErrorApi) return json({ error: error.message, ...error.extra }, error.estado);
      console.error(error);
      return json({ error: "Algo salió mal. Probá de nuevo." }, 500);
    }
  }
};

