import { api, aviso, dibujarRanking, el, formatoTiempo } from "./api.js";

const $ = (selector) => document.querySelector(selector);
const VISTAS = ["espera", "cuenta", "juego", "final"];
const SONDEO_MS = 2000;
const parametros = new URLSearchParams(location.search);
const estado = { id: parametros.get("id"), sala: null, finMs: 0, sondeo: null };

function mostrar(vista) {
  $("#cargando").classList.add("hidden");
  VISTAS.forEach((nombre) => $(`#vista-${nombre}`).classList.toggle("hidden", nombre !== vista));
  const conReloj = vista === "juego";
  $("#reloj-caja").classList.toggle("hidden", !conReloj);
  $("#reloj-caja").classList.toggle("flex", conReloj);
}

function fallar(mensaje) {
  $("#cargando").classList.add("hidden");
  $("#error").textContent = mensaje;
  $("#error").classList.remove("hidden");
}

function dibujarEspera(sala) {
  $("#espera-materia").textContent = sala.materia;
  $("#espera-titulo").textContent = sala.titulo;
  $("#sitio").textContent = location.host;
  $("#pin").textContent = sala.pin;
  const cantidad = sala.jugadores.length;
  $("#cantidad").textContent = `(${cantidad})`;
  $("#empezar").disabled = cantidad === 0;
  $("#ayuda-empezar").textContent = cantidad ? "Empezá cuando estén todos. Quien llegue tarde puede sumarse con el tiempo que quede." : "Esperando a la primera persona.";
  $("#jugadores").replaceChildren(...sala.jugadores.map(({ seudonimo }) => el("li", "rounded-full bg-white/[.07] px-3 py-1.5 text-sm font-bold", seudonimo)));
}

function dibujarMarcador(sala) {
  $("#juego-pin").textContent = sala.pin;
  $("#juego-titulo").textContent = sala.titulo;
  const terminaron = sala.jugadores.filter((fila) => fila.termino).length;
  $("#juego-avance").textContent = `${terminaron} de ${sala.jugadores.length} terminaron`;
  $("#marcador").replaceChildren(...sala.jugadores.map((fila) => {
    const item = el("li", "rounded-xl bg-white/[.04] px-3 py-2");
    const linea = el("div", "flex items-center gap-3 text-base");
    linea.append(
      el("span", "display-font w-7 text-center font-black text-cyan-200", String(fila.posicion)),
      el("span", "min-w-0 flex-1 break-words font-bold", fila.seudonimo),
      el("span", "font-black text-emerald-300", `${fila.aciertos} ✓`),
      el("span", "w-10 text-right text-slate-300", `${fila.errores} ✗`)
    );
    const barra = el("div", "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10");
    const avance = el("div", `h-full rounded-full ${fila.termino ? "bg-emerald-400" : "bg-cyan-400"}`);
    avance.style.width = `${Math.min(100, ((fila.aciertos + fila.errores) / sala.letras) * 100)}%`;
    barra.append(avance);
    item.append(linea, barra);
    return item;
  }));
}

function dibujarFinal(sala) {
  $("#final-titulo").textContent = sala.titulo;
  // Segundo, primero, tercero: el primer puesto queda al centro en pantallas anchas.
  const orden = [1, 0, 2].map((indice) => sala.jugadores[indice]).filter(Boolean);
  const alturas = { 1: "sm:pb-14", 2: "sm:pb-8", 3: "sm:pb-4" };
  $("#podio").replaceChildren(...orden.map((fila) => {
    const item = el("li", `rounded-2xl bg-amber-300/10 p-4 ${alturas[fila.posicion]} ${fila.posicion === 1 ? "order-first sm:order-none" : ""}`);
    item.append(
      el("p", "display-font text-4xl font-black text-amber-200", `${fila.posicion}.º`),
      el("p", "mt-1 break-words font-extrabold", fila.seudonimo),
      el("p", "mt-1 text-sm font-semibold text-slate-300", `${fila.aciertos} ✓ · ${fila.errores} ✗ · ${formatoTiempo(fila.duracionMs)}`)
    );
    return item;
  }));
  $("#resto-caja").classList.toggle("hidden", sala.jugadores.length <= 3);
  dibujarRanking($("#resto"), sala.jugadores.slice(3));
}

function atender(sala) {
  estado.sala = sala;
  if (sala.estado === "espera") {
    dibujarEspera(sala);
    mostrar("espera");
  } else if (sala.estado === "jugando" && sala.comienzaEnMs > 0) {
    estado.finMs = performance.now() + sala.comienzaEnMs + sala.restanteMs;
    $("#cuenta").textContent = String(Math.ceil(sala.comienzaEnMs / 1000));
    mostrar("cuenta");
  } else if (sala.estado === "jugando") {
    estado.finMs = performance.now() + sala.restanteMs;
    dibujarMarcador(sala);
    mostrar("juego");
  } else {
    dibujarFinal(sala);
    mostrar("final");
    return; // Terminada: no hay nada más que actualizar.
  }
  programar();
}

function programar() {
  window.clearTimeout(estado.sondeo);
  const espera = estado.sala.comienzaEnMs > 0 ? Math.min(SONDEO_MS, estado.sala.comienzaEnMs + 50) : SONDEO_MS;
  estado.sondeo = window.setTimeout(consultar, espera);
}

async function consultar() {
  try {
    atender(await api(`/salas/${estado.id}`));
  } catch (error) {
    if (error.estado === 401) return irAIngreso();
    if (error.estado === 404) return fallar(error.message);
    programar(); // Un corte breve de red no debe tumbar la pantalla proyectada.
  }
}

function irAIngreso() {
  location.replace("acceso.html?modo=ingreso&siguiente=panel");
}

async function accion(ruta) {
  window.clearTimeout(estado.sondeo);
  try {
    atender(await api(`/salas/${estado.id}/${ruta}`, { metodo: "POST", cuerpo: {} }));
  } catch (error) {
    aviso(error.message, "mal");
    programar();
  }
}

window.setInterval(() => {
  if (!estado.sala) return;
  $("#reloj").textContent = formatoTiempo(estado.finMs - performance.now());
}, 250);

$("#empezar").addEventListener("click", () => accion("empezar"));
$("#terminar").addEventListener("click", () => $("#dialogo-terminar").showModal());
$("#terminar-no").addEventListener("click", () => $("#dialogo-terminar").close());
$("#terminar-si").addEventListener("click", () => {
  $("#dialogo-terminar").close();
  accion("terminar");
});
$("#otra-sala").addEventListener("click", () => location.assign(`sala.html?rosco=${estado.sala.roscoId}`));
$("#copiar").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${location.origin}/r/${estado.sala.pin}`);
    aviso("Enlace copiado.", "ok");
  } catch {
    aviso("No se pudo copiar el enlace.", "mal");
  }
});

try {
  const { alias } = await api("/sesion");
  const rosco = parametros.get("rosco");
  if (!alias) {
    irAIngreso();
  } else if (rosco) {
    const { id } = await api("/salas", { metodo: "POST", cuerpo: { roscoId: rosco } });
    estado.id = id;
    history.replaceState(null, "", `sala.html?id=${id}`);
    await consultar();
  } else if (estado.id) {
    await consultar();
  } else {
    fallar("Abrí una sala desde Mis roscos.");
  }
} catch (error) {
  fallar(error.message);
}
