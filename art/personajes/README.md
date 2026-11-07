# Personajes del juego

## Colección por materias

El usuario aprobó VOLTIO como referencia visual y amplió el alcance: cada docente podrá crear un rosco de su materia. Esta entrega agrega nueve diseños base, pendientes de revisión:

| Materia | Personaje | Archivo |
|---|---|---|
| Lengua | LETI | `leti-base.png` |
| Matemática | PRISMO | `prismo-base.png` |
| Geografía | MUNDI | `mundi-base.png` |
| Historia | CRONO | `crono-base.png` |
| Música | MELO | `melo-base.png` |
| Biología | BROTI | `broti-base.png` |
| Artística | TRAZO | `trazo-base.png` |
| Física | ÁTOMO | `atomo-base.png` |
| Química | BURBU | `burbu-base.png` |

Abrir `galeria.html` para revisarlos juntos. `materias-catalogo.json` conserva la relación materia/personaje y los prompts exactos usados con image_gen integrada y VOLTIO como referencia. Todos los PNG se normalizaron a 1024 × 1024 conservando alpha. No están integrados todavía a la interfaz del juego. Las poses reposo/pensando/festejo/fallo siguen pendientes.

La colección tecnológica de once acompañantes descrita al final de esta nota corresponde al brief original y queda en espera tras la ampliación a materias.

## VOLTIO — propuesta base

`voltio-base.png`: PNG RGBA de 1024 × 1024, fondo transparente. Diseño aprobado por el usuario como referencia visual de la colección. No corresponde todavía a la pose de reposo.

Generado con la herramienta integrada image_gen. Se hizo una segunda generación para ampliar el margen, manteniendo el diseño. La salida nativa de 1254 × 1254 se normalizó a 1024 × 1024 conservando alpha.

Los prompts exactos están en `voltio-prompts.txt`. Usar la imagen aprobada como referencia visual al generar los otros once personajes y las cuatro poses por personaje.

Pendientes tras aprobar VOLTIO: CHIPI, RATONCIO, BATTI, ONDI, NUBI, BUGUI, BIT, FUEGUI, LLAVÍN, PIXELA y DISQUETÍN; poses reposo, pensando, festejo y fallo; insignias y fondo de ciudad de circuitos.
