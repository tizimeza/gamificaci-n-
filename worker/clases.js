import { MATERIAS } from '../public/assets/js/reglas.js';
import { codigoAleatorio } from './seguridad.js';

// El rol y la pertenencia se comprueban en el servidor, no en la navegación.
export async function manejarClases({request,env,usuario,ruta,metodo,ErrorApi,leerCuerpo,limitar,json}) {
  const docente = () => { if(usuario.rol!=='docente')throw new ErrorApi(403,'Esta acción es para profes.'); };
  const propia = async id => {
    docente();
    const clase=await env.DB.prepare('SELECT * FROM clases WHERE id = ? AND docente_id = ?').bind(id,usuario.id).first();
    if(!clase)throw new ErrorApi(404,'No encontramos esa clase.');
    return clase;
  };
  if(ruta==='/clases' && metodo==='GET') {
    const sql=usuario.rol==='docente'
      ? `SELECT c.*, (SELECT COUNT(*) FROM clase_miembros m WHERE m.clase_id=c.id) alumnos, (SELECT COUNT(*) FROM clase_roscos r WHERE r.clase_id=c.id) actividades FROM clases c WHERE c.docente_id=? ORDER BY c.creado DESC`
      : `SELECT c.id,c.nombre,c.materia,c.creado,u.alias docente,(SELECT COUNT(*) FROM clase_roscos r WHERE r.clase_id=c.id) actividades FROM clases c JOIN clase_miembros m ON m.clase_id=c.id JOIN usuarios u ON u.id=c.docente_id WHERE m.alumno_id=? ORDER BY m.unido DESC`;
    return json({clases:(await env.DB.prepare(sql).bind(usuario.id).all()).results});
  }
  if(ruta==='/clases' && metodo==='POST') {
    docente();await limitar(env,`clase:${usuario.id}`,30,3600);
    const datos=await leerCuerpo(request),nombre=typeof datos.nombre==='string'?datos.nombre.trim():'';
    if(nombre.length<3||nombre.length>80||!MATERIAS.includes(datos.materia))throw new ErrorApi(422,'Poné un nombre de 3 a 80 caracteres y elegí la materia.');
    const {cuenta}=await env.DB.prepare('SELECT COUNT(*) cuenta FROM clases WHERE docente_id=?').bind(usuario.id).first();
    if(cuenta>=100)throw new ErrorApi(409,'Llegaste al máximo de 100 clases.');
    const id=crypto.randomUUID();
    for(let intento=0;intento<5;intento++) {
      const codigo=codigoAleatorio(6);
      try {await env.DB.prepare('INSERT INTO clases(id,docente_id,codigo,nombre,materia,creado) VALUES(?,?,?,?,?,?)').bind(id,usuario.id,codigo,nombre,datos.materia,Date.now()).run();return json({id,codigo},201);}
      catch(error){if(!String(error).includes('UNIQUE'))throw error;}
    }
    throw new ErrorApi(503,'No pudimos generar el código. Probá otra vez.');
  }
  if(ruta==='/clases/unirse' && metodo==='POST') {
    if(usuario.rol!=='alumno')throw new ErrorApi(403,'Entrá con una cuenta de alumno para unirte.');
    await limitar(env,`unirse:${usuario.id}`,30,900);
    const datos=await leerCuerpo(request),codigo=typeof datos.codigo==='string'?datos.codigo.trim().toUpperCase():'';
    if(!/^[A-Z0-9]{6}$/.test(codigo))throw new ErrorApi(422,'El código de clase tiene seis letras o números.');
    const clase=await env.DB.prepare('SELECT id FROM clases WHERE codigo=?').bind(codigo).first();
    if(!clase)throw new ErrorApi(404,'No encontramos esa clase. Revisá el código con tu profe.');
    await env.DB.prepare('INSERT OR IGNORE INTO clase_miembros(clase_id,alumno_id,unido) VALUES(?,?,?)').bind(clase.id,usuario.id,Date.now()).run();
    return json({id:clase.id});
  }
  let match=ruta.match(/^\/clases\/([0-9a-f-]{36})$/);
  if(match && metodo==='GET') {
    const id=match[1];let clase;
    if(usuario.rol==='docente')clase=await propia(id);
    else clase=await env.DB.prepare('SELECT c.id,c.nombre,c.materia,c.creado,u.alias docente FROM clases c JOIN clase_miembros m ON m.clase_id=c.id JOIN usuarios u ON u.id=c.docente_id WHERE c.id=? AND m.alumno_id=?').bind(id,usuario.id).first();
    if(!clase)throw new ErrorApi(404,'No encontramos esa clase.');
    const {results:actividades}=await env.DB.prepare('SELECT r.id,r.codigo,r.titulo,r.materia,r.segundos,cr.asignado FROM clase_roscos cr JOIN roscos r ON r.id=cr.rosco_id WHERE cr.clase_id=? ORDER BY cr.asignado DESC').bind(id).all();
    const alumnos=usuario.rol==='docente'?(await env.DB.prepare('SELECT u.alias FROM clase_miembros m JOIN usuarios u ON u.id=m.alumno_id WHERE m.clase_id=? ORDER BY m.unido').bind(id).all()).results:undefined;
    return json({...clase,actividades,...(alumnos?{alumnos}:{})});
  }
  match=ruta.match(/^\/clases\/([0-9a-f-]{36})\/roscos$/);
  if(match && metodo==='POST') {
    await propia(match[1]);const datos=await leerCuerpo(request);
    if(typeof datos.roscoId!=='string'||!/^[0-9a-f-]{36}$/.test(datos.roscoId))throw new ErrorApi(422,'Elegí un rosco de tu biblioteca.');
    const rosco=await env.DB.prepare('SELECT id FROM roscos WHERE id=? AND usuario_id=?').bind(datos.roscoId,usuario.id).first();
    if(!rosco)throw new ErrorApi(404,'No encontramos ese rosco en tu biblioteca.');
    await env.DB.prepare('INSERT OR IGNORE INTO clase_roscos(clase_id,rosco_id,asignado) VALUES(?,?,?)').bind(match[1],rosco.id,Date.now()).run();
    return json({ok:true});
  }
  throw new ErrorApi(404,'Ruta no encontrada.');
}
