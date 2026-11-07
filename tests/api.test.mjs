// Pruebas de la API contra un servidor local: `npm run dev` en una terminal y `npm test` en otra.
import assert from "node:assert/strict";
import { test } from "node:test";

const BASE = process.env.BASE ?? "http://localhost:8787";
const unico = () => `t${Math.random().toString(36).slice(2, 12)}`;

function cliente() {
  let cookie = "";
  return async (ruta, { metodo = "GET", cuerpo, encabezados = {} } = {}) => {
    const respuesta = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      redirect: "manual",
      headers: { ...(cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...encabezados },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const nueva = respuesta.headers.get("set-cookie");
    if (nueva) cookie = nueva.split(";")[0];
    return { estado: respuesta.status, datos: await respuesta.json() };
  };
}

const rosco = (extra = {}) => ({
  titulo: "Rosco de prueba",
  materia: "Tecnología",
  segundos: 120,
  entradas: [
    { letra: "A", palabra: "Algoritmo", definicion: "Serie ordenada de pasos para resolver un problema." },
    { letra: "B", palabra: "Bit", definicion: "Unidad mínima de información digital." },
    { letra: "C", palabra: "Contraseña", definicion: "Clave secreta para entrar a una cuenta.", alternativas: ["clave"] },
    { letra: "D", palabra: "Dato", definicion: "Información sin procesar." },
    { letra: "Ñ", palabra: "Año", definicion: "Período de doce meses." }
  ],
  ...extra
});

async function creador() {
  const api = cliente();
  const alias = unico();
  const { estado, datos } = await api("/registro", { metodo: "POST", cuerpo: { alias, clave: "contraseña-segura", rol: "docente" } });
  assert.equal(estado, 201);
  return { api, alias, codigoRecuperacion: datos.codigoRecuperacion };
}

const jugadorNuevo = () => crypto.randomUUID();

test('biblioteca: crear desde un rosco mantiene original, ranking y clases independientes', async () => {
  const {api}=await creador();
  const original=(await api('/roscos',{metodo:'POST',cuerpo:rosco({titulo:'Original para reutilizar'})})).datos;
  const jugador=cliente();
  const partida=(await jugador(`/r/${original.codigo}/intentos`,{metodo:'POST',cuerpo:{jugador:jugadorNuevo(),seudonimo:'Puma Veloz 42'}})).datos;
  await jugador(`/intentos/${partida.token}/responder`,{metodo:'POST',cuerpo:{pos:0,respuesta:'algoritmo'}});
  await jugador(`/intentos/${partida.token}/terminar`,{metodo:'POST',cuerpo:{}});
  const antes=(await api(`/roscos/${original.id}`)).datos;
  const clase=(await api('/clases',{metodo:'POST',cuerpo:{nombre:'Curso de biblioteca',materia:'Tecnología'}})).datos;
  await api(`/clases/${clase.id}/roscos`,{metodo:'POST',cuerpo:{roscoId:original.id}});
  const copia=(await api('/roscos',{metodo:'POST',cuerpo:{titulo:'Versión para otro curso',materia:antes.materia,segundos:180,entradas:antes.entradas}})).datos;
  assert.notEqual(copia.id,original.id);assert.notEqual(copia.codigo,original.codigo);
  assert.equal((await jugador(`/r/${copia.codigo}/ranking`)).datos.ranking.length,0);
  assert.equal((await jugador(`/r/${original.codigo}/ranking`)).datos.ranking.length,1);
  const despues=(await api(`/roscos/${original.id}`)).datos;
  assert.equal(despues.titulo,antes.titulo);assert.equal(despues.segundos,antes.segundos);assert.deepEqual(despues.entradas,antes.entradas);
  assert.equal(despues.actualizado,antes.actualizado);
  const detalle=(await api(`/clases/${clase.id}`)).datos;
  assert.equal(detalle.actividades.length,1);assert.equal(detalle.actividades[0].id,original.id);
  assert.equal((await api('/roscos')).datos.roscos.length,2);
});

test('catálogo de materias: un mismo jugador recibe presentación y contenido de cada rosco', async () => {
  const publico=cliente();
  const {estado,datos}=await publico('/materias');
  assert.equal(estado,200);
  const materias=datos.materias;
  assert.equal(materias.length,11);
  assert.equal(materias.find(m=>m.nombre==='Lengua').personaje_nombre,'LETI');
  assert.equal(materias.find(m=>m.nombre==='Matemática').personaje_nombre,'PRISMO');
  assert.equal(materias.find(m=>m.nombre==='Biología').personaje_nombre,'BROTI');
  const profe=await creador();
  for(const materia of materias) {
    assert.ok(materia.personalidad.length > 20,`Personalidad de ${materia.nombre}`);
    assert.ok(materia.ayuda.length > 30,`Ayuda de ${materia.nombre}`);
    assert.ok(materia.frase.length > 10,`Frase de ${materia.nombre}`);
    const creado=await profe.api('/roscos',{metodo:'POST',cuerpo:rosco({titulo:`Prueba de ${materia.nombre}`,materia:materia.nombre})});
    assert.equal(creado.estado,201,materia.nombre);
    const info=(await publico(`/r/${creado.datos.codigo}`)).datos;
    assert.equal(info.materia,materia.nombre);
    assert.equal(info.presentacion.personaje_id,materia.personaje_id);
    assert.equal(info.presentacion.imagen,materia.imagen);
    assert.equal(info.presentacion.festejo,null);
    assert.equal(info.presentacion.ayuda,materia.ayuda);
    assert.equal(info.entradas,undefined);
    const clase=await profe.api('/clases',{metodo:'POST',cuerpo:{nombre:`Curso de ${materia.nombre}`,materia:materia.nombre}});
    assert.equal(clase.estado,201,materia.nombre);
    if(materia.nombre==='Biología') {
      const sala=await profe.api('/salas',{metodo:'POST',cuerpo:{roscoId:creado.datos.id}});
      assert.equal(sala.estado,201);
      assert.equal((await publico(`/sala/${sala.datos.pin}`)).datos.presentacion.personaje_nombre,'BROTI');
      assert.equal((await profe.api(`/salas/${sala.datos.id}`)).datos.presentacion.personaje_nombre,'BROTI');
    }
  }
});

test('perfiles, clases y permisos de inscripción y asignación', async () => {
  const profe=await creador(),otro=await creador(),alumno=cliente(),ajeno=cliente();
  assert.equal((await alumno('/registro',{metodo:'POST',cuerpo:{alias:unico(),clave:'clave-alumno-segura',rol:'alumno'}})).estado,201);
  assert.equal((await alumno('/sesion')).datos.rol,'alumno');
  assert.equal((await profe.api('/sesion')).datos.rol,'docente');
  assert.equal((await ajeno('/registro',{metodo:'POST',cuerpo:{alias:unico(),clave:'clave-alumno-segura',rol:'alumno'}})).estado,201);
  assert.equal((await cliente()('/registro',{metodo:'POST',cuerpo:{alias:unico(),clave:'clave-suficiente',rol:'admin'}})).estado,400);
  assert.equal((await cliente()('/clases')).estado,401);
  assert.equal((await profe.api('/clases',{metodo:'POST',cuerpo:null})).estado,400);
  assert.equal((await alumno('/clases',{metodo:'POST',cuerpo:{nombre:'Mi clase',materia:'Matemática'}})).estado,403);
  assert.equal((await profe.api('/clases',{metodo:'POST',cuerpo:{nombre:'x',materia:'Matemática'}})).estado,422);
  assert.equal((await profe.api('/clases',{metodo:'POST',cuerpo:{nombre:'Clase nueva',materia:'Inventada'}})).estado,422);
  const {datos:clase,estado}=await profe.api('/clases',{metodo:'POST',cuerpo:{nombre:'Matemática 3B',materia:'Matemática'}});
  assert.equal(estado,201);assert.match(clase.codigo,/^[A-Z0-9]{6}$/);
  assert.equal((await otro.api(`/clases/${clase.id}`)).estado,404);
  assert.equal((await alumno(`/clases/${clase.id}`)).estado,404);
  assert.equal((await profe.api('/clases/unirse',{metodo:'POST',cuerpo:{codigo:clase.codigo}})).estado,403);
  assert.equal((await alumno('/clases/unirse',{metodo:'POST',cuerpo:{codigo:'invalid!'}})).estado,422);
  assert.equal((await alumno('/clases/unirse',{metodo:'POST',cuerpo:{codigo:clase.codigo.toLowerCase()}})).estado,200);
  assert.equal((await alumno('/clases/unirse',{metodo:'POST',cuerpo:{codigo:clase.codigo}})).estado,200);
  assert.equal((await alumno('/clases')).datos.clases.length,1);
  assert.equal((await ajeno('/clases')).datos.clases.length,0);
  assert.equal((await ajeno(`/clases/${clase.id}`)).estado,404);
  const {datos:actividad}=await profe.api('/roscos',{metodo:'POST',cuerpo:rosco()});
  const asignar={metodo:'POST',cuerpo:{roscoId:actividad.id}};
  assert.equal((await otro.api(`/clases/${clase.id}/roscos`,asignar)).estado,404);
  assert.equal((await alumno(`/clases/${clase.id}/roscos`,asignar)).estado,403);
  const {datos:extraneo}=await otro.api('/roscos',{metodo:'POST',cuerpo:rosco()});
  assert.equal((await profe.api(`/clases/${clase.id}/roscos`,{metodo:'POST',cuerpo:{roscoId:extraneo.id}})).estado,404);
  assert.equal((await profe.api(`/clases/${clase.id}/roscos`,asignar)).estado,200);
  assert.equal((await profe.api(`/clases/${clase.id}/roscos`,asignar)).estado,200);
  const paraAlumno=(await alumno(`/clases/${clase.id}`)).datos;
  assert.equal(paraAlumno.actividades.length,1);assert.equal(paraAlumno.actividades[0].codigo,actividad.codigo);
  assert.equal(paraAlumno.alumnos,undefined);assert.equal(paraAlumno.codigo,undefined);assert.equal(paraAlumno.actividades[0].entradas,undefined);
  const paraProfe=(await profe.api(`/clases/${clase.id}`)).datos;
  assert.equal(paraProfe.alumnos.length,1);assert.equal(paraProfe.actividades.length,1);
});

test("registro, sesión, salida e ingreso", async () => {
  const { api, alias } = await creador();
  assert.equal((await api("/sesion")).datos.alias, alias);
  await api("/salir", { metodo: "POST", cuerpo: {} });
  assert.equal((await api("/sesion")).datos.alias, null);
  assert.equal((await api("/ingreso", { metodo: "POST", cuerpo: { alias, clave: "incorrecta" } })).estado, 401);
  assert.equal((await api("/ingreso", { metodo: "POST", cuerpo: { alias: alias.toUpperCase(), clave: "contraseña-segura" } })).estado, 200);
});

test("no permite usuarios repetidos ni contraseñas cortas", async () => {
  const { alias } = await creador();
  const api = cliente();
  assert.equal((await api("/registro", { metodo: "POST", cuerpo: { alias: alias.toUpperCase(), clave: "otra-clave-larga", rol: "docente" } })).estado, 409);
  assert.equal((await api("/registro", { metodo: "POST", cuerpo: { alias: unico(), clave: "corta", rol: "docente" } })).estado, 400);
});

test("el código de recuperación cambia la contraseña y se usa una sola vez", async () => {
  const { alias, codigoRecuperacion } = await creador();
  const api = cliente();
  const primero = await api("/recuperar", { metodo: "POST", cuerpo: { alias, codigoRecuperacion, clave: "contraseña-nueva" } });
  assert.equal(primero.estado, 200);
  assert.notEqual(primero.datos.codigoRecuperacion, codigoRecuperacion);
  assert.equal((await api("/recuperar", { metodo: "POST", cuerpo: { alias, codigoRecuperacion, clave: "otra-clave-mas" } })).estado, 401);
  assert.equal((await cliente()("/ingreso", { metodo: "POST", cuerpo: { alias, clave: "contraseña-nueva" } })).estado, 200);
});

test("valida el contenido del rosco en el servidor", async () => {
  const { api } = await creador();
  const invalido = async (cuerpo) => (await api("/roscos", { metodo: "POST", cuerpo })).estado;
  assert.equal(await invalido(rosco({ titulo: "x" })), 422);
  assert.equal(await invalido(rosco({ entradas: rosco().entradas.slice(0, 2) })), 422);
  const entradas = rosco().entradas;
  assert.equal(await invalido(rosco({ entradas: [...entradas.slice(1), { ...entradas[0], letra: "B" }] })), 422);
  assert.equal(await invalido(rosco({ entradas: [{ ...entradas[0], letra: "Z" }, ...entradas.slice(1)] })), 422);
  assert.equal(await invalido(rosco({ entradas: [{ ...entradas[0], definicion: "El algoritmo es una serie de pasos." }, ...entradas.slice(1)] })), 422);
});

test("cada usuario solo ve y edita sus roscos", async () => {
  const dueno = await creador();
  const otro = await creador();
  const { datos } = await dueno.api("/roscos", { metodo: "POST", cuerpo: rosco() });
  assert.equal((await otro.api(`/roscos/${datos.id}`)).estado, 404);
  assert.equal((await otro.api(`/roscos/${datos.id}`, { metodo: "PUT", cuerpo: rosco() })).estado, 404);
  assert.equal((await otro.api(`/roscos/${datos.id}`, { metodo: "DELETE" })).estado, 404);
  assert.equal((await otro.api(`/roscos/${datos.id}/ranking`, { metodo: "DELETE" })).estado, 404);
  assert.equal((await cliente()("/roscos")).estado, 401);
  assert.equal((await dueno.api("/roscos")).datos.roscos.length, 1);
});

test("nunca envía las respuestas antes de terminar", async () => {
  const { api } = await creador();
  const { datos: creado } = await api("/roscos", { metodo: "POST", cuerpo: rosco() });
  const publico = cliente();
  const info = await publico(`/r/${creado.codigo}`);
  const inicio = await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo: { jugador: jugadorNuevo(), seudonimo: "Puma Veloz 42" } });
  assert.equal(inicio.estado, 201);
  const crudo = JSON.stringify([info.datos, inicio.datos]).toLowerCase();
  for (const palabra of ["algoritmo", "contraseña", "clave\""]) assert.ok(!crudo.includes(palabra), palabra);
});

