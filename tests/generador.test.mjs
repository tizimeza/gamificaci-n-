import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fuenteValida,solicitudValida,validarBorrador,pedirGemini} from '../worker/gemini.js';
import {generarRosco,prepararBorradoresDiarios} from '../worker/generador.js';

const contexto={materia:'Tecnología',jurisdiccion:'Nacional (NAP)',anio:1,modalidad:'General'};
const fuente={...contexto,id:'11111111-1111-4111-8111-111111111111',titulo:'Material sintético para pruebas',organismo:'Equipo de prueba',version:'2026',referencia:'Sección 1',url:'https://www.argentina.gob.ar/',texto:'Un algoritmo es una secuencia finita y ordenada de instrucciones para resolver un problema. Un bit es la unidad mínima de información digital. Un cable permite transportar señales mediante un conductor. Un dato es una representación de información para procesar. Un enlace conecta un recurso digital con otro recurso.'};
const solicitud={...contexto,tema:'Conceptos de informática',cantidad:5,dificultad:'Inicial',fuenteIds:[fuente.id]};
const datos={titulo:'Informática para empezar',objetivo:'Reconocer conceptos básicos de informática y sus relaciones.',entradas:[
 {letra:'A',palabra:'Algoritmo',definicion:'Secuencia ordenada de pasos para resolver un problema.',pista:'Pensá en una receta.',evidencia:'Un algoritmo es una secuencia finita y ordenada de instrucciones para resolver un problema.'},
 {letra:'B',palabra:'Bit',definicion:'Unidad mínima de información digital.',pista:'Puede valer cero o uno.',evidencia:'Un bit es la unidad mínima de información digital.'},
 {letra:'C',palabra:'Cable',definicion:'Conductor físico que transporta señales.',pista:'Conecta dispositivos físicamente.',evidencia:'Un cable permite transportar señales mediante un conductor.'},
 {letra:'D',palabra:'Dato',definicion:'Representación de información que se puede procesar.',pista:'Puede ser un número o un texto.',evidencia:'Un dato es una representación de información para procesar.'},
 {letra:'E',palabra:'Enlace',definicion:'Conexión entre dos recursos digitales.',pista:'Podés seguirlo con un clic.',evidencia:'Un enlace conecta un recurso digital con otro recurso.'}
].map(e=>({...e,alternativas:[],fuenteId:fuente.id,explicacion:'La definición se relaciona con el concepto mencionado en el material.'}))};
const respuesta=()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(datos)}]}}]}),{headers:{'content-type':'application/json'}});
function entorno(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
 const usuario=crypto.randomUUID();db.prepare('INSERT INTO usuarios(id,alias,clave,recuperacion,creado,rol) VALUES(?,?,?,?,?,?)').run(usuario,'prueba','hash-prueba','hash-prueba',Date.now(),'docente');
 db.prepare('INSERT INTO fuentes_curriculares(id,usuario_id,materia,jurisdiccion,anio,modalidad,titulo,organismo,version,referencia,url,texto,creado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(fuente.id,usuario,fuente.materia,fuente.jurisdiccion,fuente.anio,fuente.modalidad,fuente.titulo,fuente.organismo,fuente.version,fuente.referencia,fuente.url,fuente.texto,Date.now());
 return {db,usuario,env:{DB:{prepare:sql=>wrap(sql)},GEMINI_API_KEY:'secreto-sintetico-de-prueba',GEMINI_MODEL:'gemini-3.8-flash',GENERADOR_LIMITE_DIARIO:'1'}};
}

test('generador: valida contexto, cantidad, fuentes y referencias HTTPS',()=>{
 assert.equal(solicitudValida(solicitud,['Tecnología']).cantidad,5);
 assert.equal(fuenteValida(fuente,['Tecnología']).referencia,'Sección 1');
 for(const patch of [{anio:8},{cantidad:27},{fuenteIds:[]},{fuenteIds:[fuente.id,fuente.id]},{materia:'Inventada'}])assert.throws(()=>solicitudValida({...solicitud,...patch},['Tecnología']));
 assert.throws(()=>fuenteValida({...fuente,url:'http://localhost:8788'},['Tecnología']));
});
test('generador: rechaza citas inventadas, letras y definiciones repetidas',()=>{
 assert.equal(validarBorrador(datos,solicitud,[fuente]).rosco.entradas.length,5);
 for(const patch of [{fuenteId:crypto.randomUUID()},{evidencia:'Esta oración no está dentro del documento original.'},{letra:'B'},{pista:'La respuesta es algoritmo.'}]){
  const copia=structuredClone(datos);Object.assign(copia.entradas[0],patch);assert.throws(()=>validarBorrador(copia,solicitud,[fuente]));
 }
 assert.throws(()=>validarBorrador(datos,solicitud,[fuente],[datos.entradas[0].definicion]));
 assert.throws(()=>validarBorrador({...datos,entradas:[]},solicitud,[fuente]));
});
test('Gemini: contrato REST estructurado y credencial solo en encabezado',async()=>{
 let pedidos=0;
 const fetcher=async(url,options)=>{pedidos++;assert.ok(url.endsWith('/gemini-3.8-flash:generateContent'));assert.ok(!url.includes('clave-sintetica'));assert.equal(options.headers['x-goog-api-key'],'clave-sintetica');const body=JSON.parse(options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.responseJsonSchema.properties.entradas.minItems,5);assert.ok(!JSON.stringify(body).includes('clave-sintetica'));return respuesta();};
 const borrador=await pedirGemini({key:'clave-sintetica',modelo:'gemini-3.8-flash',solicitud,fuentes:[fuente],fetcher});assert.equal(pedidos,1);assert.equal(borrador.referencias.length,5);
 await assert.rejects(()=>pedirGemini({key:'clave-sintetica',modelo:'gemini-3.8-flash',solicitud,fuentes:[fuente],fetcher:async()=>new Response('error privado',{status:429})}),e=>e.estado===429&&!e.message.includes('privado'));
 await assert.rejects(()=>pedirGemini({key:'clave-sintetica',modelo:'gemini-3.8-flash',solicitud,fuentes:[fuente],fetcher:async()=>{throw Error('clave-sintetica');}}),e=>e.estado===502&&!e.message.includes('clave-sintetica'));
});
test('motor SQLite: borrador persistente, idempotencia y presupuesto diario',async t=>{
 const {env,usuario,db}=entorno(t);let pedidos=0;const fetcher=async()=>{pedidos++;return respuesta();};
 const clave=crypto.randomUUID(),primero=await generarRosco(env,usuario,solicitud,clave,{fetcher});assert.equal(primero.estado,'listo');assert.equal(db.prepare('SELECT COUNT(*) n FROM roscos').get().n,0);
 const repetido=await generarRosco(env,usuario,solicitud,clave,{fetcher});assert.equal(repetido.id,primero.id);assert.equal(pedidos,1);
 await assert.rejects(()=>generarRosco(env,usuario,{...solicitud,tema:'Otro tema'},clave,{fetcher}),e=>e.estado===409);
 const limite=await generarRosco(env,usuario,solicitud,crypto.randomUUID(),{fetcher});assert.equal(limite.estado,'fallido');assert.match(limite.error,/máximo diario/);assert.equal(pedidos,1);
});
test('motor SQLite: aislamiento de fuentes y configuración ausente sin consumo',async t=>{
 const {env,usuario,db}=entorno(t);
 await assert.rejects(()=>generarRosco(env,crypto.randomUUID(),solicitud,crypto.randomUUID()),e=>e.estado===404);
 await assert.rejects(()=>generarRosco(env,usuario,{...solicitud,anio:2},crypto.randomUUID()),e=>e.estado===422);
 await assert.rejects(()=>generarRosco({...env,GEMINI_API_KEY:''},usuario,solicitud,crypto.randomUUID()),e=>e.estado===503);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM generacion_cuotas').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM generaciones').get().n,0);
 assert.equal((await prepararBorradoresDiarios({...env,GENERACION_DIARIA:'false'})).preparados,0);
});
test('motor SQLite: pedidos concurrentes no llaman dos veces al proveedor',async t=>{
 const {env,usuario}=entorno(t);let liberar,avisar;const inicio=new Promise(r=>avisar=r),espera=new Promise(r=>liberar=r);let pedidos=0;
 const clave=crypto.randomUUID(),fetcher=async()=>{pedidos++;avisar();await espera;return respuesta();};
 const primero=generarRosco(env,usuario,solicitud,clave,{fetcher});await inicio;
 const repetido=await generarRosco(env,usuario,solicitud,clave,{fetcher});assert.equal(repetido.estado,'generando');
 await assert.rejects(()=>generarRosco(env,usuario,solicitud,crypto.randomUUID(),{fetcher}),e=>e.estado===409);
 liberar();assert.equal((await primero).estado,'listo');assert.equal(pedidos,1);
});

