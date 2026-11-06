import {api,el,PERSONAJES,notificar,copiar} from './plataforma.js';
import {MATERIAS} from './reglas.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let usuario,actual=null,detalle=null;
const personaje=m=>PERSONAJES[m]||PERSONAJES.Otra;
function pantalla(nombre){$('#classes-screen').hidden=nombre!=='lista';$('#detail-screen').hidden=nombre!=='detalle';$('#dashboard-error').textContent='';$('#retry').hidden=true;window.scrollTo(0,0);}
function errorGlobal(error){$('#loading').hidden=true;$('#dashboard-error').textContent=error.message;$('#retry').hidden=false;}
function cambiarUrl(id){const p=new URLSearchParams(location.search);if(id)p.set('id',id);else p.delete('id');history.replaceState(null,'',`${location.pathname}${p.size?'?'+p:''}`);}
function vacio(titulo,texto){const box=el('div','empty-state');const img=el('img');img.src='art/personajes/prismo-mini.png';img.alt='PRISMO espera el próximo desafío';img.width=320;img.height=320;box.append(img,el('h2','',titulo),el('p','',texto));return box;}
async function lista(){
 const datos=await api('/clases');actual=null;detalle=null;cambiarUrl(null);pantalla('lista');$('#classes-grid').replaceChildren();
 if(!datos.clases.length)$('#classes-grid').append(vacio(usuario.rol==='docente'?'Tu primera clase empieza acá.':'Tu próximo desafío te espera.',usuario.rol==='docente'?'Creá una clase y compartí su código con tu curso.':'Ingresá el código que te compartió tu profe para sumarte.'));
 for(const clase of datos.clases){const card=el('article','class-card'),link=el('a');link.href=`clases.html?id=${clase.id}`;const img=el('img');const[id,nombre]=personaje(clase.materia);img.src=`art/personajes/${id}-mini.png`;img.alt=nombre;img.width=320;img.height=320;const copy=el('div');copy.append(el('p','class-subject',clase.materia),el('h2','',clase.nombre),el('p','',`${clase.actividades} ${clase.actividades===1?'desafío':'desafíos'}${usuario.rol==='docente'?` · ${clase.alumnos} alumnos`:''}`));if(usuario.rol==='docente')copy.append(el('p','class-code',clase.codigo));link.append(img,copy);link.addEventListener('click',e=>{e.preventDefault();abrir(clase.id).catch(errorGlobal);});card.append(link);$('#classes-grid').append(card);}
 $('#loading').hidden=true;
}
async function abrir(id){
 const data=await api(`/clases/${id}`);actual=id;detalle=data;cambiarUrl(id);pantalla('detalle');
 const[image,nombre]=personaje(data.materia);$('#class-character').src=`art/personajes/${image}-mini.png`;$('#class-character').alt=nombre;$('#class-title').textContent=data.nombre;$('#class-materia').textContent=data.materia;
 const cantidad=data.actividades.length,desafios=`${cantidad} ${cantidad===1?'desafío':'desafíos'}`;
 $('#class-description').textContent=usuario.rol==='docente'?`${data.alumnos.length} ${data.alumnos.length===1?'alumno inscripto':'alumnos inscriptos'} · ${desafios}`:`Tu profe: ${data.docente} · ${desafios}`;
 const teacher=usuario.rol==='docente';$('#invite-panel').hidden=!teacher;$('#teacher-tools').hidden=!teacher;$('#new-activity').hidden=!teacher;$('#new-activity').href=`panel.html?clase=${id}&nuevo=1&materia=${encodeURIComponent(data.materia)}`;
 $('#activities').replaceChildren();
 if(!data.actividades.length)$('#activities').append(vacio('Todavía no hay desafíos.',teacher?'Creá un rosco o asigná uno que ya tengas en tu biblioteca.':'Cuando tu profe asigne un rosco, lo vas a encontrar acá.'));
 for(const actividad of data.actividades){const box=el('article','activity-item'),text=el('div');text.append(el('h3','',actividad.titulo),el('p','',`${actividad.materia} · ${actividad.segundos} segundos de tiempo total`));const link=el('a','primary',teacher?'Probar desafío ↗':'Jugar desafío ↗');link.href=`jugar.html?c=${actividad.codigo}`;box.append(text,link);$('#activities').append(box);}
 if(teacher){$('#invite-code').textContent=data.codigo;$('#members').replaceChildren(...(data.alumnos.length?data.alumnos.map(a=>el('li','',a.alias)):[el('li','','El curso todavía no se unió.')]));
  const {roscos}=await api('/roscos');$('#assign-rosco').replaceChildren(new Option('Elegí un rosco',''));const asignados=new Set(data.actividades.map(a=>a.id));roscos.filter(r=>!asignados.has(r.id)).forEach(r=>$('#assign-rosco').append(new Option(r.titulo,r.id)));$('#assign-button').disabled=$('#assign-rosco').options.length===1;
 }
 $('#loading').hidden=true;$('#class-title').focus({preventScroll:true});
}
async function iniciar(){
 try{usuario=await api('/sesion');if(!usuario.alias){location.replace(`acceso.html?modo=ingreso${params.get('codigo')?'&rol=alumno&clase='+encodeURIComponent(params.get('codigo')):''}`);return;}
 $('#session-alias').textContent=`${usuario.alias} · ${usuario.rol==='docente'?'Profe':'Alumno'}`;const teacher=usuario.rol==='docente';$('#teacher-create').hidden=!teacher;$('#student-join').hidden=teacher;$('#library-link').hidden=!teacher;$('#dashboard-help').textContent=teacher?'Cada clase reúne a un curso. Creá desafíos y elegí con qué grupo compartirlos.':'Acá están tus clases y los desafíos que comparten tus profes.';
 MATERIAS.forEach(m=>$('#class-subject').append(new Option(m,m)));if(MATERIAS.includes(params.get('materia')))$('#class-subject').value=params.get('materia');$('#class-code').value=/^[A-Z0-9]{6}$/i.test(params.get('codigo')||'')?params.get('codigo').toUpperCase():'';
 if(/^[0-9a-f-]{36}$/.test(params.get('id')||''))await abrir(params.get('id'));else await lista();
 }catch(error){errorGlobal(error);}
}
$('#create-class-form').addEventListener('submit',async e=>{e.preventDefault();$('#create-error').textContent='';$('#create-class').disabled=true;try{const data=await api('/clases',{metodo:'POST',cuerpo:{nombre:$('#class-name').value.trim(),materia:$('#class-subject').value}});$('#class-name').value='';await abrir(data.id);notificar('Clase creada. Ya podés invitar a tu curso.');}catch(error){$('#create-error').textContent=error.message;}finally{$('#create-class').disabled=false;}});
$('#join-class-form').addEventListener('submit',async e=>{e.preventDefault();$('#join-error').textContent='';$('#join-class').disabled=true;try{const data=await api('/clases/unirse',{metodo:'POST',cuerpo:{codigo:$('#class-code').value.trim()}});await abrir(data.id);notificar('Ya sos parte de la clase.');}catch(error){$('#join-error').textContent=error.message;}finally{$('#join-class').disabled=false;}});
$('#assign-form').addEventListener('submit',async e=>{e.preventDefault();$('#assign-error').textContent='';$('#assign-button').disabled=true;try{await api(`/clases/${actual}/roscos`,{metodo:'POST',cuerpo:{roscoId:$('#assign-rosco').value}});await abrir(actual);notificar('Desafío asignado. El curso ya puede jugarlo.');}catch(error){$('#assign-error').textContent=error.message;$('#assign-button').disabled=false;}});
$('#copy-invite').addEventListener('click',()=>{const url=new URL('acceso.html',location.href);url.search=new URLSearchParams({rol:'alumno',modo:'registro',clase:detalle.codigo}).toString();copiar(url.href);});
$('#back-classes').addEventListener('click',()=>lista().catch(errorGlobal));$('#retry').addEventListener('click',()=>location.reload());$('#logout').addEventListener('click',async()=>{try{await api('/salir',{metodo:'POST',cuerpo:{}});location.assign('index.html');}catch(error){notificar(error.message,true);}});
await iniciar();