test("partida completa: puntaje, ñ, alternativas, repetidas y correcciones", async () => {
  const { api } = await creador();
  const { datos: creado } = await api("/roscos", { metodo: "POST", cuerpo: rosco() });
  const publico = cliente();
  const jugador = jugadorNuevo();
  const { datos: partida } = await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo: { jugador, seudonimo: "Puma Veloz 42" } });
  const contestar = (pos, respuesta) => publico(`/intentos/${partida.token}/responder`, { metodo: "POST", cuerpo: { pos, respuesta } });

  assert.equal((await contestar(0, "  ALGORITMO ")).datos.correcta, true);
  assert.equal((await contestar(0, "algoritmo")).estado, 409);
  assert.equal((await contestar(1, "byte")).datos.correcta, false);
  assert.equal((await contestar(2, "Clave")).datos.correcta, true);
  assert.equal((await contestar(99, "x")).estado, 400);

  const pos = partida.items.findIndex((item) => item.letra === "Ñ");
  assert.equal(partida.items[pos].modo, "contiene");
  assert.equal((await contestar(pos, "ano")).datos.correcta, false);

  const fin = await contestar(partida.items.findIndex((item) => item.letra === "D"), "dato");
  assert.equal(fin.datos.terminado, true);
  assert.equal(fin.datos.resultado.aciertos, 3);
  assert.equal(fin.datos.resultado.errores, 2);
  assert.equal(fin.datos.resultado.correcciones.find((item) => item.letra === "B").palabra, "Bit");
  assert.equal((await contestar(1, "bit")).estado, 409);
});

