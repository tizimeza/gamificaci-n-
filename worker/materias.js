export async function listarMaterias(env) {
  return (await env.DB.prepare('SELECT id,nombre,personaje_id,personaje_nombre,imagen,miniatura,color,festejo,personalidad,ayuda,frase FROM materias WHERE visible=1 ORDER BY orden,nombre').all()).results;
}

export async function presentacionMateria(env, nombre) {
  return await env.DB.prepare('SELECT id,nombre,personaje_id,personaje_nombre,imagen,miniatura,color,festejo,personalidad,ayuda,frase FROM materias WHERE nombre=?').bind(nombre).first()
    ?? await env.DB.prepare("SELECT id,nombre,personaje_id,personaje_nombre,imagen,miniatura,color,festejo,personalidad,ayuda,frase FROM materias WHERE id='otra'").first();
}
