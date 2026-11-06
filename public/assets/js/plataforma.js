export { api, el } from './api.js';
import { cargarMaterias } from './materias.js';
export const PERSONAJES = Object.create(null);
export async function prepararMaterias() {
  const materias = await cargarMaterias();
  for (const m of materias) PERSONAJES[m.nombre] = [m.personaje_id, m.personaje_nombre, m.miniatura];
  return materias;
}
let avisoId;
export function notificar(texto,mal=false) { const aviso=document.querySelector('#notice');aviso.textContent=texto;aviso.className=`notice ${mal?'failure':'success'}`;aviso.hidden=false;clearTimeout(avisoId);avisoId=setTimeout(()=>{aviso.hidden=true;},5000); }
export async function copiar(texto) { try {await navigator.clipboard.writeText(texto);notificar('Copiado.');}catch{notificar('No se pudo copiar. Seleccioná el texto y copialo a mano.',true);} }