test("recargar retoma la partida con el mismo reloj", async () => {
  const { api } = await creador();
  const { datos: creado } = await api("/roscos", { metodo: "POST", cuerpo: rosco() });
  const publico = cliente();
  const cuerpo = { jugador: jugadorNuevo(), seudonimo: "Lobo Sabio 15" };
  const primero = await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo });
  await publico(`/intentos/${primero.datos.token}/responder`, { metodo: "POST", cuerpo: { pos: 0, respuesta: "algoritmo" } });
  const segundo = await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo: { ...cuerpo, seudonimo: "Rayo Turbo 77" } });
  assert.equal(segundo.datos.token, primero.datos.token);
  assert.equal(segundo.datos.seudonimo, "Lobo Sabio 15");
  assert.equal(segundo.datos.respuestas[0], "correcta");
  assert.ok(segundo.datos.restanteMs <= primero.datos.restanteMs);
});

test("el ranking guarda el mejor resultado por jugador y ordena bien", async () => {
  const { api } = await creador();
  const { datos: creado } = await api("/roscos", { metodo: "POST", cuerpo: rosco() });
  const publico = cliente();
  const jugar = async (jugador, seudonimo, respuestas) => {
    const { datos } = await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo: { jugador, seudonimo } });
    for (const [pos, respuesta] of respuestas) await publico(`/intentos/${datos.token}/responder`, { metodo: "POST", cuerpo: { pos, respuesta } });
    await publico(`/intentos/${datos.token}/terminar`, { metodo: "POST", cuerpo: {} });
  };
  const ana = jugadorNuevo();
  await jugar(ana, "Puma Veloz 42", [[0, "algoritmo"]]);
  await jugar(ana, "Puma Veloz 42", [[0, "algoritmo"], [1, "bit"]]);
  await jugar(ana, "Puma Veloz 42", [[0, "nada"]]);
  await jugar(jugadorNuevo(), "Tucán Genial 33", [[0, "algoritmo"], [1, "bit"], [3, "dato"]]);
  await jugar(jugadorNuevo(), "Lobo Sabio 15", [[0, "nada"]]);

  const { datos } = await publico(`/r/${creado.codigo}/ranking`, { encabezados: { "x-jugador": ana } });
  assert.deepEqual(datos.ranking.map((fila) => [fila.seudonimo, fila.aciertos, fila.soyYo]), [
    ["Tucán Genial 33", 3, false], ["Puma Veloz 42", 2, true]
  ]);
  assert.ok(!JSON.stringify(datos).includes(ana));

  await api(`/roscos/${creado.id}/ranking`, { metodo: "DELETE" });
  assert.equal((await publico(`/r/${creado.codigo}/ranking`)).datos.ranking.length, 0);
});

