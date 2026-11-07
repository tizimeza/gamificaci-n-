# Motor de roscos con Gemini y fuentes curriculares

Estado al 2026-11-06: motor, interfaz docente y programación de borradores implementados localmente. Falta configurar GEMINI_API_KEY y validar una generación con el proveedor real. Las pruebas usan respuestas simuladas; no se consumió Gemini. Las secciones de propuesta describen el rumbo del producto; el alcance efectivamente implementado se detalla a continuación.

## Primera versión

Un Desafío del día de 12 letras, para secundaria, con materia rotativa, tema y dificultad definidos antes de generar. Cada pregunta debe incluir palabra, definición, alternativas válidas, pista y explicación breve de la respuesta. El desafío se genera una vez y se guarda en D1; todos juegan la misma versión durante ese día. No se consulta a Gemini por alumno o por respuesta.

## Flujo

1. Programar temario semanal por materia/año, con material docente o fuentes seleccionadas.
2. Un proceso programado en Cloudflare prepara borradores con Gemini usando un esquema JSON.
3. Validar estructura con las reglas compartidas, letras, respuestas, pistas y duplicados. Separar validación técnica de revisión factual.
4. Panel editorial: revisar, corregir, aprobar o rechazar. Gemini no garantiza corrección conceptual por entregar JSON válido.
5. Publicar el contenido aprobado según fecha de Argentina. Mantener siete desafíos revisados en reserva; si la API falla se usa la reserva.
6. Mostrar tarjeta Desafío del día, materia, personaje, dificultad y ranking diario. Completarlo contribuye al objetivo y racha existentes. Los profes pueden copiarlo como plantilla.

## Controles operativos propuestos

Clave de Gemini guardada únicamente como secreto de servidor. Modelo configurable. Tope de generación, reintentos limitados y clave única por fecha/edición para evitar publicaciones y costos repetidos. Publicación por fecha sobre una versión aprobada e inmutable; correcciones posteriores deben versionarse para no cambiar partidas ya iniciadas. No enviar identidades ni respuestas de alumnos al generador.

Agregar posteriormente generación bajo demanda del profe con tema/año o material propio; siempre pasa por borrador editable. No habilitar compra ni consumo hasta configurar la cuenta y sus límites.

## Requisitos antes de activar

API key de Google AI Studio, modelo/cuota disponibles, responsable editorial y D1 real con Worker desplegado. La sesión de Google en Chrome no configura por sí sola la credencial del backend.

## Referencias oficiales consultadas

- JSON estructurado y límites de validación: https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- Claves: https://ai.google.dev/gemini-api/docs/api-key
- Cuotas y precios: https://ai.google.dev/gemini-api/docs/rate-limits y https://ai.google.dev/gemini-api/docs/pricing
- Programación diaria: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Base curricular oficial argentina (propuesta añadida 2026-11-06)

Organizar el corpus por jurisdicción, modalidad/orientación, año/ciclo, materia, eje y contenido. Los NAP aportan la base nacional; los diseños jurisdiccionales determinan la selección por provincia y año. Para secundaria técnica, sumar marcos de referencia del INET según especialidad, sin tratarlos como reemplazo del plan jurisdiccional. Falta elegir provincia y verificar documentos/versiones aplicables antes de cargar un corpus.

Cada documento debe registrar organismo, título, fecha/versión, resolución cuando corresponda, URL oficial, fecha de consulta y páginas/secciones. Cada borrador debe conservar los fragmentos curriculares usados, referencias y objetivo trabajado; si no tiene respaldo suficiente, vuelve a revisión. El docente puede ajustar el recorrido al programa real de la clase.

El diseño curricular delimita contenidos y capacidades, pero puede no aportar definiciones o hechos suficientes para justificar cada respuesta. Complementar con material educativo confiable seleccionado por el docente. Generar preguntas originales; no presentar la salida como material oficial ni asumir alineación por pedirle a Gemini «seguí el currículo» sin suministrar los documentos. La búsqueda/recuperación debe filtrar por contexto antes de generar, no mezclar años/provincias.

Fuentes oficiales relevadas:
- NAP por ciclo y área: https://www.argentina.gob.ar/nucleos-de-aprendizaje-prioritarios
- Colección NAP del Consejo Federal: https://www.educ.ar/recursos/150199/coleccion-ncleos-de-aprendizajesprioritarios-nap
- Marcos de referencia secundaria técnica: https://www.inet.edu.ar/index.php/niveles-educativos/educacion-secundaria-tecnica/marcos-de-referencia-de-nivel-secundario/

No se descargaron ni indexaron documentos, no se implementó la integración y no se confirmó una provincia.


## Implementación local

Entrá a `/generador` desde «Mis roscos → Crear con Gemini». Solo docentes autenticados pueden usarlo. Elegí materia, jurisdicción, año, modalidad, tema, dificultad y entre 5 y 12 letras. No se asumió provincia: el valor inicial es Nacional (NAP).

