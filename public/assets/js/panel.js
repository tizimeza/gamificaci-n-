import { api, aviso, dibujarRanking, el, icono } from "./api.js";
import { PLANTILLAS } from "./plantillas.js";
import { LETRAS, LIMITES, revisarRosco, normalizar } from "./reglas.js";
import { cargarMaterias, crearPersonaje } from './materias.js';
let MATERIAS = [];
let catalogoMaterias = [];

const $ = (selector) => document.querySelector(selector);
const VISTAS = ["lista", "editor"];
const estado = { editandoId: null, rankingDe: null, roscos: [], rol: null, asignando: null, origen: null };
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

// --- Lista

async function abrirLista() {
  mostrar("lista");
  try {
    estado.roscos = (await api("/roscos")).roscos;
    filtrarBiblioteca();
  } catch (error) {
    if (error.estado === 401) return irAIngreso();
    aviso(error.message, "mal");
  }
}

// El ingreso y el registro viven solo en acceso.html.
function irAIngreso() {
  location.replace("acceso.html?modo=ingreso&siguiente=panel");
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
  const total = estado.roscos.length;
  $("#lista-vacia").classList.toggle("hidden", total > 0);
  $('#biblioteca-filtros').classList.toggle('hidden', total === 0);
  $('#biblioteca-sin-resultados').classList.toggle('hidden', total === 0 || roscos.length > 0);
  $('#biblioteca-contador').textContent = total ? `${roscos.length} de ${total} ${total === 1 ? 'rosco guardado' : 'roscos guardados'}` : '';
  roscos.forEach((rosco) => {
    const tarjeta = el("article", "glass library-card rounded-3xl p-5");
    tarjeta.dataset.roscoId = rosco.id;
    const cabecera = el("div", "library-card-heading");
    const avatar = crearPersonaje(catalogoMaterias.find(m => m.nombre === rosco.materia), 'library-avatar');
    avatar.querySelector('img').loading = 'lazy';
    const textos = el("div", "min-w-0");
    textos.append(el("p", "eyebrow", rosco.materia), el("h2", "display-font mt-1 break-words text-lg font-extrabold", rosco.titulo));
    textos.append(el('span', 'library-code', `Código: ${rosco.codigo}`));
    cabecera.append(avatar, textos);
    const detalle = el("p", "mt-2 text-sm text-slate-300",
      `${rosco.letras} letras · ${rosco.segundos} segundos · ${rosco.jugadores} ${rosco.jugadores === 1 ? "jugador" : "jugadores"}`);
    const acciones = el('div', 'library-main-actions');
    const jugar = el('a', 'primary-btn', 'Jugar'); jugar.href = `jugar.html?c=${rosco.codigo}`;
    const plantilla = botonAccion('Usar como plantilla', 'fa-copy', () => crearDesdeRosco(rosco.id), 'secondary-btn library-reuse');
    plantilla.disabled = !MATERIAS.length;
    acciones.append(jugar, plantilla);
    const secundarias = el('div', 'library-sub-actions');
    secundarias.append(botonAccion('Sala en vivo', 'fa-tower-broadcast', () => location.assign(`sala.html?rosco=${rosco.id}`)));
    if (estado.rol === 'docente') secundarias.append(botonAccion('Usar en una clase', 'fa-chalkboard-user', () => abrirAsignar(rosco)));
    const mas = el('details', 'library-more'); mas.append(el('summary', '', 'Más acciones'));
    const menu = el('div');
    menu.append(
      botonAccion("Compartir", "fa-share-nodes", () => abrirCompartir(rosco.codigo)),
      botonAccion("Ranking", "fa-trophy", () => abrirRanking(rosco)),
      botonAccion("Editar", "fa-pen", () => abrirEditor(rosco.id)),
      botonAccion("Borrar", "fa-trash", () => borrarRosco(rosco), "danger-btn")
    );
    mas.append(menu); secundarias.append(mas);
    const actualizado = Number(rosco.actualizado);
    const fecha = Number.isFinite(actualizado) && actualizado > 0 ? el('p', 'library-date', `Último cambio: ${new Intl.DateTimeFormat('es-AR', {day:'numeric',month:'short',year:'numeric'}).format(actualizado)}`) : null;
    tarjeta.append(cabecera, detalle, acciones, secundarias);
    if (fecha) tarjeta.append(fecha);
    lista.append(tarjeta);
  });
}

function filtrarBiblioteca() {
  const consulta = normalizar($('#biblioteca-buscar').value), materia = $('#biblioteca-materia').value;
  const roscos = estado.roscos.filter(r => (!materia || r.materia === materia) && (!consulta || normalizar(`${r.titulo} ${r.materia}`).includes(consulta)));
  const orden = $('#biblioteca-orden').value;
  roscos.sort(orden === 'titulo' ? (a,b) => a.titulo.localeCompare(b.titulo, 'es', {sensitivity:'base'}) : orden === 'letras' ? (a,b) => b.letras-a.letras || b.actualizado-a.actualizado : (a,b) => b.actualizado-a.actualizado);
  dibujarLista(roscos);
}

async function crearDesdeRosco(id) {
  try { await abrirEditor(null, await api(`/roscos/${id}`)); }
  catch (error) { aviso(error.message, 'mal'); }
}