test("rechaza seudónimos inventados, origen ajeno y código inexistente", async () => {
  const { api } = await creador();
  const { datos: creado } = await api("/roscos", { metodo: "POST", cuerpo: rosco() });
  const publico = cliente();
  assert.equal((await publico(`/r/${creado.codigo}/intentos`, { metodo: "POST", cuerpo: { jugador: jugadorNuevo(), seudonimo: "Juan Perez" } })).estado, 400);
  assert.equal((await publico("/r/ZZZZZZ")).estado, 404);
  assert.equal((await api("/roscos", { metodo: "POST", cuerpo: rosco(), encabezados: { origin: "https://malicioso.example" } })).estado, 403);
});

test("el enlace corto lleva a la página de juego", async () => {
  const respuesta = await fetch(`${BASE}/r/abc234`, { redirect: "manual" });
  assert.equal(respuesta.status, 302);
  assert.match(respuesta.headers.get("location"), /\/jugar\?c=ABC234$/);
});

test('power-ups: consumo único, pistas privadas, reintento y persistencia', async () => {
  const {api}=await creador(), publico=cliente();
  const contenido=rosco({powerups:true});
  contenido.entradas[0].pista='Pensá en una receta que ordena instrucciones.';
  const creado=await api('/roscos',{metodo:'POST',cuerpo:contenido});
  assert.equal(creado.estado,201);
  const cuerpo={jugador:jugadorNuevo(),seudonimo:'Puma Veloz 42'};
  const inicio=(await publico(`/r/${creado.datos.codigo}/intentos`,{metodo:'POST',cuerpo})).datos;
  assert.equal(inicio.powerups.habilitados,true);
  assert.equal(inicio.items[0].tienePista,true);
  assert.ok(!JSON.stringify(inicio).includes(contenido.entradas[0].pista));
  const usar=(tipo,pos)=>publico(`/intentos/${inicio.token}/powerups`,{metodo:'POST',cuerpo:{tipo,pos}});
  const sinPista=await usar('pista',1);assert.equal(sinPista.estado,409);
  const pista=await usar('pista',0);assert.equal(pista.estado,201);
  assert.equal(pista.datos.powerups.pistas[0],contenido.entradas[0].pista);
  assert.equal((await usar('pista',0)).estado,409);
  const extras=await Promise.all(Array.from({length:5},()=>usar('tiempo')));
  assert.equal(extras.filter(r=>r.estado===201).length,1);
  const retomada=(await publico(`/r/${creado.datos.codigo}/intentos`,{metodo:'POST',cuerpo})).datos;
  assert.equal(retomada.token,inicio.token);
  assert.ok(retomada.restanteMs>inicio.restanteMs+12000);
  assert.ok(retomada.restanteMs<=inicio.restanteMs+15000);
  assert.equal(retomada.powerups.pistas[0],contenido.entradas[0].pista);
  assert.equal((await usar('reintento',0)).estado,409);
  const responder=(pos,respuesta)=>publico(`/intentos/${inicio.token}/responder`,{metodo:'POST',cuerpo:{pos,respuesta}});
  assert.equal((await responder(0,'no sé')).datos.correcta,false);
  const intentos=await Promise.all([usar('reintento',0),usar('reintento',0)]);
  assert.equal(intentos.filter(r=>r.estado===201).length,1);
  assert.equal((await publico(`/intentos/${inicio.token}`)).datos.respuestas[0],undefined);
  assert.equal((await responder(0,'algoritmo')).datos.correcta,true);
  const resultado=(await publico(`/intentos/${inicio.token}/terminar`,{metodo:'POST',cuerpo:{}})).datos.resultado;
  assert.equal(resultado.aciertos,1);assert.equal(resultado.errores,0);
  assert.equal((await usar('tiempo')).estado,409);
  assert.equal((await responder(1,'bit')).estado,409);
});

