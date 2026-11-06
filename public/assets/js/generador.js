import {api,el} from './api.js';
import {cargarMaterias} from './materias.js';
const $=s=>document.querySelector(s);
let config,fuentes=[],ocupado=false,pedidoPendiente=null,sondeo;
const contexto=()=>({materia:$('#g-materia').value,jurisdiccion:$('#g-jurisdiccion').value.trim(),anio:Number($('#g-anio').value),modalidad:$('#g-modalidad').value});
const solicitud=()=>({...contexto(),tema:$('#g-tema').value.trim(),cantidad:Number($('#g-cantidad').value),dificultad:$('#g-dificultad').value,fuenteIds:[...document.querySelectorAll('[data-fuente]:checked')].map(i=>i.value)});
function dibujarFuentes(){
  const actual=contexto(),box=$('#g-fuentes');box.replaceChildren();
  const filtradas=fuentes.filter(f=>['materia','jurisdiccion','anio','modalidad'].every(k=>f[k]===actual[k]));
  if(!filtradas.length)box.append(el('p','generator-help','Todavía no tenés fuentes para este contexto. Agregá una en el paso 2.'));
  for(const f of filtradas){const label=el('label','generator-source'),check=el('input');check.type='checkbox';check.value=f.id;check.dataset.fuente='';const copy=el('div');copy.append(el('span','',f.titulo),el('small','',`${f.organismo} · ${f.version} · ${f.referencia}`));label.append(check,copy);box.append(label);}
}
async function cargarFuentes(){fuentes=(await api('/generador/fuentes')).fuentes;dibujarFuentes();}
async function cargarBorradores(){
  const {borradores}=await api('/generador/borradores'),box=$('#g-borradores');box.replaceChildren();
  if(!borradores.length)box.append(el('p','generator-help','Todavía no generaste borradores. Tus primeros desafíos van a aparecer acá.'));
  for(const b of borradores){const card=el('article','generator-draft');card.append(el('span','generator-badge',{listo:'Para revisar',generando:'Generando',fallido:'Necesita otro intento'}[b.estado]),el('h3','',b.solicitud.tema),el('p','',`${b.solicitud.materia} · ${b.solicitud.anio}.º · ${b.solicitud.jurisdiccion} · ${b.solicitud.cantidad} letras`));if(b.error)card.append(el('p','',b.error));if(b.estado==='listo'){const link=el('a','','Revisar en el editor ↗');link.href=`/panel?generacion=${b.id}`;card.append(link);}box.append(card);}
  clearTimeout(sondeo);if(borradores.some(b=>b.estado==='generando'))sondeo=setTimeout(()=>cargarBorradores().catch(()=>{}),3000);
}
$('#generar-form').addEventListener('submit',async e=>{
  e.preventDefault();if(ocupado||!config?.disponible)return;
  const datos=solicitud();if(!datos.fuenteIds.length||datos.fuenteIds.length>3){$('#g-error').textContent='Elegí de una a tres fuentes.';return;}
  const huella=JSON.stringify(datos);if(pedidoPendiente?.huella!==huella)pedidoPendiente={huella,clave:crypto.randomUUID()};
  ocupado=true;$('#g-generar').disabled=true;$('#g-generar').textContent='Gemini está preparando el borrador…';$('#g-error').textContent='';
  try{const r=await api('/generador/borradores',{metodo:'POST',cuerpo:{...datos,clave:pedidoPendiente.clave}});if(r.estado==='listo'){location.assign(`/panel?generacion=${r.id}`);return;}if(r.estado==='fallido'){pedidoPendiente=null;$('#g-error').textContent=r.error;}await cargarBorradores();}
  catch(error){$('#g-error').textContent=error.message;}
  finally{ocupado=false;$('#g-generar').disabled=!config?.disponible;$('#g-generar').textContent='Generar borrador con Gemini';}
});
$('#fuente-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#f-error').textContent='';$('#f-guardar').disabled=true;
  try{await api('/generador/fuentes',{metodo:'POST',cuerpo:{...contexto(),titulo:$('#f-titulo').value,organismo:$('#f-organismo').value,version:$('#f-version').value,referencia:$('#f-referencia').value,url:$('#f-url').value,texto:$('#f-texto').value}});$('#fuente-form').reset();await cargarFuentes();$('#f-error').textContent='Fuente guardada. Ya podés seleccionarla en el paso 1.';}
  catch(error){$('#f-error').textContent=error.message;}finally{$('#f-guardar').disabled=false;}
});
$('#g-plan-guardar').addEventListener('click',async()=>{
  $('#g-plan-guardar').disabled=true;$('#g-plan-estado').textContent='';
  try{const r=await api('/generador/plan',{metodo:'POST',cuerpo:{...solicitud(),activo:$('#g-diario').checked}});$('#g-plan-estado').textContent=r.activo?(config.diarioHabilitado&&config.disponible?'Plan diario activo. Los borradores quedan pendientes de tu revisión.':'Plan guardado. Falta habilitar la programación y Gemini en el servidor para ejecutarlo.'):'Plan diario desactivado.';}
  catch(error){$('#g-plan-estado').textContent=error.message;}finally{$('#g-plan-guardar').disabled=false;}
});
for(const id of ['g-materia','g-jurisdiccion','g-anio','g-modalidad'])$('#'+id).addEventListener('change',dibujarFuentes);
$('#g-refrescar').addEventListener('click',()=>cargarBorradores().catch(error=>{$('#g-error').textContent=error.message;}));
try{
  const sesion=await api('/sesion');if(!sesion.alias){location.replace('/acceso.html?modo=ingreso&siguiente=panel');}else if(sesion.rol!=='docente'){$('#motor-estado').textContent='Esta pantalla está disponible para profes.';$('#generar-form').hidden=true;$('#nueva-fuente').hidden=true;}else{
    const materias=await cargarMaterias();$('#g-materia').replaceChildren(...materias.map(m=>new Option(m.nombre,m.nombre)));config=await api('/generador/config');
    $('#motor-estado').textContent=config.disponible?`Motor configurado · ${config.modelo}. Cada pedido genera un borrador privado; revisalo antes de guardarlo.`:'El motor está preparado. Falta configurar la clave de Gemini y el modelo en el servidor. Mientras tanto podés cargar tus fuentes y preparar el plan diario.';
    if(config.plan){const s=config.plan.solicitud;for(const campo of ['materia','jurisdiccion','anio','modalidad','tema','cantidad','dificultad'])$('#g-'+campo).value=s[campo];$('#g-diario').checked=config.plan.activo;}
    await cargarFuentes();if(config.plan)document.querySelectorAll('[data-fuente]').forEach(c=>c.checked=config.plan.solicitud.fuenteIds.includes(c.value));
    await cargarBorradores();$('#g-generar').disabled=!config.disponible;
  }
}catch(error){$('#motor-estado').textContent=error.message;}
