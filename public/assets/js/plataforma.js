export { api, el } from './api.js';
export const PERSONAJES = {
  'Tecnología':['voltio','VOLTIO'],'Lengua':['leti','LETI'],'Matemática':['prismo','PRISMO'],'Geografía':['mundi','MUNDI'],'Historia':['crono','CRONO'],'Música':['melo','MELO'],'Biología':['broti','BROTI'],'Artística':['trazo','TRAZO'],'Física':['atomo','ÁTOMO'],'Química':['burbu','BURBU'],'Otra':['voltio','VOLTIO']
};
let avisoId;
export function notificar(texto,mal=false) { const aviso=document.querySelector('#notice');aviso.textContent=texto;aviso.className=`notice ${mal?'failure':'success'}`;aviso.hidden=false;clearTimeout(avisoId);avisoId=setTimeout(()=>{aviso.hidden=true;},5000); }
export async function copiar(texto) { try {await navigator.clipboard.writeText(texto);notificar('Copiado.');}catch{notificar('No se pudo copiar. Seleccioná el texto y copialo a mano.',true);} }