test('power-ups: última letra errada permite reintentar y la configuración se conserva', async () => {
  const {api}=await creador(), publico=cliente();
  const contenido=rosco({powerups:true});
  const creado=(await api('/roscos',{metodo:'POST',cuerpo:contenido})).datos;
  assert.equal((await api(`/roscos/${creado.id}`)).datos.powerups,true);
  const jugador=jugadorNuevo(),cuerpo={jugador,seudonimo:'Puma Veloz 42'};
  const p=(await publico(`/r/${creado.codigo}/intentos`,{metodo:'POST',cuerpo})).datos;
  const responder=(pos,respuesta)=>publico(`/intentos/${p.token}/responder`,{metodo:'POST',cuerpo:{pos,respuesta}});
  for(let pos=0;pos<4;pos++) await responder(pos,contenido.entradas[pos].palabra);
  assert.equal((await responder(4,'error')).datos.terminado,false);
  const usar=await publico(`/intentos/${p.token}/powerups`,{metodo:'POST',cuerpo:{tipo:'reintento',pos:4}});
  assert.equal(usar.estado,201);
  const fin=await responder(4,'año');
  assert.equal(fin.datos.terminado,true);assert.equal(fin.datos.resultado.aciertos,5);assert.equal(fin.datos.resultado.errores,0);
  const sin=(await api('/roscos',{metodo:'POST',cuerpo:rosco({powerups:false})})).datos;
  const s=(await publico(`/r/${sin.codigo}/intentos`,{metodo:'POST',cuerpo})).datos;
  assert.equal((await publico(`/intentos/${s.token}/powerups`,{metodo:'POST',cuerpo:{tipo:'tiempo'}})).estado,409);
});

