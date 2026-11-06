// Pruebas de la sala en vivo contra un servidor local: `npm run dev` en una terminal y `npm test` en otra.
import assert from "node:assert/strict";
import { test } from "node:test";

const BASE = process.env.BASE ?? "http://localhost:8787";
const CUENTA_MS = 5300;
const unico = () => `t${Math.random().toString(36).slice(2, 12)}`;
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function cliente() {
  let cookie = "";
  return async (ruta, { metodo = "GET", cuerpo, encabezados = {} } = {}) => {
    const respuesta = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...encabezados },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const nueva = respuesta.headers.get("set-cookie");
    if (nueva) cookie = nueva.split(";")[0];
    return { estado: respuesta.status, datos: await respuesta.json() };
  };
}

const ROSCO = {
  titulo: "Rosco en vivo",
  materia: "Tecnología",
  segundos: 120,
  entradas: [
    { letra: "A", palabra: "Algoritmo", definicion: "Serie ordenada de pasos para resolver un problema." },
    { letra: "B", palabra: "Bit", definicion: "Unidad mínima de información digital." },
    { letra: "C", palabra: "Cable", definicion: "Conductor por el que viajan datos o energía." },
    { letra: "D", palabra: "Dato", definicion: "Información sin procesar." },
    { letra: "E", palabra: "Enlace", definicion: "Texto o imagen que lleva a otra página." }
  ]
};

async function anfitrion(rol = "docente") {
  const api = cliente();
  assert.equal((await api("/registro", { metodo: "POST", cuerpo: { alias: unico(), clave: "contraseña-segura", rol } })).estado, 201);
  const { datos: rosco } = await api("/roscos", { metodo: "POST", cuerpo: ROSCO });
  const { estado, datos: sala } = await api("/salas", { metodo: "POST", cuerpo: { roscoId: rosco.id } });
  assert.equal(estado, 201);
  return { api, rosco, sala };
}

async function jugador(pin, seudonimo) {
  const api = cliente();
  const id = crypto.randomUUID();
  const respuesta = await api(`/sala/${pin}/unirme`, { metodo: "POST", cuerpo: { jugador: id, seudonimo } });
  return { api, id, respuesta };
}

test("el registro exige elegir perfil", async () => {
  assert.equal((await cliente()("/registro", { metodo: "POST", cuerpo: { alias: unico(), clave: "contraseña-segura" } })).estado, 400);
});

test("solo quien creó el rosco abre y controla la sala", async () => {
  const { rosco, sala } = await anfitrion();
  const otro = cliente();
  await otro("/registro", { metodo: "POST", cuerpo: { alias: unico(), clave: "contraseña-segura", rol: "docente" } });
  assert.equal((await otro("/salas", { metodo: "POST", cuerpo: { roscoId: rosco.id } })).estado, 404);
  assert.equal((await otro(`/salas/${sala.id}`)).estado, 404);
  assert.equal((await otro(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} })).estado, 404);
  assert.equal((await otro(`/salas/${sala.id}/terminar`, { metodo: "POST", cuerpo: {} })).estado, 404);
  assert.equal((await cliente()(`/salas/${sala.id}`)).estado, 401);
});

test("un alumno puede abrir una sala con su propio rosco", async () => {
  const { api, sala } = await anfitrion("alumno");
  assert.equal((await api(`/salas/${sala.id}`)).datos.estado, "espera");
});

test("recargar no abre otra sala y sin jugadores no se puede empezar", async () => {
  const { api, rosco, sala } = await anfitrion();
  const otra = await api("/salas", { metodo: "POST", cuerpo: { roscoId: rosco.id } });
  assert.equal(otra.datos.pin, sala.pin);
  assert.equal((await api(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} })).estado, 409);
});

test("el ingreso valida seudónimo, repetidos y reingreso", async () => {
  const { sala } = await anfitrion();
  assert.equal((await jugador(sala.pin, "Juan Perez")).respuesta.estado, 400);
  const ana = await jugador(sala.pin, "Puma Veloz 42");
  assert.equal(ana.respuesta.estado, 201);
  assert.equal((await jugador(sala.pin, "Puma Veloz 42")).respuesta.estado, 409);
  const vuelve = await ana.api(`/sala/${sala.pin}/unirme`, { metodo: "POST", cuerpo: { jugador: ana.id, seudonimo: "Lobo Sabio 15" } });
  assert.equal(vuelve.datos.seudonimo, "Puma Veloz 42");
  assert.equal((await cliente()("/sala/ZZZZZZ")).estado, 404);
});