test('plan diario SQLite: una generación por fecha y sin publicación automática',async t=>{
 const {env,usuario,db}=entorno(t);let pedidos=0;
 db.prepare('INSERT INTO planes_generacion(usuario_id,activo,solicitud,actualizado) VALUES(?,1,?,?)').run(usuario,JSON.stringify(solicitud),Date.now());
 const diario={...env,GENERACION_DIARIA:'true'},fetcher=async()=>{pedidos++;return respuesta();};
 assert.equal((await prepararBorradoresDiarios(diario,{fetcher})).preparados,1);
 assert.equal((await prepararBorradoresDiarios(diario,{fetcher})).preparados,1);
 assert.equal(pedidos,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM generaciones').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM roscos').get().n,0);
});

test('revisión de borrador: permisos y confirmación antes de crear un rosco',async t=>{
 const {env,usuario,db}=entorno(t);
 const g=await generarRosco(env,usuario,solicitud,crypto.randomUUID(),{fetcher:async()=>respuesta()});
 const token='a'.repeat(64);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 db.prepare('INSERT INTO sesiones(token_hash,usuario_id,vence) VALUES(?,?,?)').run(hash,usuario,Date.now()+60000);
 const {default:worker}=await import('../worker/index.js');
 const enviar=body=>worker.fetch(new Request('http://localhost/api/roscos',{method:'POST',headers:{'content-type':'application/json',cookie:`rosco_sesion=${token}`},body:JSON.stringify(body)}),env);
 assert.equal((await enviar({...g.borrador.rosco,generacionId:g.id})).status,422);
 const guardado=await enviar({...g.borrador.rosco,generacionId:g.id,revisionConfirmada:true});assert.equal(guardado.status,201);
 assert.equal(db.prepare('SELECT generacion_id FROM roscos').get().generacion_id,g.id);
 assert.equal((await enviar({...g.borrador.rosco,generacionId:crypto.randomUUID(),revisionConfirmada:true})).status,404);
});