test('avatar y actividad: perfil propio, ranking y un único día por completar roscos', async () => {
  const cuenta=await creador(), publico=cliente();
  assert.equal((await publico('/perfil')).estado,401);
  assert.equal((await cuenta.api('/perfil',{metodo:'PATCH',cuerpo:{avatar:'../archivo'}})).estado,422);
  const elegido=await cuenta.api('/perfil',{metodo:'PATCH',cuerpo:{avatar:'broti'}});
  assert.equal(elegido.datos.avatar,'broti');assert.equal(elegido.datos.actividad.racha,0);
  const otro=await creador();assert.equal((await otro.api('/perfil')).datos.avatar,'voltio');
  const creado=(await cuenta.api('/roscos',{metodo:'POST',cuerpo:rosco()})).datos;
  for(let ronda=0;ronda<2;ronda++) {
    const inicio=await cuenta.api(`/r/${creado.codigo}/intentos`,{metodo:'POST',cuerpo:{jugador:jugadorNuevo(),seudonimo:'Puma Veloz 42'}});
    assert.equal(inicio.datos.avatar,'broti');
    let fin;
    for(let pos=0;pos<5;pos++) fin=await cuenta.api(`/intentos/${inicio.datos.token}/responder`,{metodo:'POST',cuerpo:{pos,respuesta:rosco().entradas[pos].palabra}});
    assert.equal(fin.datos.resultado.actividad.racha,1);
    assert.equal(fin.datos.resultado.actividad.diasTotales,1);
    assert.equal(fin.datos.resultado.actividad.hoyCompletado,true);
    await cuenta.api(`/intentos/${inicio.datos.token}/terminar`,{metodo:'POST',cuerpo:{}});
  }
  assert.equal((await cuenta.api('/perfil')).datos.actividad.diasTotales,1);
  assert.equal((await otro.api('/perfil')).datos.actividad.diasTotales,0);
  assert.equal((await publico(`/r/${creado.codigo}/ranking`)).datos.ranking[0].avatar,'broti');
  assert.equal((await publico(`/r/${creado.codigo}/intentos`,{metodo:'POST',cuerpo:{jugador:jugadorNuevo(),seudonimo:'Puma Veloz 42',avatar:'inexistente'}})).estado,422);
});

