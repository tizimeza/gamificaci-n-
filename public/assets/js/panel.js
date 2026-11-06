import { api, aviso, dibujarRanking, el, icono } from "./api.js";
import { PLANTILLAS } from "./plantillas.js";
import { LETRAS, LIMITES, MATERIAS, revisarRosco } from "./reglas.js";

const $ = (selector) => document.querySelector(selector);
const VISTAS = ["acceso", "recuperacion", "lista", "editor"];
const estado = { modoAcceso: "ingreso", editandoId: null, rankingDe: null };
const contextoClase = new URLSearchParams(location.search);
const claseId = /^[0-9a-f-]{36}$/.test(contextoClase.get('clase') || '') ? contextoClase.get('clase') : null;
if (claseId) $("#volver-clases").href = `clases.html?id=${claseId}`;

function mostrar(vista) {
  VISTAS.forEach((nombre) => $(`#vista-${nombre}`).classList.toggle("hidden", nombre !== vista));
  window.scrollTo(0, 0);
}

function marcarSesion(alias) {
  $("#sesion").classList.toggle("hidden", !alias);
  $("#sesion").classList.toggle("flex", Boolean(alias));
  $("#sesion-alias").textContent = alias ?? "";
}

function confirmar(titulo, texto) {
  const dialogo = $("#dialogo-confirmar");
  $("#confirmar-titulo").textContent = titulo;
  $("#confirmar-texto").textContent = texto;
  dialogo.showModal();
  $("#confirmar-no").focus();
  return new Promise((resolver) => {
    const responder = (valor) => () => {
      dialogo.close();
      $("#confirmar-si").onclick = null;
      $("#confirmar-no").onclick = null;
      resolver(valor);
    };
    $("#confirmar-si").onclick = responder(true);
    $("#confirmar-no").onclick = responder(false);
  });
}

async function copiar(texto, mensaje) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso(mensaje, "ok");
  } catch {
    aviso("No se pudo copiar. Seleccioná el texto y copialo a mano.", "mal");
  }
}

// --- Acceso

function cambiarModoAcceso(modo) {
  estado.modoAcceso = modo;
  const registro = modo === "registro";
  const recuperar = modo === "recuperar";
  $("#acceso-titulo").textContent = { ingreso: "Entrá a tu cuenta", registro: "Creá tu cuenta", recuperar: "Recuperá tu cuenta" }[modo];
  $("#acceso-ayuda").textContent = recuperar ? "Usá el código que guardaste al registrarte." : "Para crear y compartir tus roscos.";
  $("#acceso-enviar").textContent = { ingreso: "Entrar", registro: "Crear cuenta", recuperar: "Cambiar contraseña" }[modo];
  $("#acceso-clave-etiqueta").textContent = recuperar ? "Nueva contraseña" : "Contraseña";
  $("#acceso-clave").autocomplete = modo === "ingreso" ? "current-password" : "new-password";
  $("#acceso-codigo-campo").classList.toggle("hidden", !recuperar);
  $("#acceso-codigo-campo").classList.toggle("block", recuperar);
  $("#acceso-codigo").required = recuperar;
  $("#acceso-privacidad").classList.toggle("hidden", !registro);
  $("#ir-registro").classList.toggle("hidden", modo !== "ingreso");
  $("#ir-recuperar").classList.toggle("hidden", modo !== "ingreso");
  $("#ir-ingreso").classList.toggle("hidden", modo === "ingreso");
  $("#acceso-error").classList.add("hidden");
}

async function enviarAcceso(evento) {
  evento.preventDefault();
  const alias = $("#acceso-alias").value.trim();
  const clave = $("#acceso-clave").value;
  const boton = $("#acceso-enviar");
  boton.disabled = true;
  $("#acceso-error").classList.add("hidden");
  try {
    const modo = estado.modoAcceso;
    const ruta = { ingreso: "/ingreso", registro: "/registro", recuperar: "/recuperar" }[modo];
    const cuerpo = { alias, clave, ...(modo === "recuperar" ? { codigoRecuperacion: $("#acceso-codigo").value } : {}) };
    const datos = await api(ruta, { metodo: "POST", cuerpo });
    $("#acceso-form").reset();
    marcarSesion(datos.alias);
    if (datos.codigoRecuperacion) {
      $("#codigo-recuperacion").textContent = datos.codigoRecuperacion;
      $("#recuperacion-guardado").checked = false;
      $("#recuperacion-seguir").disabled = true;
      mostrar("recuperacion");
    } else {
      await abrirLista();
    }
  } catch (error) {
    $("#acceso-error").textContent = error.message;
    $("#acceso-error").classList.remove("hidden");
  } finally {
    boton.disabled = false;
  }
}