La biblioteca guarda fragmentos de hasta 8000 caracteres con título, organismo, versión, página/sección y URL HTTPS. Las fuentes son privadas de cada docente; se seleccionan de una a tres del mismo contexto. La URL se conserva como referencia: no se descarga un PDF ni se verifica automáticamente que el texto corresponda al documento. El docente debe aportar el fragmento pertinente. No se creó todavía un corpus oficial nacional/provincial ni se decidió provincia.

El proveedor recibe un esquema JSON, el pedido y los fragmentos, sin datos de alumnos ni identidad del docente. Cada entrada requiere palabra, definición, alternativas, pista, explicación, fuenteId y cita literal. El motor verifica reglas del rosco, cantidad exacta, duplicados dentro del borrador, últimas 120 definiciones de hasta diez borradores previos y presencia de la cita en el fragmento recibido. La coincidencia literal no demuestra exactitud conceptual; la revisión docente sigue siendo necesaria.

El borrador tiene estados generando/listo/fallido. No crea un rosco ni un código jugable. «Revisar en el editor» permite editar preguntas, consultar las evidencias originales y confirmar la revisión antes de guardar. El servidor comprueba propiedad del borrador y confirmación; el rosco conserva generacion_id. Las referencias describen el borrador original, no se recalculan al editar preguntas.

### Programación y límites

Un plan privado por docente prepara hasta un borrador por fecha de Argentina. El Cron está definido a las 08:00 UTC (05:00 de Argentina), pero la generación diaria viene desactivada con GENERACION_DIARIA=false. No hay publicación automática, catálogo público Desafío del día, reserva editorial ni rotación de temarios todavía: el plan repite el tema/contexto guardados y pide variantes.

La clave única usuario/pedido y el bloqueo de un trabajo en curso evitan llamadas duplicadas. Los trabajos interrumpidos se marcan fallidos al iniciar otro pedido después de 150 segundos. No se reintenta automáticamente una llamada. Tiempo de espera del proveedor: 45 segundos. Máximo manual: cinco solicitudes por docente por ventana de 24 horas; máximo de plataforma: veinte llamadas al día, configurable entre 1 y 100. La cuota cuenta intentos enviados, incluso si el proveedor falla. El cron procesa hasta veinte planes por ejecución, con concurrencia tres y prioridad a quienes llevan más tiempo sin generar. Es un límite de llamadas, no un presupuesto monetario.

### Configurar localmente

1. Copiar `.dev.vars.example` a `.dev.vars`, que está ignorado por Git.
2. Cargar GEMINI_API_KEY solo en ese archivo y elegir GEMINI_MODEL según los modelos disponibles en la cuenta. Se dejó gemini-3.8-flash como valor configurable según la documentación consultada el 2026-11-06.
3. Ejecutar `npm run db` y reiniciar Wrangler para que lea los secretos. En QA, usar la misma opción --persist-to que el servidor.
4. Probar una generación manual real con material revisado y verificar el borrador antes de activar planes diarios.
5. Para activar el cron en el entorno correspondiente, establecer GENERACION_DIARIA=true y guardar un plan activo. Si falta la clave o el modelo, no se ejecuta.

En producción: configurar D1 real y aplicar migraciones; guardar la clave mediante `npx wrangler secret put GEMINI_API_KEY`. Nunca ponerla en public/, en wrangler.jsonc ni en el navegador. Revisar modelo, cuota y facturación del proyecto antes de habilitar el cron.

### Archivos y API

- Migración: 0008_generador.sql (fuentes, generaciones, cuotas, planes y origen del rosco).
- worker/gemini.js: validación, prompt y adaptador REST.
- worker/generador.js: persistencia, permisos, idempotencia, cuotas y tarea diaria.
- public/generador.html y assets/js/generador.js: interfaz docente.
- GET /api/generador/config
- GET/POST /api/generador/fuentes
- GET/POST /api/generador/borradores y GET /api/generador/borradores/:id
- POST /api/generador/plan

### Verificación y alcance

37 pruebas aprobadas: API, salas y ocho pruebas específicas del motor con SQLite real en memoria y proveedor simulado. Se probaron contratos de petición/respuesta, cuotas, concurrencia, aislamiento de fuentes, programación idempotente y revisión obligatoria. El contrato REST se contrastó con https://ai.google.dev/api/generate-content y las guías oficiales de salida estructurada; falta confirmar el comportamiento real con la cuenta y modelo elegidos.

QA visible: cargar fuente sintética, guardar/desactivar plan, abrir borrador simulado, bloquear guardado sin revisión y crear el rosco independiente después de confirmar. El borrador simulado está rotulado «Simulación local» y su modelo es simulacion-local-no-gemini; no es contenido emitido por Google. Sin desborde a 390 px. Empaquetado en seco aprobado. Migraciones aplicadas solo a desarrollo y QA locales. Capturas en art/previews/generador/.

Sin nuevo commit, push ni despliegue. Pendiente: clave/modelo y prueba real, selección/carga de diseños oficiales, curaduría y publicación del Desafío del día.