test('actividad: abandonar y completar sin aciertos no cumplen el objetivo diario', async()=>{
  const cuenta=await creador();
  const creado=(await cuenta.api('/roscos',{metodo:'POST',cuerpo:rosco()})).datos;
  const empezar=async()=> (await cuenta.api(`/r/${creado.codigo}/intentos`,{metodo:'POST',cuerpo:{jugador:jugadorNuevo(),seudonimo:'Puma Veloz 42',avatar:'leti'}})).datos;
  const p=await empezar();await cuenta.api(`/intentos/${p.token}/responder`,{metodo:'POST',cuerpo:{pos:0,respuesta:'algoritmo'}});
  await cuenta.api(`/intentos/${p.token}/terminar`,{metodo:'POST',cuerpo:{}});
  assert.equal((await cuenta.api('/perfil')).datos.actividad.diasTotales,0);
  const q=await empezar();for(let pos=0;pos<5;pos++)await cuenta.api(`/intentos/${q.token}/responder`,{metodo:'POST',cuerpo:{pos,respuesta:'error'}});
  assert.equal((await cuenta.api('/perfil')).datos.actividad.diasTotales,0);
});

test('rachas: fechas argentinas, ayer, cortes, récord e insignias', async()=>{
  const {calcularActividad,diaArgentina}=await import('../worker/perfil.js');
  assert.equal(diaArgentina(Date.parse('2026-11-07T02:59:59Z')),'2026-11-06');
  assert.equal(diaArgentina(Date.parse('2026-11-07T03:00:00Z')),'2026-11-07');
  let a=calcularActividad(['2026-11-03','2026-11-04','2026-11-05','2026-11-05'],'2026-11-06');
  assert.equal(a.racha,3);assert.equal(a.hoyCompletado,false);assert.equal(a.diasTotales,3);assert.deepEqual(a.insignias,[1,3]);
  a=calcularActividad(['2026-10-31','2026-11-01','2026-11-02','2026-11-04'],'2026-11-06');
  assert.equal(a.racha,0);assert.equal(a.mejorRacha,3);
  a=calcularActividad(['2026-11-06'],'2026-11-06');assert.equal(a.racha,1);assert.equal(a.semana.length,7);assert.equal(a.semana.at(-1).completado,true);
});

