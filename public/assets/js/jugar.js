import { api, aviso, dibujarRanking, el, formatoTiempo, icono } from "./api.js";
import { generarSeudonimo } from "./seudonimos.js";

const $ = (selector) => document.querySelector(selector);
const VISTAS = ["codigo", "inicio", "espera", "juego", "final"];
const CADA_RANKING_MS = 5000;
const SONDEO_ESPERA_MS = 2000;
const SONDEO_JUEGO_MS = 4000;
const codigo = new URLSearchParams(location.search).get("c")?.trim().toUpperCase() ?? "";

const estado = {
  info: null, seudonimo: null, token: null, items: [], respuestas: {}, actual: null,
  finMs: 0, reloj: null, ocupado: false, sondeo: null,
  sala: null, tokenSala: null, enCuenta: false, salaCerrada: false
};

function idJugador() {
  try {
    let id = localStorage.getItem("roscolab:jugador");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("roscolab:jugador", id);
    }
    return id;
  } catch {
    estado.idTemporal ??= crypto.randomUUID();
    return estado.idTemporal;
  }
}

const encabezadoJugador = () => ({ "x-jugador": idJugador() });

function mostrar(vista) {
  VISTAS.forEach((nombre) => $(`#vista-${nombre}`).classList.toggle("hidden", nombre !== vista));
  $("#vista-juego").classList.toggle("grid", vista === "juego");
  $("#reloj-caja").classList.toggle("hidden", vista !== "juego");
  $("#reloj-caja").classList.toggle("flex", vista === "juego");
  window.scrollTo(0, 0);
}

function mostrarErrorInicio(mensaje) {
  $("#inicio-error").textContent = mensaje;
  $("#inicio-error").classList.remove("hidden");
}

async function actualizarRanking(contenedor) {
  if (estado.sala) {
    dibujarRanking(contenedor, estado.sala.tabla);
    return;
  }
  try {
    const { ranking } = await api(`/r/${codigo}/ranking`, { encabezados: encabezadoJugador() });
    dibujarRanking(contenedor, ranking);
  } catch {
    // Un sondeo fallido no interrumpe nada: se reintenta en el siguiente ciclo.
  }
}

// --- Inicio

function ofrecerSeudonimos() {
  const opciones = new Set();
  while (opciones.size < 3) opciones.add(generarSeudonimo());
  estado.seudonimo = null;
  $("#empezar").disabled = true;
  const contenedor = $("#seudonimos");
  contenedor.replaceChildren();
  opciones.forEach((seudonimo) => {
    const boton = el("button", "secondary-btn px-3 py-2 text-sm", seudonimo);
    boton.setAttribute("aria-pressed", "false");
    boton.addEventListener("click", () => {
      estado.seudonimo = seudonimo;
      contenedor.querySelectorAll("button").forEach((item) => {
        const elegido = item === boton;
        item.setAttribute("aria-pressed", String(elegido));
        item.classList.toggle("ring-2", elegido);
        item.classList.toggle("ring-amber-300", elegido);
      });
      $("#empezar").disabled = false;
    });
    contenedor.append(boton);
  });
}

async function abrirInicio() {
  if (!/^[A-Za-z0-9]{6}$/.test(codigo)) {
    mostrar("codigo");
    if (codigo) mostrarCodigoInvalido("Ese código no es válido.");
    return;
  }
  // Salas y roscos usan el mismo campo de código.
  const sala = await api(`/sala/${codigo}`, { encabezados: encabezadoJugador() }).catch((error) => {
    if (error.estado === 404) return null;
    throw error;
  }).catch((error) => {
    mostrar("codigo");
    mostrarCodigoInvalido(error.message);
    return undefined;
  });
  if (sala === undefined) return;
  if (sala) return abrirSala(sala);
  try {
    estado.info = await api(`/r/${codigo}`);
  } catch (error) {
    mostrar("codigo");
    mostrarCodigoInvalido(error.message);
    return;
  }
  const { titulo, materia, letras, segundos } = estado.info;
  document.title = `${titulo} | RoscoLab`;
  $("#inicio-materia").textContent = materia;
  $("#inicio-titulo").textContent = titulo;
  $("#inicio-detalle").textContent = `${letras.length} letras · ${formatoTiempo(segundos * 1000)} minutos para completarlo. Si errás una letra, no vuelve.`;
  ofrecerSeudonimos();
  mostrar("inicio");
  await actualizarRanking($("#inicio-ranking"));
}

