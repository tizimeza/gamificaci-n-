import { api } from './api.js';

const localAsset = value => typeof value === 'string' && /^\/(art|assets)\/[a-z0-9/_-]+\.(png|webp|jpe?g|mp4|webm)$/i.test(value);
export function presentacionSegura(data) {
  return {
    id: String(data?.id ?? 'otra'), nombre: String(data?.nombre ?? 'Otra'),
    personaje_id: String(data?.personaje_id ?? 'voltio'), personaje_nombre: String(data?.personaje_nombre ?? 'VOLTIO'),
    imagen: localAsset(data?.imagen) ? data.imagen : '/art/personajes/voltio-base.png',
    miniatura: localAsset(data?.miniatura) ? data.miniatura : '/art/personajes/voltio-mini.png',
    color: /^#[0-9a-f]{6}$/i.test(data?.color ?? '') ? data.color : '#48e5ed',
    personalidad: String(data?.personalidad ?? '').slice(0,300),
    ayuda: String(data?.ayuda ?? '').slice(0,400),
    frase: String(data?.frase ?? '').slice(0,160),
    festejo: localAsset(data?.festejo) && /\.(mp4|webm)$/i.test(data.festejo) ? data.festejo : null
  };
}
let catalogo;
export function cargarMaterias() {
  if (!catalogo) catalogo = api('/materias').then(({materias}) => {
    if (!Array.isArray(materias) || !materias.length) throw new Error('El catálogo de materias no está disponible.');
    return materias.map(presentacionSegura);
  }).catch(error => { catalogo = null; throw error; });
  return catalogo;
}

// Este mismo componente se usa en inicio, espera, rosco, resultado y proyector.
const videos = new WeakMap();
export function crearPersonaje(config, clase = '') {
  const materia = presentacionSegura(config);
  const figure = document.createElement('figure'); figure.className = `subject-avatar ${clase}`.trim();
  const image = document.createElement('img'); image.src = materia.miniatura; image.alt = materia.personaje_nombre;
  image.width = 320; image.height = 320; image.draggable = false;
  const caption = document.createElement('figcaption'); caption.textContent = materia.personaje_nombre;
  figure.append(image, caption); figure.dataset.personaje = materia.personaje_id;
  if (materia.festejo) {
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'none'; video.hidden = true;
    video.setAttribute('aria-hidden', 'true');
    const restaurar = () => { video.hidden = true; image.hidden = false; };
    video.addEventListener('ended', restaurar); video.addEventListener('error', restaurar);
    figure.prepend(video); videos.set(figure, {video, image, src:materia.festejo, restaurar});
  }
  return figure;
}

export function reaccionPersonaje(contenedor, tipo) {
  contenedor?.querySelectorAll('.subject-avatar').forEach(avatar => {
    if (avatar.closest('.hidden,[hidden]') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    avatar.classList.remove('subject-success', 'subject-error');
    void avatar.offsetWidth;
    avatar.classList.add(tipo === 'acierto' ? 'subject-success' : 'subject-error');
    const media = videos.get(avatar);
    if (tipo === 'acierto' && media) {
      media.video.src ||= media.src;
      media.video.currentTime = 0; media.image.hidden = true; media.video.hidden = false;
      media.video.play().catch(media.restaurar);
    }
  });
}