test('generador API: fuentes privadas, permisos, plan diario y configuración ausente',async()=>{
 const profe=await creador(),otro=await creador(),alumno=cliente();
 assert.equal((await alumno('/registro',{metodo:'POST',cuerpo:{alias:unico(),clave:'clave-alumno-prueba',rol:'alumno'}})).estado,201);
 assert.equal((await cliente()('/generador/config')).estado,401);
 assert.equal((await alumno('/generador/config')).estado,403);
 const contexto={materia:'Tecnología',jurisdiccion:'Nacional (NAP)',anio:1,modalidad:'General'};
 const fuente={...contexto,titulo:'Material sintético de prueba',organismo:'Equipo de prueba',version:'2026',referencia:'Sección 1',url:'https://www.argentina.gob.ar/',texto:'Este fragmento didáctico es una prueba local del motor y no constituye un documento curricular oficial. Un algoritmo representa una secuencia ordenada de instrucciones para resolver un problema.'};
 const creada=await profe.api('/generador/fuentes',{metodo:'POST',cuerpo:fuente});assert.equal(creada.estado,201);
 assert.equal((await otro.api('/generador/fuentes')).datos.fuentes.length,0);
 assert.equal((await profe.api('/generador/fuentes')).datos.fuentes.length,1);
 const pedido={...contexto,tema:'Algoritmos y programación',dificultad:'Inicial',cantidad:5,fuenteIds:[creada.datos.id],clave:crypto.randomUUID()};
 assert.equal((await otro.api('/generador/plan',{metodo:'POST',cuerpo:{...pedido,activo:true}})).estado,404);
 assert.equal((await profe.api('/generador/plan',{metodo:'POST',cuerpo:{...pedido,anio:2,activo:true}})).estado,422);
 assert.equal((await profe.api('/generador/plan',{metodo:'POST',cuerpo:{...pedido,activo:true}})).estado,200);
 const config=(await profe.api('/generador/config')).datos;assert.equal(config.plan.activo,true);
 assert.equal(config.GEMINI_API_KEY,undefined);
 if(!config.disponible)assert.equal((await profe.api('/generador/borradores',{metodo:'POST',cuerpo:pedido})).estado,503);
 assert.equal((await profe.api(`/generador/borradores/${crypto.randomUUID()}`)).estado,404);
 assert.equal((await profe.api('/generador/borradores')).datos.borradores.length,0);
 assert.equal((await profe.api('/generador/plan',{metodo:'POST',cuerpo:{activo:false}})).estado,200);
});