// --- Lista

async function abrirLista() {
  mostrar("lista");
  try {
    dibujarLista((await api("/roscos")).roscos);
  } catch (error) {
    if (error.estado === 401) return irAIngreso();
    aviso(error.message, "mal");
  }
}

function irAIngreso() {
  marcarSesion(null);
  cambiarModoAcceso("ingreso");
  mostrar("acceso");
}

function botonAccion(texto, nombreIcono, alHacerClick, clase = "secondary-btn") {
  const boton = el("button", `${clase} px-3 text-sm`);
  boton.type = "button";
  boton.append(icono(nombreIcono, "mr-2"), texto);
  boton.addEventListener("click", alHacerClick);
  return boton;
}

function dibujarLista(roscos) {
  const lista = $("#lista");
  lista.replaceChildren();
  $("#lista-vacia").classList.toggle("hidden", roscos.length > 0);
  roscos.forEach((rosco) => {
    const tarjeta = el("article", "glass rounded-3xl p-5");
    const cabecera = el("div", "flex items-start justify-between gap-3");
    const textos = el("div", "min-w-0");
    textos.append(el("p", "eyebrow", rosco.materia), el("h2", "display-font mt-1 break-words text-lg font-extrabold", rosco.titulo));
    cabecera.append(textos, el("span", "display-font rounded-lg bg-amber-300/10 px-2 py-1 font-black tracking-wider text-amber-200", rosco.codigo));
    const detalle = el("p", "mt-2 text-sm text-slate-300",
      `${rosco.letras} letras · ${rosco.segundos} segundos · ${rosco.jugadores} ${rosco.jugadores === 1 ? "jugador" : "jugadores"}`);
    const acciones = el("div", "mt-4 flex flex-wrap gap-2");
    acciones.append(
      botonAccion("Compartir", "fa-share-nodes", () => abrirCompartir(rosco.codigo), "primary-btn"),
      botonAccion("Ranking", "fa-trophy", () => abrirRanking(rosco)),
      botonAccion("Editar", "fa-pen", () => abrirEditor(rosco.id)),
      botonAccion("Borrar", "fa-trash", () => borrarRosco(rosco), "danger-btn")
    );
    tarjeta.append(cabecera, detalle, acciones);
    lista.append(tarjeta);
  });
}

function abrirCompartir(codigo) {
  $("#compartir-codigo").textContent = codigo;
  $("#compartir-enlace").value = `${location.origin}/r/${codigo}`;
  $("#dialogo-compartir").showModal();
}

async function abrirRanking(rosco) {
  estado.rankingDe = rosco;
  $("#ranking-titulo").textContent = `Ranking: ${rosco.titulo}`;
  $("#dialogo-ranking").showModal();
  try {
    dibujarRanking($("#ranking-lista"), (await api(`/r/${rosco.codigo}/ranking`)).ranking);
  } catch (error) {
    aviso(error.message, "mal");
  }
}

async function borrarRosco(rosco) {
  if (!await confirmar(`¿Borrar "${rosco.titulo}"?`, "Se borran también su ranking y el enlace deja de funcionar. No se puede deshacer.")) return;
  try {
    await api(`/roscos/${rosco.id}`, { metodo: "DELETE" });
    aviso("Rosco borrado.", "ok");
    await abrirLista();
  } catch (error) {
    aviso(error.message, "mal");
  }
}

// --- Editor

function letraLibre() {
  const usadas = new Set([...document.querySelectorAll(".fila-letra")].map((campo) => campo.value));
  return LETRAS.find((letra) => !usadas.has(letra)) ?? "";
}

