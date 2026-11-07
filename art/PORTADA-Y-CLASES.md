# Portada y clases de RoscoLab

Fecha: 2026-11-05. Público: secundaria. El usuario confirmó Kahoot como referencia de experiencia, con identidad propia basada en rosco y personajes por materia.

## Dirección visual

Se conserva la paleta noche/cian/amarillo/coral y las fuentes locales Montserrat e Inter del piloto. La portada abre con una composición de VOLTIO, PRISMO y LETI; más abajo aparecen los diez personajes. El recorrido principal distingue «Soy profe» y «Soy alumno». La explicación se divide en crear clase, unirse y jugar. La composición de personajes y la rueda pertenecen al producto; se evita reproducir la interfaz de otra marca.

## Recorridos implementados

- **Profe:** portada → registro de docente → guardar código de recuperación → Mis clases → crear clase → compartir invitación → crear o asignar rosco.
- **Alumno:** portada/invitación → registro de alumno → guardar código de recuperación → ingresar código de clase → ver desafíos → jugar.
- **Cuenta existente:** ingreso → Mis clases según rol persistido en el servidor.
- **Rosco suelto:** ingreso por código sin cuenta, conservando el modo anterior.
- **Piloto por equipos:** acceso al piloto de Matemática sin cuenta desde la portada.

Una clase es un grupo persistente con código propio. Un rosco es contenido reutilizable; puede asignarse a varias clases. Los códigos de clase y de rosco se presentan en formularios separados para evitar confusiones.

## Implementación

Portada `public/index.html`; acceso contextual `public/acceso.html`; tablero y detalle `public/clases.html`. Módulos propios y estilos en `public/assets/`. Miniaturas de 320 × 320 para los diez personajes.

Migración `0002_clases.sql`: rol en usuarios existentes (docente por compatibilidad), clases, membresías y asignaciones. Roles admitidos: docente/alumno. La autorización se valida en el servidor para crear clases, consultar detalles y asignar contenido. Los alumnos reciben metadatos de actividades, sin respuestas ni nómina de otros alumnos.

El editor existente recibe el contexto de clase: un rosco nuevo se asigna al guardar. Si falla esa asignación, el rosco guardado permanece disponible en la biblioteca.

## Verificación

Pruebas de API para roles, límites de campos, pertenencia, inscripción idempotente y asignación de contenido propio. Prueba en navegador con dos cuentas nuevas: registro, confirmación de contraseñas, código de recuperación, creación de varias clases, creación/asignación de rosco, invitación, inscripción y apertura del juego. Revisión de portada y paneles en escritorio y móvil. Capturas en `art/previews/plataforma/`.

El empaquetado de Worker y assets pasó la verificación de despliegue en seco. La configuración conserva un identificador de D1 de ejemplo: hay que crear/configurar la base remota y aplicar migraciones antes de publicar. No se hizo un despliegue desde esta sesión.

## Próximas etapas propuestas

1. Sala de espera y partida sincronizada controlada por el profe.
2. Desafíos asignados con fecha de cierre y estados de avance.
3. Historial del alumno vinculado a la cuenta e informes por clase. Actualmente el juego conserva la identidad anónima por navegador y su ranking previo.
4. Integrar los personajes y la identidad del piloto en el jugador individual y el editor de roscos.
5. Prueba de aula para medir preparación, comprensión y repetición voluntaria antes de ampliar recompensas.

Estas etapas son propuestas; no están implementadas. Tampoco hay verificación institucional del rol docente en esta versión: el perfil se elige al crear la cuenta.

## Referencia consultada

La documentación oficial de Kahoot distingue las partidas en vivo de las asignaciones a ritmo propio y describe el acceso mediante enlace o PIN. Se toma como referencia para separar futuros modos de uso, sin asumir equivalencia de funciones ni superioridad del producto:

- [Asignaciones en Kahoot](https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform).
- [Cómo unirse a una partida de Kahoot](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game).