function mostrarCodigoInvalido(mensaje) {
  $("#codigo-error").textContent = mensaje;
  $("#codigo-error").classList.remove("hidden");
}

async function empezar() {
  $("#empezar").disabled = true;
  $("#inicio-error").classList.add("hidden");
  if (estado.sala) return unirseASala();
  try {
    const partida = await api(`/r/${codigo}/intentos`, {
      metodo: "POST", cuerpo: { jugador: idJugador(), seudonimo: estado.seudonimo }
    });
    if (partida.seudonimo !== estado.seudonimo) aviso(`Retomamos tu partida como ${partida.seudonimo}.`);
    cargarPartida(partida);
  } catch (error) {
    mostrarErrorInicio(error.message);
    $("#empezar").disabled = false;
  }
}

// --- Sala en vivo

function abrirSala(sala) {
  estado.sala = sala;
  document.title = `${sala.titulo} | RoscoLab`;
  if (sala.seudonimo) return entrarEnSala(sala);
  if (sala.estado === "terminada") {
    mostrar("codigo");
    mostrarCodigoInvalido("Esta sala ya terminó.");
    return;
  }
  $("#inicio-materia").textContent = `Sala en vivo · ${sala.materia}`;
  $("#inicio-titulo").textContent = sala.titulo;
  $("#inicio-detalle").textContent = `${sala.letras} letras · ${formatoTiempo(sala.segundos * 1000)} minutos. Todos arrancan al mismo tiempo. Si errás una letra, no vuelve.`;
  $("#inicio-ranking").parentElement.classList.add("hidden");
  $("#empezar").textContent = "Entrar a la sala";
  ofrecerSeudonimos();
  mostrar("inicio");
}

async function unirseASala() {
  try {
    await api(`/sala/${codigo}/unirme`, { metodo: "POST", cuerpo: { jugador: idJugador(), seudonimo: estado.seudonimo } });
    entrarEnSala(await api(`/sala/${codigo}`, { encabezados: encabezadoJugador() }));
  } catch (error) {
    mostrarErrorInicio(error.message);
    if (error.estado === 409) ofrecerSeudonimos();
    else $("#empezar").disabled = false;
  }
}

function entrarEnSala(sala) {
  $("#espera-titulo").textContent = sala.titulo;
  $("#espera-yo").textContent = sala.seudonimo;
  mostrar("espera");
  atenderSala(sala);
}

function programarSondeo(espera) {
  window.clearTimeout(estado.sondeo);
  estado.sondeo = window.setTimeout(async () => {
    try {
      atenderSala(await api(`/sala/${codigo}`, { encabezados: encabezadoJugador() }));
    } catch {
      programarSondeo(espera); // Un corte breve de red no saca a nadie de la sala.
    }
  }, espera);
}

function dibujarTablaSala(sala) {
  const yo = sala.tabla.find((fila) => fila.soyYo);
  $("#vivo-posicion").classList.toggle("hidden", !yo?.aciertos);
  if (yo) $("#vivo-posicion").textContent = `Vas en el puesto ${yo.posicion} de ${sala.jugadores}`;
  $("#espera-tabla-caja").classList.toggle("hidden", sala.estado === "espera");
  dibujarRanking($("#espera-tabla"), sala.tabla);
}

function atenderSala(sala) {
  estado.sala = sala;
  dibujarTablaSala(sala);
  if (sala.estado === "espera") {
    $("#espera-texto").textContent = `Ya entraste. Son ${sala.jugadores} en la sala; falta que empiece.`;
    return programarSondeo(SONDEO_ESPERA_MS);
  }
  if (sala.estado === "terminada") return cerrarSala(sala);
  if (estado.token || estado.tokenSala) {
    if (!estado.token) $("#espera-texto").textContent = "Terminaste. Esperando al resto; el repaso aparece cuando cierre la sala.";
    return programarSondeo(SONDEO_JUEGO_MS);
  }
  if (sala.comienzaEnMs > 0) return cuentaRegresiva(sala.comienzaEnMs);
  abrirPartidaDeSala();
}

