import {api,copiar} from './plataforma.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const rol=params.get('rol')==='alumno'?'alumno':'docente';
const modo=['registro','ingreso','recuperar'].includes(params.get('modo'))?params.get('modo'):'ingreso';
const registro=modo==='registro',recuperar=modo==='recuperar';
function enlace(m,perfil=rol) {const p=new URLSearchParams({modo:m,rol:perfil});for(const k of ['clase','materia'])if(params.get(k))p.set(k,params.get(k));return `acceso.html?${p}`;}
function destino(){const p=new URLSearchParams();if(/^[a-z0-9]{6}$/i.test(params.get('clase')||''))p.set('codigo',params.get('clase').toUpperCase());if(params.get('materia'))p.set('materia',params.get('materia'));location.assign(`clases.html${p.size?'?'+p:''}`);}
$('#teacher-link').href=enlace('registro','docente');$('#student-link').href=enlace('registro','alumno');$(`#${rol==='docente'?'teacher':'student'}-link`).classList.add('active');
$('#profile-switch').hidden=!registro;
$('#profile-note').textContent=rol==='docente'?'Tu contenido enciende la clase.':'Tu lugar en la próxima ronda.';
$('#profile-heading').textContent=rol==='docente'?'La próxima clase la creás vos.':'El desafío también es tuyo.';
$('#profile-description').textContent=rol==='docente'?'Creá tus clases, prepará roscos y compartí desafíos con tus alumnos.':'Entrá con tu alias, sumate a tus clases y encontrá los desafíos de tus profes.';
if(rol==='alumno'){$('#profile-art').src='art/personajes/voltio-mini.png';$('#profile-art').alt='VOLTIO te da la bienvenida';}
$('#access-heading').textContent=recuperar?'Recuperá tu cuenta':registro?`Creá tu cuenta de ${rol==='docente'?'profe':'alumno'}`:'Qué bueno verte de nuevo.';
$('#access-help').textContent=recuperar?'Usá el código que guardaste al crear tu cuenta.':registro?'Elegí un alias y una contraseña de al menos ocho caracteres.':'Ingresá tu usuario y contraseña para continuar.';
$('#password-label').textContent=recuperar?'Nueva contraseña':'Contraseña';$('#account-password').autocomplete=modo==='ingreso'?'current-password':'new-password';
$('#password-confirm-field').hidden=!registro;$('#account-confirm').required=registro;$('#recovery-field').hidden=!recuperar;$('#recovery-input').required=recuperar;
$('#account-submit').textContent=recuperar?'Cambiar contraseña':registro?'Crear mi cuenta':'Ingresar';
$('#mode-link').textContent=registro||recuperar?'Ya tengo cuenta':'Crear una cuenta';$('#mode-link').href=enlace(registro||recuperar?'ingreso':'registro');$('#recovery-link').href=enlace('recuperar');$('#recovery-link').hidden=recuperar;
$('#privacy-copy').hidden=!registro;
$('#account-form').addEventListener('submit',async e=>{
 e.preventDefault();$('#account-error').textContent='';if(registro&&$('#account-password').value!==$('#account-confirm').value){$('#account-error').textContent='Las contraseñas deben coincidir.';$('#account-confirm').focus();return;}
 const button=$('#account-submit');button.disabled=true;
 try{
  const body={alias:$('#account-alias').value.trim(),clave:$('#account-password').value,...(registro?{rol}:{}),...(recuperar?{codigoRecuperacion:$('#recovery-input').value.trim()}: {})};
  const data=await api({registro:'/registro',ingreso:'/ingreso',recuperar:'/recuperar'}[modo],{metodo:'POST',cuerpo:body});$('#account-form').reset();
  if(data.codigoRecuperacion){$('#account-card').hidden=true;$('#recovery-card').hidden=false;$('#recovery-code').textContent=data.codigoRecuperacion;$('#recovery-title').focus();}else destino();
 }catch(error){$('#account-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#copy-recovery').addEventListener('click',()=>copiar($('#recovery-code').textContent));$('#recovery-saved').addEventListener('change',e=>{$('#account-continue').disabled=!e.target.checked;});$('#account-continue').addEventListener('click',()=>{$('#recovery-code').textContent='';destino();});
try{const sesion=await api('/sesion');if(sesion.alias)destino();}catch(error){$('#account-error').textContent='No pudimos conectar con el servidor. Revisá la conexión y volvé a intentar.';}