function agregarFila(entrada = {}) {
  const fila = el("div", "glass fila-rosco grid gap-3 rounded-2xl p-3 md:grid-cols-[5rem_1fr_2fr_auto] md:items-start");
  const letra = el("select", "fila-letra form-field min-h-11 px-2 font-black");
  letra.setAttribute("aria-label", "Letra");
  LETRAS.forEach((opcion) => letra.append(new Option(opcion, opcion)));
  letra.value = entrada.letra ?? letraLibre();

  const textos = el("div", "space-y-2");
  const palabra = el("input", "fila-palabra form-field block min-h-11 w-full px-3");
  palabra.placeholder = "Palabra";
  palabra.setAttribute("aria-label", "Palabra respuesta");
  palabra.maxLength = LIMITES.palabra;
  palabra.value = entrada.palabra ?? "";
  const alternativas = el("input", "fila-alternativas form-field block min-h-11 w-full px-3 text-sm");
  alternativas.placeholder = "Otras respuestas válidas";
  alternativas.setAttribute("aria-label", "Otras respuestas válidas, separadas por comas");
  alternativas.value = (entrada.alternativas ?? []).join(", ");
  textos.append(palabra, alternativas);

  const definicion = el("textarea", "fila-definicion form-field block min-h-[6.25rem] w-full resize-y px-3 py-2");
  definicion.placeholder = "Definición, sin nombrar la palabra";
  definicion.setAttribute("aria-label", "Definición");
  definicion.maxLength = LIMITES.definicion;
  definicion.value = entrada.definicion ?? "";

  const quitar = el("button", "danger-btn px-3 text-sm");
  quitar.type = "button";
  quitar.setAttribute("aria-label", "Quitar esta letra");
  quitar.append(icono("fa-trash"));
  quitar.addEventListener("click", () => { fila.remove(); actualizarContador(); });

  fila.append(letra, textos, definicion, quitar);
  $("#filas").append(fila);
  actualizarContador();
}

function actualizarContador() {
  const cantidad = document.querySelectorAll(".fila-rosco").length;
  $("#contador").textContent = `(${cantidad} de ${LIMITES.entradasMax})`;
  $("#agregar").disabled = cantidad >= LIMITES.entradasMax;
}

function cargarEditor({ titulo = "", materia = MATERIAS[0], segundos = LIMITES.segundosPorDefecto, entradas = [] }) {
  $("#campo-titulo").value = titulo;
  $("#campo-materia").value = materia;
  $("#campo-segundos").value = segundos;
  $("#filas").replaceChildren();
  entradas.forEach(agregarFila);
  $("#editor-errores").classList.add("hidden");
  actualizarContador();
}

async function abrirEditor(id = null) {
  estado.editandoId = id;
  $("#editor-titulo").textContent = id ? "Editar rosco" : "Nuevo rosco";
  $("#plantilla-campo").classList.toggle("hidden", Boolean(id));
  $("#campo-plantilla").value = "";
  if (id) {
    try {
      cargarEditor(await api(`/roscos/${id}`));
    } catch (error) {
      aviso(error.message, "mal");
      return;
    }
  } else {
    cargarEditor({});
    for (let i = 0; i < LIMITES.entradasMin; i += 1) agregarFila();
  }
  mostrar("editor");
}

function leerEditor() {
  return {
    titulo: $("#campo-titulo").value,
    materia: $("#campo-materia").value,
    segundos: Number($("#campo-segundos").value),
    entradas: [...document.querySelectorAll(".fila-rosco")].map((fila) => ({
      letra: fila.querySelector(".fila-letra").value,
      palabra: fila.querySelector(".fila-palabra").value,
      definicion: fila.querySelector(".fila-definicion").value,
      alternativas: fila.querySelector(".fila-alternativas").value.split(",")
    }))
  };
}

function mostrarErrores(errores) {
  const lista = $("#editor-errores");
  lista.replaceChildren(...errores.slice(0, 6).map(({ mensaje }) => el("li", "", mensaje)));
  if (errores.length > 6) lista.append(el("li", "", `Y ${errores.length - 6} problemas más.`));
  lista.classList.remove("hidden");
  const filas = [...document.querySelectorAll(".fila-rosco")];
  filas.forEach((fila) => fila.classList.remove("fila-error"));
  errores.forEach(({ fila }) => { if (fila !== null) filas[fila]?.classList.add("fila-error"); });
  lista.scrollIntoView({ block: "center" });
}

