export class ErrorApi extends Error {
  constructor(estado, datos) {
    super(datos?.error ?? "Algo salió mal. Probá de nuevo.");
    this.estado = estado;
    this.datos = datos;
  }
}

export async function api(ruta, { metodo = "GET", cuerpo, encabezados = {} } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...encabezados },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new ErrorApi(0, { error: "No hay conexión. Revisá internet y probá de nuevo." });
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos);
  return datos;
}

// Crea nodos con textContent: títulos y definiciones los escriben otras personas.
export function el(etiqueta, clases = "", texto) {
  const nodo = document.createElement(etiqueta);
  if (clases) nodo.className = clases;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

export function icono(nombre, clases = "") {
  const nodo = el("i", `fa-solid ${nombre} ${clases}`);
  nodo.setAttribute("aria-hidden", "true");
  return nodo;
}

export function aviso(mensaje, tono = "info") {
  const colores = {
    info: "border-blue-300/20 text-blue-100",
    ok: "border-emerald-300/25 text-emerald-100",
    mal: "border-rose-300/30 text-rose-100"
  };
  const item = el("div", `rounded-xl border bg-slate-900 px-4 py-3 text-sm font-bold shadow-2xl ${colores[tono]}`, mensaje);
  document.querySelector("#avisos").append(item);
  window.setTimeout(() => item.remove(), 3200);
}

export const formatoTiempo = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function dibujarRanking(contenedor, filas) {
  contenedor.replaceChildren();
  if (!filas.length) {
    contenedor.append(el("p", "py-3 text-sm text-slate-400", "Todavía nadie terminó este rosco."));
    return;
  }
  const lista = el("ol", "space-y-1.5");
  filas.forEach((fila) => {
    const item = el("li", `flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${fila.soyYo ? "bg-amber-300/15 ring-1 ring-amber-300/40" : "bg-white/[.04]"}`);
    const nombre = el("span", "min-w-0 flex-1 break-words font-bold", fila.seudonimo + (fila.soyYo ? " (vos)" : ""));
    const avatar=el('img');
    avatar.src=`/art/personajes/${/^[a-z0-9-]{1,32}$/.test(fila.avatar ?? '')?fila.avatar:'voltio'}-mini.png`;
    avatar.alt=`Avatar ${fila.avatar ?? 'voltio'}`;avatar.width=36;avatar.height=36;avatar.style.cssText='width:36px;height:36px;object-fit:contain;flex-shrink:0';avatar.loading='lazy';
    avatar.addEventListener('error',()=>{avatar.src='/art/personajes/voltio-mini.png';},{once:true});
    item.append(avatar);
    item.append(
      el("span", "display-font w-6 text-center font-black text-cyan-200", String(fila.posicion)),
      nombre,
      el("span", "font-black text-emerald-300", `${fila.aciertos} ✓`),
      el("span", "w-10 text-right text-slate-300", `${fila.errores} ✗`),
      el("span", "w-11 text-right tabular-nums text-slate-300", formatoTiempo(fila.duracionMs))
    );
    lista.append(item);
  });
  contenedor.append(lista);
}
