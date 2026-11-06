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
