export const diaArgentina = (ahora=Date.now()) => new Date(ahora-3*3600000).toISOString().slice(0,10);
const diaAnterior = dia => new Date(Date.parse(dia+'T12:00:00Z')-86400000).toISOString().slice(0,10);
export function calcularActividad(dias, hoy=diaArgentina()) {
  const ordenados=[...new Set(dias)].filter(d=>d<=hoy).sort(), vistos=new Set(ordenados);
  let mejor=0,contador=0,previo=null;
  for(const dia of ordenados){contador=previo===diaAnterior(dia)?contador+1:1;mejor=Math.max(mejor,contador);previo=dia;}
  let cursor=vistos.has(hoy)?hoy:diaAnterior(hoy),racha=0;
  while(vistos.has(cursor)){racha++;cursor=diaAnterior(cursor);}
  const semana=[];cursor=hoy;
  for(let i=0;i<7;i++){semana.unshift({dia:cursor,completado:vistos.has(cursor)});cursor=diaAnterior(cursor);}
  return {hoy,racha,mejorRacha:mejor,diasTotales:ordenados.length,hoyCompletado:vistos.has(hoy),semana,
    insignias:[1,3,7,30].filter(meta=>ordenados.length>=meta)};
}
export async function actividadUsuario(env,id) {
  const {results}=await env.DB.prepare('SELECT dia FROM actividad_diaria WHERE usuario_id=? ORDER BY dia').bind(id).all();
  return calcularActividad(results.map(r=>r.dia));
}
export async function avatarValido(env,valor,predeterminado='voltio') {
  if(valor===undefined) return predeterminado;
  if(typeof valor!=='string') return null;
  return await env.DB.prepare("SELECT personaje_id FROM materias WHERE personaje_id=? AND visible=1").bind(valor).first()?valor:null;
}