function cuentaRegresiva(ms) {
  if (estado.enCuenta) return;
  estado.enCuenta = true;
  const fin = performance.now() + ms;
  const caja = $("#espera-cuenta");
  caja.classList.remove("hidden");
  $("#espera-texto").textContent = "¡Prepará los dedos!";
  const paso = () => {
    const restante = fin - performance.now();
    if (restante > 0) {
      caja.textContent = String(Math.ceil(restante / 1000));
      window.setTimeout(paso, 100);
      return;
    }
    caja.classList.add("hidden");
    estado.enCuenta = false;
    abrirPartidaDeSala();
  };
  paso();
}

async function abrirPartidaDeSala() {
  try {
    const partida = await api(`/sala/${codigo}/partida`, { metodo: "POST", cuerpo: { jugador: idJugador() } });
    estado.tokenSala = partida.token;
    if (partida.terminada) {
      estado.token = partida.token;
      await terminar();
    } else {
      cargarPartida(partida);
    }
    programarSondeo(SONDEO_JUEGO_MS);
  } catch (error) {
    if (error.datos?.todaviaNo || error.estado === 0) {
      window.setTimeout(abrirPartidaDeSala, 500);
      return;
    }
    aviso(error.message, "mal");
    programarSondeo(SONDEO_ESPERA_MS);
  }
}

// Al cerrar la sala llegan el repaso y el marcador final.
async function cerrarSala(sala) {
  if (estado.salaCerrada) return;
  estado.salaCerrada = true;
  window.clearTimeout(estado.sondeo);
  window.clearInterval(estado.reloj);
  $("#espera-texto").textContent = "La sala terminó.";
  // Tras recargar la página la referencia se pierde: la partida sigue guardada en el servidor.
  const token = estado.tokenSala ?? estado.token ?? await api(`/sala/${codigo}/partida`, {
    metodo: "POST", cuerpo: { jugador: idJugador() }
  }).then((partida) => partida.token).catch(() => null);
  if (!token) {
    mostrar("espera");
    $("#espera-tabla-caja").classList.remove("hidden");
    return;
  }
  estado.token = token;
  await terminar();
}

// --- Partida

function cargarPartida(partida) {
  estado.token = partida.token;
  estado.items = partida.items;
  estado.respuestas = partida.respuestas;
  estado.finMs = performance.now() + partida.restanteMs;
  estado.actual = null;
  mostrar("juego");
  avanzar();
  window.clearInterval(estado.reloj);
  estado.reloj = window.setInterval(tic, 250);
  tic();
}

function tic() {
  const restante = estado.finMs - performance.now();
  $("#reloj").textContent = formatoTiempo(restante);
  $("#reloj").classList.toggle("text-rose-300", restante <= 15000);
  if (restante <= 0) terminar();
}

const pendientes = () => estado.items.filter((item) => !estado.respuestas[item.pos]);

// Sigue el orden de la rueda y vuelve a las letras pasadas al completar la vuelta.
function avanzar() {
  const lista = pendientes();
  const siguiente = lista.find((item) => item.pos > (estado.actual ?? -1)) ?? lista[0];
  if (!siguiente) return;
  estado.actual = siguiente.pos;
  dibujarRosco();
  $("#pista-letra").textContent = `${siguiente.modo === "empieza" ? "Empieza con" : "Contiene la"} ${siguiente.letra}`;
  $("#definicion").textContent = siguiente.definicion;
  $("#respuesta").value = "";
  $("#respuesta").focus();
  $("#pasar").disabled = lista.length === 1;
  $("#progreso").textContent = `${estado.items.length - lista.length} de ${estado.items.length} respondidas`;
}

function dibujarRosco() {
  const rosco = $("#rosco");
  const total = estado.items.length;
  rosco.style.setProperty("--nodo", total > 20 ? "30px" : "38px");
  const centro = el("div", "rosco-center");
  const item = estado.items.find(({ pos }) => pos === estado.actual);
  centro.append(el("span", "center-letter", item?.letra ?? ""));
  const nodos = estado.items.map(({ pos, letra }, indice) => {
    const angulo = (2 * Math.PI * indice / total) - Math.PI / 2;
    const resultado = estado.respuestas[pos];
    const clase = resultado === "correcta" ? " solved" : resultado === "incorrecta" ? " revealed" : pos === estado.actual ? " active" : "";
    const nodo = el("span", `rosco-node${clase}`, letra);
    nodo.style.left = `${50 + 45 * Math.cos(angulo)}%`;
    nodo.style.top = `${50 + 45 * Math.sin(angulo)}%`;
    const descripcion = { correcta: "correcta", incorrecta: "incorrecta" }[resultado] ?? (pos === estado.actual ? "actual" : "pendiente");
    nodo.setAttribute("role", "img");
    nodo.setAttribute("aria-label", `Letra ${letra}, ${descripcion}`);
    return nodo;
  });
  rosco.replaceChildren(centro, ...nodos);
}

