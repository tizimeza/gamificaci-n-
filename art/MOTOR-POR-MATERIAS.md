# Un jugador para todas las materias

Fecha: 2026-11-06. Implementado localmente; pendiente de publicación.

## Qué se comparte

El mismo `public/jugar.html` y su módulo de juego resuelven las partidas individuales y las salas en vivo. Las letras, preguntas, respuestas admitidas, título y tiempo se leen de cada rosco guardado en D1. El servidor conserva la validación de respuestas, los puntajes y los permisos.

El componente `crearPersonaje` se usa en la bienvenida, espera, centro del rosco, resultados y pantalla del anfitrión. Las reacciones de acierto/error son compartidas y respetan movimiento reducido.

## Qué configura la base de datos

La migración `0004_materias.sql` agrega el catálogo `materias`. Incluye las diez materias de la colección y «Otra» como opción genérica.

| Campo | Uso |
|---|---|
| `id`, `nombre` | Identidad de la materia y nombre que se selecciona en el editor |
| `personaje_id`, `personaje_nombre` | Personaje y nombre visible |
| `imagen`, `miniatura` | Rutas locales de los archivos del personaje |
| `color` | Acento visual del jugador |
| `festejo` | Video opcional aprobado; nulo de forma predeterminada |
| `orden`, `visible` | Orden y disponibilidad al crear contenido |

`GET /api/materias` alimenta el editor, los formularios de clases y la galería de portada. La presentación viaja también en los datos públicos del rosco y de la sala. Las preguntas correctas no se incluyen en esos metadatos.

Para agregar una materia con assets existentes, alcanza con una fila nueva en el catálogo: la selección y la validación consultan D1. Para un personaje nuevo también hay que guardar sus archivos en las rutas indicadas. Cambiar el nombre de una materia que ya usan roscos o clases requiere actualizar esas referencias de texto; no renombrarla aisladamente.

El arreglo `MATERIAS` de las reglas queda como valor predeterminado para uso aislado/compatibilidad. El editor online, las clases y la validación del servidor pasan el catálogo de D1 explícitamente. Las plantillas del editor son ejemplos iniciales; al guardarlas pasan a ser contenido de cada rosco en la base.

## Animaciones

Si se configura un video local en `festejo`, el componente puede reproducirlo en un acierto y volver a la imagen al terminar. Usa reproducción silenciosa, recuperación a imagen si falla y respeta movimiento reducido. No cambia el tiempo ni bloquea la partida. El video de prueba de PRISMO no está habilitado automáticamente: necesita corregir detalles de diseño y ajustar duración.

## Verificación

- Pasaron las veinte pruebas existentes de API y salas en vivo.
- Pasó la prueba nueva de catálogo: creación de roscos y clases para las once opciones, correspondencia de personaje y metadatos públicos, y BROTI en sala pública/anfitrión.
- Lengua y Biología se completaron en navegador con 5/5 usando el mismo jugador y preguntas distintas guardadas en D1.
- Comprobada ausencia de desborde horizontal en Biología a 390 píxeles. Capturas de escritorio en `art/previews/materias/`.
- Se conserva el piloto independiente de Matemática por equipos como demostración local; la experiencia conectada a la base usa el jugador común.

## Ejemplos locales de revisión

- Lengua: `http://localhost:8788/jugar?c=TVTBDU`.
- Biología: `http://localhost:8788/jugar?c=GZ6XHU`.

Son datos sintéticos de demostración de la base local de QA, no cursos reales ni ejemplos ya publicados.
