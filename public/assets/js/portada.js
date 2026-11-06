import { cargarMaterias } from './materias.js';

function texto(tag, clase, contenido) {
  const node = document.createElement(tag); node.className = clase; node.textContent = contenido; return node;
}
function tarjetaPersonaje(m) {
  const card = document.createElement('article'); card.className = 'subject-card character-card';
  card.style.setProperty('--character-color',m.color);
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'character-trigger';
  trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-controls',`bio-${m.id}`);
  trigger.setAttribute('aria-label',`Conocer a ${m.personaje_nombre}, ${m.nombre}`);
  const image = document.createElement('img'); image.src = m.miniatura; image.alt = ''; image.width = 320; image.height = 320; image.loading = 'lazy';
  const copy = document.createElement('div'); copy.append(texto('h3','',m.nombre),texto('span','character-name',m.personaje_nombre),texto('span','character-hint','Conoceme +'));
  trigger.append(image,copy);
  const bio = document.createElement('div'); bio.id = `bio-${m.id}`; bio.className = 'character-bio'; bio.hidden = true;
  bio.append(texto('p','character-quote',`“${m.frase || 'Cada pregunta es un nuevo comienzo.'}”`),texto('p','character-personality',m.personalidad),texto('h4','','En qué te acompaño'),texto('p','character-help',m.ayuda));
  const link = texto('a','character-cta','Crear una clase de '+m.nombre+' ↗');
  link.href = `acceso.html?modo=registro&rol=docente&materia=${encodeURIComponent(m.nombre)}`; bio.append(link);
  card.append(trigger,bio);
  let fijada = false;
  const abrir = value => { bio.hidden = !value; trigger.setAttribute('aria-expanded',String(value)); card.classList.toggle('is-open',value); };
  trigger.addEventListener('click',()=>{ fijada = !fijada; abrir(fijada); });
  card.addEventListener('pointerenter',e=>{ if(e.pointerType === 'mouse') abrir(true); });
  card.addEventListener('pointerleave',e=>{ if(e.pointerType === 'mouse' && !fijada && !card.contains(document.activeElement)) abrir(false); });
  card.addEventListener('focusin',()=>abrir(true));
  card.addEventListener('focusout',e=>{ if(!fijada && !card.contains(e.relatedTarget)) abrir(false); });
  card.addEventListener('keydown',e=>{if(e.key==='Escape'){fijada=false;abrir(false);trigger.focus();abrir(false);}});
  return card;
}
try {
  const materias = await cargarMaterias();
  document.querySelector('.subjects-grid').replaceChildren(...materias.filter(m=>m.id!=='otra').map(tarjetaPersonaje));
} catch { /* Se conserva el catálogo HTML y sus enlaces si no responde la API. */ }