async function abrirAsignar(rosco) {
  estado.asignando = rosco;
  $('#asignar-descripcion').textContent = `«${rosco.titulo}» conserva su código y sus preguntas. También puede estar en otras clases.`;
  $('#asignar-error').textContent = '';
  $('#asignar-clase').replaceChildren(new Option('Cargando clases…', ''));
  $('#asignar-guardar').disabled = true;
  $('#asignar-sin-clases').classList.add('hidden');
  $('#dialogo-asignar').showModal();
  try {
    const {clases} = await api('/clases');
    $('#asignar-clase').replaceChildren(new Option('Elegí una clase', ''));
    clases.forEach(clase => $('#asignar-clase').append(new Option(`${clase.nombre} · ${clase.materia}`, clase.id)));
    $('#asignar-sin-clases').classList.toggle('hidden', clases.length > 0);
    $('#asignar-guardar').disabled = clases.length === 0;
  } catch (error) { $('#asignar-error').textContent = error.message; }
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

async function abrirEditor(id = null, base = null) {
  estado.editandoId = id;
  estado.origen = !id && base ? base.titulo : null;
  $("#editor-titulo").textContent = id ? "Editar rosco" : base ? 'Crear desde plantilla' : "Nuevo rosco";
  $('#guardar').textContent = id ? 'Guardar cambios' : base ? 'Guardar como nuevo rosco' : 'Guardar rosco';
  $('#editor-origen').classList.toggle('hidden', !base);
  $('#editor-origen').textContent = base ? `Partís de «${base.titulo}». Podés cambiar las preguntas, la materia y el tiempo. Al guardar se crea un rosco independiente con código y ranking propios; el original se conserva.` : '';
  $("#plantilla-campo").classList.toggle("hidden", Boolean(id || base));
  $("#campo-plantilla").value = "";
  if (id) {
    try {
      cargarEditor(await api(`/roscos/${id}`));
    } catch (error) {
      aviso(error.message, "mal");
      return;
    }
  } else if (base) {
    cargarEditor({...base, titulo: `Copia de ${base.titulo}`.slice(0, LIMITES.titulo)});
  } else {
    cargarEditor({});
    for (let i = 0; i < LIMITES.entradasMin; i += 1) agregarFila();
  }
  mostrar("editor");
  $('#campo-titulo').focus();
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
  const { errores, rosco } = revisarRosco(datos, MATERIAS);
  if (errores.length) return mostrarErrores(errores);
  const boton = $("#guardar");
  boton.disabled = true;
  try {
    const nuevo = !estado.editandoId;
    const respuesta = nuevo
      ? await api("/roscos", { metodo: "POST", cuerpo: rosco })
      : await api(`/roscos/${estado.editandoId}`, { metodo: "PUT", cuerpo: rosco });
    aviso("Rosco guardado.", "ok");
    if (nuevo) {
      $('#biblioteca-buscar').value = '';
      $('#biblioteca-materia').value = '';
      $('#biblioteca-orden').value = 'recientes';
    }
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

$("#salir").addEventListener("click", async () => {
  await api("/salir", { metodo: "POST", cuerpo: {} }).catch(() => {});
  location.assign("/");
});
$("#nuevo").addEventListener("click", () => abrirEditor());
$("#editor-volver").addEventListener("click", abrirLista);
$("#editor").addEventListener("submit", guardar);
$("#agregar").addEventListener("click", () => agregarFila());
$('#biblioteca-buscar').addEventListener('input', filtrarBiblioteca);
$('#biblioteca-materia').addEventListener('change', filtrarBiblioteca);
$('#biblioteca-orden').addEventListener('change', filtrarBiblioteca);
$('#biblioteca-limpiar').addEventListener('click', () => { $('#biblioteca-buscar').value = ''; $('#biblioteca-materia').value = ''; filtrarBiblioteca(); $('#biblioteca-buscar').focus(); });
$('#asignar-cerrar').addEventListener('click', () => $('#dialogo-asignar').close());
$('#asignar-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!estado.asignando) return;
  $('#asignar-error').textContent = ''; $('#asignar-guardar').disabled = true;
  try {
    await api(`/clases/${$('#asignar-clase').value}/roscos`, {metodo:'POST', cuerpo:{roscoId:estado.asignando.id}});
    $('#dialogo-asignar').close(); aviso('Rosco asignado a la clase.', 'ok');
  } catch (error) { $('#asignar-error').textContent = error.message; }
  finally { $('#asignar-guardar').disabled = false; }
});
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

try {
  catalogoMaterias = await cargarMaterias();
  MATERIAS = catalogoMaterias.map(m => m.nombre);
} catch (error) {
  aviso(error.message, 'mal');
  $('#nuevo').disabled = true;
  $('#guardar').disabled = true;
}
MATERIAS.forEach((materia) => $("#campo-materia").append(new Option(materia, materia)));
MATERIAS.forEach(materia => $('#biblioteca-materia').append(new Option(materia, materia)));
$("#campo-plantilla").append(new Option("Sin plantilla", ""));
PLANTILLAS.forEach((plantilla, indice) => $("#campo-plantilla").append(new Option(plantilla.nombre, String(indice))));

const { alias, rol } = await api("/sesion").catch(() => ({ alias: null }));
estado.rol = rol;
if (alias) {
  marcarSesion(alias);
  await abrirLista();
  if (contextoClase.get('nuevo') === '1' && MATERIAS.length) {
    await abrirEditor();
    if (MATERIAS.includes(contextoClase.get('materia'))) $("#campo-materia").value = contextoClase.get('materia');
  }
} else {
  irAIngreso();
}