async function guardar(evento) {
  evento.preventDefault();
  const datos = leerEditor();
  const { errores, rosco } = revisarRosco(datos);
  if (errores.length) return mostrarErrores(errores);
  const boton = $("#guardar");
  boton.disabled = true;
  try {
    const nuevo = !estado.editandoId;
    const respuesta = nuevo
      ? await api("/roscos", { metodo: "POST", cuerpo: rosco })
      : await api(`/roscos/${estado.editandoId}`, { metodo: "PUT", cuerpo: rosco });
    aviso("Rosco guardado.", "ok");
    if (nuevo && claseId) {
      try {
        await api(`/clases/${claseId}/roscos`, { metodo: 'POST', cuerpo: { roscoId: respuesta.id } });
        location.assign(`clases.html?id=${claseId}`);
        return;
      } catch (error) {
        aviso(`El rosco se guardó. No se pudo asignar a la clase: ${error.message}`, 'mal');
      }
    }
    await abrirLista();
    if (nuevo) abrirCompartir(respuesta.codigo);
  } catch (error) {
    mostrarErrores(error.datos?.errores ?? [{ mensaje: error.message, fila: null }]);
  } finally {
    boton.disabled = false;
  }
}

// --- Eventos

$("#acceso-form").addEventListener("submit", enviarAcceso);
$("#ir-registro").addEventListener("click", () => cambiarModoAcceso("registro"));
$("#ir-ingreso").addEventListener("click", () => cambiarModoAcceso("ingreso"));
$("#ir-recuperar").addEventListener("click", () => cambiarModoAcceso("recuperar"));
$("#copiar-recuperacion").addEventListener("click", () => copiar($("#codigo-recuperacion").textContent, "Código copiado."));
$("#recuperacion-guardado").addEventListener("change", (evento) => { $("#recuperacion-seguir").disabled = !evento.target.checked; });
$("#recuperacion-seguir").addEventListener("click", () => {
  $("#codigo-recuperacion").textContent = "";
  abrirLista();
});
$("#salir").addEventListener("click", async () => {
  await api("/salir", { metodo: "POST", cuerpo: {} }).catch(() => {});
  irAIngreso();
});
$("#nuevo").addEventListener("click", () => abrirEditor());
$("#editor-volver").addEventListener("click", abrirLista);
$("#editor").addEventListener("submit", guardar);
$("#agregar").addEventListener("click", () => agregarFila());
$("#campo-plantilla").addEventListener("change", (evento) => {
  const plantilla = PLANTILLAS[evento.target.value];
  if (plantilla) cargarEditor(plantilla);
});
$("#compartir-cerrar").addEventListener("click", () => $("#dialogo-compartir").close());
$("#compartir-copiar").addEventListener("click", () => copiar($("#compartir-enlace").value, "Enlace copiado."));
$("#ranking-cerrar").addEventListener("click", () => $("#dialogo-ranking").close());
$("#ranking-borrar").addEventListener("click", async () => {
  const rosco = estado.rankingDe;
  $("#dialogo-ranking").close();
  if (!await confirmar("¿Reiniciar el ranking?", "Se borran todos los resultados de este rosco. No se puede deshacer.")) return;
  try {
    await api(`/roscos/${rosco.id}/ranking`, { metodo: "DELETE" });
    aviso("Ranking reiniciado.", "ok");
    await abrirLista();
  } catch (error) {
    aviso(error.message, "mal");
  }
});

MATERIAS.forEach((materia) => $("#campo-materia").append(new Option(materia, materia)));
$("#campo-plantilla").append(new Option("Sin plantilla", ""));
PLANTILLAS.forEach((plantilla, indice) => $("#campo-plantilla").append(new Option(plantilla.nombre, String(indice))));

const { alias } = await api("/sesion").catch(() => ({ alias: null }));
if (alias) {
  marcarSesion(alias);
  await abrirLista();
  if (contextoClase.get('nuevo') === '1') {
    await abrirEditor();
    if (MATERIAS.includes(contextoClase.get('materia'))) $("#campo-materia").value = contextoClase.get('materia');
  }
} else {
  irAIngreso();
}
