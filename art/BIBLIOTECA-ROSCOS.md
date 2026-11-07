# Biblioteca de mis roscos

Cada rosco guardado puede reutilizarse para jugar, abrir una sala en vivo o asignarse a varias clases. Conserva su código, contenido y ranking compartido.

La biblioteca permite buscar por título o materia, filtrar por materia y ordenar por últimos cambios, título o cantidad de letras. Cada tarjeta muestra el personaje de la materia, duración y cantidad de letras.

## Crear desde una plantilla

«Usar como plantilla» abre un borrador con las preguntas, respuestas alternativas, materia y tiempo del original. Propone el título «Copia de…». El usuario puede cambiar todos esos datos antes de guardar.

Solo «Guardar como nuevo rosco» crea un registro. La copia recibe ID, código y ranking propios; no hereda jugadores ni asignaciones a clases. El original queda intacto. Volver sin guardar no crea una copia.

«Editar», dentro de «Más acciones», modifica el rosco original. El mismo menú conserva compartir, ranking y borrar.

## Implementación y validación

Reutiliza los endpoints autenticados de lectura y creación de roscos y la asignación existente a clases. No requiere migraciones nuevas. El servidor mantiene los permisos de propietario.

Prueba API focalizada: independencia de contenido, código, ranking y asignaciones del original y la copia. Recorrido visible: búsqueda, filtro de Matemática, creación desde plantilla, cambio de título/definición/tiempo, guardado y asignación a clase. Verificado sin desborde a 390 px. Empaquetado de despliegue en seco aprobado; no se publicó.

Capturas en `art/previews/biblioteca/`.
