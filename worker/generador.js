import {listarMaterias} from './materias.js';
import {diaArgentina} from './perfil.js';
import {ErrorGenerador,solicitudValida,fuenteValida,mismoContexto,pedirGemini} from './gemini.js';

export const generadorDisponible=env=>Boolean(env.GEMINI_API_KEY&&/^gemini-[a-z0-9.-]{3,70}$/.test(env.GEMINI_MODEL??''));
const limiteDiario=env=>Math.min(100,Math.max(1,Number.parseInt(env.GENERADOR_LIMITE_DIARIO,10)||20));
const parseFila=f=>({...f,solicitud:JSON.parse(f.solicitud),fuentes:JSON.parse(f.fuentes),borrador:f.borrador?JSON.parse(f.borrador):null});
const camposFuente='id,materia,jurisdiccion,anio,modalidad,titulo,organismo,version,referencia,url,texto,creado';

async function buscarFuentes(env,usuarioId,solicitud) {
  const fuentes=[];
  for(const id of solicitud.fuenteIds){
    const f=await env.DB.prepare(`SELECT ${camposFuente} FROM fuentes_curriculares WHERE id=? AND usuario_id=?`).bind(id,usuarioId).first();
    if(!f)throw new ErrorGenerador(404,'No encontramos una de tus fuentes.');
    if(!mismoContexto(f,solicitud))throw new ErrorGenerador(422,'Las fuentes deben coincidir con materia, jurisdicción, año y modalidad.');
    fuentes.push(f);
  }
  return fuentes;
}

export async function generarRosco(env,usuarioId,solicitud,clave,{fetcher=fetch}={}) {
  const existente=await env.DB.prepare('SELECT * FROM generaciones WHERE usuario_id=? AND clave=?').bind(usuarioId,clave).first();
  if(existente){
    if(existente.solicitud!==JSON.stringify(solicitud))throw new ErrorGenerador(409,'Este pedido ya se usó con otra configuración.');
    return parseFila(existente);
  }
  const fuentes=await buscarFuentes(env,usuarioId,solicitud);
  if(!generadorDisponible(env))throw new ErrorGenerador(503,'Falta configurar GEMINI_API_KEY y GEMINI_MODEL en el servidor. Podés guardar las fuentes mientras tanto.');
  const ahora=Date.now(),id=crypto.randomUUID();
  await env.DB.prepare("UPDATE generaciones SET estado='fallido',error='La generación se interrumpió. Podés iniciar otro pedido.',actualizado=? WHERE usuario_id=? AND estado='generando' AND actualizado<?").bind(ahora,usuarioId,ahora-150000).run();
  try {
    await env.DB.prepare("INSERT INTO generaciones(id,usuario_id,clave,estado,solicitud,fuentes,modelo,creado,actualizado) VALUES(?,?,?,'generando',?,?,?,?,?)")
      .bind(id,usuarioId,clave,JSON.stringify(solicitud),JSON.stringify(fuentes),env.GEMINI_MODEL,ahora,ahora).run();
  } catch(error) {
    if(!String(error).includes('UNIQUE'))throw error;
    const repetida=await env.DB.prepare('SELECT * FROM generaciones WHERE usuario_id=? AND clave=?').bind(usuarioId,clave).first();
    if(repetida)return parseFila(repetida);
    throw new ErrorGenerador(409,'Ya tenés una generación en curso. Esperá a que termine.');
  }
  try {
    const cuota=await env.DB.prepare('INSERT INTO generacion_cuotas(dia,cuenta) VALUES(?,1) ON CONFLICT(dia) DO UPDATE SET cuenta=cuenta+1 WHERE cuenta<? RETURNING cuenta').bind(diaArgentina(),limiteDiario(env)).first();
    if(!cuota)throw new ErrorGenerador(429,'Se alcanzó el máximo diario de generaciones de la plataforma.');
    const anteriores=(await env.DB.prepare("SELECT borrador FROM generaciones WHERE usuario_id=? AND estado='listo' ORDER BY creado DESC LIMIT 10").bind(usuarioId).all()).results;
    const evitar=anteriores.flatMap(a=>JSON.parse(a.borrador).rosco.entradas.map(e=>e.definicion)).slice(0,120);
    const borrador=await pedirGemini({key:env.GEMINI_API_KEY,modelo:env.GEMINI_MODEL,solicitud,fuentes,evitar,fetcher});
    await env.DB.prepare("UPDATE generaciones SET estado='listo',borrador=?,actualizado=? WHERE id=?").bind(JSON.stringify(borrador),Date.now(),id).run();
  } catch(error) {
    const mensaje=error instanceof ErrorGenerador?error.message:'No se pudo completar la generación. Tus fuentes siguen guardadas.';
    await env.DB.prepare("UPDATE generaciones SET estado='fallido',error=?,actualizado=? WHERE id=?").bind(mensaje,Date.now(),id).run();
    // Nunca se devuelve el error original de red, que podría contener información del proveedor.
  }
  return parseFila(await env.DB.prepare('SELECT * FROM generaciones WHERE id=? AND usuario_id=?').bind(id,usuarioId).first());
}