async function responder(evento) {
  evento.preventDefault();
  const respuesta = $("#respuesta").value.trim();
  if (!respuesta || estado.ocupado) return;
  estado.ocupado = true;
  $("#responder").disabled = true;
  const pos = estado.actual;
  try {
    const datos = await api(`/intentos/${estado.token}/responder`, { metodo: "POST", cuerpo: { pos, respuesta } });
    if (datos.correcta !== undefined) {
      estado.respuestas[pos] = datos.correcta ? "correcta" : "incorrecta";
      aviso(datos.correcta ? "¡Correcto!" : "Incorrecto.", datos.correcta ? "ok" : "mal");
    }
    if (datos.terminado) mostrarFinal(datos.resultado);
    else avanzar();
  } catch (error) {
    aviso(error.message, "mal");
    if (error.estado === 409) await terminar();
  } finally {
    estado.ocupado = false;
    $("#responder").disabled = false;
  }
}

async function terminar() {
  window.clearInterval(estado.reloj);
  if (!estado.token) return;
  const token = estado.token;
  estado.token = null;
  try {
    const { resultado } = await api(`/intentos/${token}/terminar`, { metodo: "POST", cuerpo: {} });
    mostrarFinal(resultado);
  } catch (error) {
    estado.token = token;
    aviso(error.message, "mal");
    estado.reloj = window.setTimeout(terminar, 3000);
  }
}

// --- Final

function mostrarFinal(resultado) {
  window.clearInterval(estado.reloj);
  estado.token = null;
  if (resultado.salaAbierta) {
    $("#espera-texto").textContent = "Terminaste. Esperando al resto; el repaso aparece cuando cierre la sala.";
    $("#espera-yo").textContent = `${resultado.aciertos} de ${resultado.total} correctas`;
    mostrar("espera");
    programarSondeo(0); // El marcador en pantalla es del último ciclo: se trae el puntaje recién cerrado.
    return;
  }
  $("#final-puntaje").textContent = `${resultado.aciertos} / ${resultado.total}`;
  $("#final-detalle").textContent = `${resultado.errores} ${resultado.errores === 1 ? "error" : "errores"} · ${formatoTiempo(resultado.duracionMs)}`;
  const iconos = {
    correcta: ["fa-circle-check", "text-emerald-300"],
    incorrecta: ["fa-circle-xmark", "text-rose-300"],
    "sin-responder": ["fa-circle-minus", "text-slate-400"]
  };
  $("#correcciones").replaceChildren(...resultado.correcciones.map(({ letra, palabra, definicion, estado: situacion }) => {
    const item = el("li", "flex gap-3 rounded-xl bg-white/[.04] p-3 text-sm");
    const textos = el("div", "min-w-0");
    textos.append(el("p", "font-extrabold", `${letra}: ${palabra}`), el("p", "mt-0.5 text-slate-300", definicion));
    item.append(icono(iconos[situacion][0], `mt-0.5 ${iconos[situacion][1]}`), textos);
    return item;
  }));
  mostrar("final");
  actualizarRanking($("#final-ranking"));
  if (estado.sala) {
    ["#otra-vez", "#compartir", "#final-vivo"].forEach((selector) => $(selector).classList.add("hidden"));
    return;
  }
  window.clearInterval(estado.sondeo);
  estado.sondeo = window.setInterval(() => {
    if (!document.hidden) actualizarRanking($("#final-ranking"));
  }, CADA_RANKING_MS);
}

// --- Eventos

$("#otros-seudonimos").addEventListener("click", ofrecerSeudonimos);
$("#empezar").addEventListener("click", empezar);
$("#respuesta-form").addEventListener("submit", responder);
$("#pasar").addEventListener("click", avanzar);
$("#abandonar").addEventListener("click", terminar);
$("#otra-vez").addEventListener("click", () => location.reload());
$("#compartir").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${location.origin}/r/${codigo}`);
    aviso("Enlace copiado.", "ok");
  } catch {
    aviso("No se pudo copiar el enlace.", "mal");
  }
});

await abrirInicio();