test("partida completa: arranque conjunto, sin filtrar respuestas y cierre con repaso", async () => {
  const { api, sala } = await anfitrion();
  const ana = await jugador(sala.pin, "Puma Veloz 42");
  const beto = await jugador(sala.pin, "Lobo Sabio 15");
  const partida = (quien) => quien.api(`/sala/${sala.pin}/partida`, { metodo: "POST", cuerpo: { jugador: quien.id } });

  assert.equal((await partida(ana)).estado, 409);
  const empezada = await api(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} });
  assert.equal(empezada.datos.estado, "jugando");
  assert.ok(empezada.datos.comienzaEnMs > 3000);
  assert.equal((await api(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} })).estado, 409);

  // Durante la cuenta regresiva nadie recibe las definiciones.
  const temprano = await partida(ana);
  assert.equal(temprano.estado, 409);
  assert.equal(temprano.datos.todaviaNo, true);
  assert.equal(temprano.datos.items, undefined);

  await pausa(CUENTA_MS);
  const juegoAna = await partida(ana);
  const juegoBeto = await partida(beto);
  assert.equal(juegoAna.estado, 201);
  assert.ok(Math.abs(juegoAna.datos.restanteMs - juegoBeto.datos.restanteMs) < 2000);
  assert.equal((await partida(ana)).datos.token, juegoAna.datos.token);
  for (const palabra of ["algoritmo", "enlace"]) assert.ok(!JSON.stringify(juegoAna.datos).toLowerCase().includes(palabra));

  const responder = (quien, juego, pos, respuesta) =>
    quien.api(`/intentos/${juego.datos.token}/responder`, { metodo: "POST", cuerpo: { pos, respuesta } });
  for (const [pos, respuesta] of [[0, "algoritmo"], [1, "bit"], [2, "cable"], [3, "dato"]]) await responder(ana, juegoAna, pos, respuesta);
  const final = await responder(ana, juegoAna, 4, "enlace");
  assert.equal(final.datos.terminado, true);
  assert.equal(final.datos.resultado.salaAbierta, true);
  assert.deepEqual(final.datos.resultado.correcciones, [], "quien termina primero no puede pasar las respuestas");

  await responder(beto, juegoBeto, 0, "algoritmo");

  const vivo = await api(`/salas/${sala.id}`);
  assert.deepEqual(vivo.datos.jugadores.map((fila) => [fila.seudonimo, fila.aciertos, fila.termino]), [
    ["Puma Veloz 42", 5, true], ["Lobo Sabio 15", 1, false]
  ]);
  assert.ok(!JSON.stringify(vivo.datos).includes(ana.id));

  const publico = await ana.api(`/sala/${sala.pin}`, { encabezados: { "x-jugador": ana.id } });
  assert.equal(publico.datos.jugadores, 2);
  assert.equal(publico.datos.tabla[0].soyYo, true);
  assert.equal(publico.datos.seudonimo, "Puma Veloz 42");

  const tarde = await jugador(sala.pin, "Rayo Turbo 77");
  assert.equal(tarde.respuesta.estado, 201);
  const juegoTarde = await partida(tarde);
  assert.ok(juegoTarde.datos.restanteMs < juegoAna.datos.restanteMs);

  const cerrada = await api(`/salas/${sala.id}/terminar`, { metodo: "POST", cuerpo: {} });
  assert.equal(cerrada.datos.estado, "terminada");
  assert.equal((await responder(beto, juegoBeto, 1, "bit")).estado, 409);

  const repaso = await ana.api(`/intentos/${juegoAna.datos.token}/terminar`, { metodo: "POST", cuerpo: {} });
  assert.equal(repaso.datos.resultado.salaAbierta, false);
  assert.equal(repaso.datos.resultado.correcciones.length, 5);
  assert.equal(repaso.datos.resultado.aciertos, 5);

  assert.equal((await jugador(sala.pin, "Búho Genial 20")).respuesta.estado, 409);
  assert.equal((await api(`/salas/${sala.id}/terminar`, { metodo: "POST", cuerpo: {} })).datos.estado, "terminada");

  // Terminada la sala, se puede abrir otra con un código nuevo sobre el mismo rosco.
  const roscoId = cerrada.datos.roscoId;
  const nueva = await api("/salas", { metodo: "POST", cuerpo: { roscoId } });
  assert.notEqual(nueva.datos.pin, sala.pin);
});

test("terminar durante la cuenta regresiva no deja tiempos negativos", async () => {
  const { api, sala } = await anfitrion();
  await jugador(sala.pin, "Puma Veloz 42");
  await api(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} });
  const cerrada = await api(`/salas/${sala.id}/terminar`, { metodo: "POST", cuerpo: {} });
  assert.equal(cerrada.datos.estado, "terminada");
  assert.ok(cerrada.datos.jugadores.every((fila) => fila.duracionMs >= 0));
});

test("una partida de sala no se mezcla con jugar el rosco por su código", async () => {
  const { api, rosco, sala } = await anfitrion();
  const ana = await jugador(sala.pin, "Puma Veloz 42");
  await api(`/salas/${sala.id}/empezar`, { metodo: "POST", cuerpo: {} });
  await pausa(CUENTA_MS);
  const enSala = await ana.api(`/sala/${sala.pin}/partida`, { metodo: "POST", cuerpo: { jugador: ana.id } });
  const suelta = await ana.api(`/r/${rosco.codigo}/intentos`, { metodo: "POST", cuerpo: { jugador: ana.id, seudonimo: "Puma Veloz 42" } });
  assert.notEqual(suelta.datos.token, enSala.datos.token);
});