export async function manejarGenerador({request,env,usuario,ruta,metodo,leerCuerpo,json,limitar}) {
  if(usuario.rol!=='docente')throw new ErrorGenerador(403,'El generador está disponible para profes.');
  const materias=(await listarMaterias(env)).map(m=>m.nombre);
  if(ruta==='/generador/config'&&metodo==='GET') {
    const plan=await env.DB.prepare('SELECT activo,solicitud FROM planes_generacion WHERE usuario_id=?').bind(usuario.id).first();
    return json({disponible:generadorDisponible(env),modelo:env.GEMINI_MODEL??null,limiteDiario:limiteDiario(env),diarioHabilitado:env.GENERACION_DIARIA==='true',plan:plan?{activo:Boolean(plan.activo),solicitud:JSON.parse(plan.solicitud)}:null});
  }
  if(ruta==='/generador/fuentes'&&metodo==='GET')return json({fuentes:(await env.DB.prepare(`SELECT ${camposFuente} FROM fuentes_curriculares WHERE usuario_id=? ORDER BY creado DESC`).bind(usuario.id).all()).results});
  if(ruta==='/generador/fuentes'&&metodo==='POST') {
    const f=fuenteValida(await leerCuerpo(request),materias);
    const {cuenta}=await env.DB.prepare('SELECT COUNT(*) cuenta FROM fuentes_curriculares WHERE usuario_id=?').bind(usuario.id).first();
    if(cuenta>=100)throw new ErrorGenerador(409,'Llegaste al máximo de 100 fuentes.');
    await limitar(env,`fuente:${usuario.id}`,30,3600);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO fuentes_curriculares(id,usuario_id,materia,jurisdiccion,anio,modalidad,titulo,organismo,version,referencia,url,texto,creado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,usuario.id,f.materia,f.jurisdiccion,f.anio,f.modalidad,f.titulo,f.organismo,f.version,f.referencia,f.url,f.texto,Date.now()).run();
    return json({id,...f},201);
  }
  if(ruta==='/generador/borradores'&&metodo==='GET')return json({borradores:(await env.DB.prepare('SELECT id,estado,solicitud,error,creado,actualizado FROM generaciones WHERE usuario_id=? ORDER BY creado DESC LIMIT 30').bind(usuario.id).all()).results.map(f=>({...f,solicitud:JSON.parse(f.solicitud)}))});
  const m=ruta.match(/^\/generador\/borradores\/([a-f0-9-]{36})$/);
  if(m&&metodo==='GET'){
    const f=await env.DB.prepare('SELECT * FROM generaciones WHERE id=? AND usuario_id=?').bind(m[1],usuario.id).first();
    if(!f)throw new ErrorGenerador(404,'Borrador no encontrado.');return json(parseFila(f));
  }
  if(ruta==='/generador/borradores'&&metodo==='POST') {
    const datos=await leerCuerpo(request),solicitud=solicitudValida(datos,materias);
    if(typeof datos.clave!=='string'||!/^[-a-f0-9]{36}$/.test(datos.clave))throw new ErrorGenerador(422,'El pedido necesita un identificador válido.');
    await limitar(env,`generacion:${usuario.id}`,5,86400);
    return json(await generarRosco(env,usuario.id,solicitud,datos.clave),201);
  }
  if(ruta==='/generador/plan'&&metodo==='POST') {
    const datos=await leerCuerpo(request);
    if(datos.activo===false){await env.DB.prepare('UPDATE planes_generacion SET activo=0,actualizado=? WHERE usuario_id=?').bind(Date.now(),usuario.id).run();return json({ok:true,activo:false});}
    if(datos.activo!==true)throw new ErrorGenerador(422,'Indicá si querés activar el plan.');
    const solicitud=solicitudValida(datos,materias);await buscarFuentes(env,usuario.id,solicitud);
    await env.DB.prepare('INSERT INTO planes_generacion(usuario_id,activo,solicitud,actualizado) VALUES(?,1,?,?) ON CONFLICT(usuario_id) DO UPDATE SET activo=1,solicitud=excluded.solicitud,actualizado=excluded.actualizado').bind(usuario.id,JSON.stringify(solicitud),Date.now()).run();
    return json({ok:true,activo:true});
  }
  throw new ErrorGenerador(404,'Ruta del generador no encontrada.');
}

export async function prepararBorradoresDiarios(env,{fetcher=fetch}={}) {
  if(env.GENERACION_DIARIA!=='true'||!generadorDisponible(env))return {preparados:0};
  const planes=(await env.DB.prepare("SELECT p.* FROM planes_generacion p JOIN usuarios u ON u.id=p.usuario_id WHERE activo=1 AND u.rol='docente' ORDER BY COALESCE((SELECT MAX(g.creado) FROM generaciones g WHERE g.usuario_id=p.usuario_id),0),p.actualizado LIMIT ?").bind(Math.min(20,limiteDiario(env))).all()).results;
  let preparados=0,cursor=0;
  // Tres llamadas concurrentes como máximo; nunca se publica contenido automáticamente.
  const ejecutar=async()=>{while(cursor<planes.length){const plan=planes[cursor++];try{const resultado=await generarRosco(env,plan.usuario_id,JSON.parse(plan.solicitud),`diario:${diaArgentina()}`,{fetcher});if(resultado.estado==='listo')preparados++;}catch{/* El siguiente plan puede continuar. */}}};
  await Promise.all([ejecutar(),ejecutar(),ejecutar()]);
  return {preparados};
}
