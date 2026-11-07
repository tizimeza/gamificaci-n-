import {api,el} from './api.js';
import {cargarMaterias} from './materias.js';

export async function selectorAvatar(contenedor,seleccion,onChange) {
  const vistos=new Set();
  const materias=(await cargarMaterias()).filter(m=>m.id!=='otra'&&!vistos.has(m.personaje_id)&&vistos.add(m.personaje_id));
  contenedor.classList.add('avatar-options');contenedor.setAttribute('role','group');contenedor.setAttribute('aria-label','Elegí tu avatar');
  const estado=el('p','avatar-status');estado.setAttribute('role','status');
  for(const m of materias){
    const b=el('button','avatar-option');b.type='button';b.setAttribute('aria-label',`Avatar ${m.personaje_nombre}`);b.setAttribute('aria-pressed',String(m.personaje_id===seleccion));
    const img=el('img');img.src=m.miniatura;img.alt='';img.width=64;img.height=64;
    b.append(img,el('span','',m.personaje_nombre));
    b.addEventListener('click',async()=>{
      const botones=contenedor.querySelectorAll('button');botones.forEach(x=>x.disabled=true);
      try{await onChange(m.personaje_id);botones.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));estado.textContent=`Tu avatar: ${m.personaje_nombre}.`;}
      catch(error){estado.textContent=error.message;}
      finally{botones.forEach(x=>x.disabled=false);}
    });contenedor.append(b);
  }
  contenedor.append(estado);
}

export function dibujarActividad(contenedor,actividad) {
  contenedor.replaceChildren();
  const encabezado=el('div','daily-heading');encabezado.append(el('h2','',`Tu racha: ${actividad.racha} ${actividad.racha===1?'día':'días'}`),el('span','',`Mejor racha: ${actividad.mejorRacha}`));
  const objetivo=el('p','daily-goal',actividad.hoyCompletado?'✓ Objetivo de hoy completado':'Tu objetivo de hoy: completá un rosco');
  const ayuda=el('p','daily-help','Respondé todas las letras y lográ al menos un acierto. Cada día de práctica suma una vez.');
  const semana=el('ol','daily-week');semana.setAttribute('aria-label','Tus últimos siete días');
  for(const d of actividad.semana){const fecha=new Date(d.dia+'T12:00:00Z');const label=fecha.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',timeZone:'America/Argentina/Buenos_Aires'});const item=el('li',d.completado?'complete':'');item.setAttribute('aria-label',`${label}: ${d.completado?'completado':'sin completar'}`);item.append(el('span','',label),el('b','',d.completado?'✓':'·'));semana.append(item);}
  const insignias=el('div','daily-badges');
  for(const meta of [1,3,7,30]){const badge=el('span',actividad.insignias.includes(meta)?'earned':'',`${meta===1?'Primer día':meta+' días de práctica'}${actividad.insignias.includes(meta)?' ✓':''}`);insignias.append(badge);}
  contenedor.append(encabezado,objetivo,ayuda,semana,insignias,el('p','daily-help',`${actividad.diasTotales} ${actividad.diasTotales===1?'día':'días'} de práctica en total · Fecha de Argentina`));
}

export async function montarPerfil(contenedor) {
  const perfil=await api('/perfil');contenedor.hidden=false;contenedor.replaceChildren();
  const progreso=el('div');dibujarActividad(progreso,perfil.actividad);
  const detalles=el('details','profile-avatar');detalles.append(el('summary','','Elegí tu personaje para el ranking'));
  const opciones=el('div');detalles.append(opciones);contenedor.append(progreso,detalles);
  await selectorAvatar(opciones,perfil.avatar,avatar=>api('/perfil',{metodo:'PATCH',cuerpo:{avatar}}));
  return perfil;
}
