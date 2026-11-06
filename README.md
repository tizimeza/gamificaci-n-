# RoscoLab

Plataforma de roscos educativos para secundaria. Cada profe puede crear clases, preparar preguntas y asignar desafíos. Los alumnos se registran con un alias, se unen mediante código de clase y juegan los roscos asignados. La portada presenta diez personajes por materia.

## Desarrollo local

```sh
npm install
npm run dev
```

Abrí la dirección que muestra Wrangler (habitualmente `http://localhost:8787`). El comando prepara CSS/fuentes, aplica las migraciones locales e inicia el servidor con la API y la base D1 local.

## Pantallas

- `public/index.html`: portada, personajes y explicación de la mecánica.
- `public/acceso.html?modo=registro&rol=docente`: registro de profes.
- `public/acceso.html?modo=registro&rol=alumno`: registro de alumnos.
- `public/clases.html`: clases propias o inscripciones, invitaciones y actividades.
- `public/panel.html`: biblioteca y editor de roscos.
- `public/jugar.html?c=CODIGO`: juego con código de rosco o de sala, y ranking.
- `public/sala.html?id=SALA`: pantalla para proyectar y conducir una sala en vivo.
- `public/matematica.html`: piloto de Matemática por equipos con PRISMO.
- `public/aula.html`: Rosco Eléctrico original para proyectar.

Los dos últimos modos pueden abrirse directamente como archivos y guardan la partida en el navegador. Las cuentas, clases y roscos compartidos requieren el servidor. No alcanza con subir únicamente los HTML a un hosting estático.

## Cuentas y clases

El registro pide alias y contraseña, sin email. Al crear o recuperar una cuenta se entrega un código de recuperación que debe guardarse. El rol se elige al registrarse; las cuentas anteriores a la migración de clases conservan el rol docente por compatibilidad.

El código de clase inscribe al alumno en un grupo. El código de rosco abre un desafío individual; también se mantiene ese acceso sin cuenta. Los roles, la pertenencia a clases y la propiedad del contenido se validan en la API. El ranking individual conserva el seudónimo por navegador; todavía no es un informe académico vinculado a la cuenta del alumno.

El ingreso y el registro viven solo en `acceso.html`. Profes y alumnos pueden crear roscos desde «Mis roscos».

## Sala en vivo

Quien creó un rosco abre una sala desde «Mis roscos» o desde una clase. Comparte el código, ve quién entra y toca «Empezar»: tras cinco segundos de cuenta regresiva, todos juegan el mismo rosco con el mismo reloj y un marcador en vivo. Para jugar no hace falta cuenta. Quien llega tarde se suma con el tiempo que queda. Los resultados también cuentan para el ranking del rosco.

Las pantallas consultan el estado cada 2 a 4 segundos, sin WebSockets, porque las redes escolares suelen bloquearlos. Las definiciones se entregan recién al llegar la hora de inicio, y el repaso con las respuestas aparece cuando cierra la sala, para que nadie se las pase al resto.

## Verificaciones

Con el servidor local en marcha:

```sh
npm test
npm run deploy:check
```

`BASE` permite apuntar las pruebas de API a otro servidor local. Para repetir pruebas sin compartir cuentas ni límites de registro con el entorno de desarrollo, usá una base local aislada:

```sh
npx wrangler d1 migrations apply roscolab --local --persist-to .wrangler/qa-onboarding
npx wrangler dev --port 8788 --persist-to .wrangler/qa-onboarding
```

Después ejecutá las pruebas con `BASE=http://localhost:8788` en el entorno de tu terminal. `deploy:check` compila los estilos y comprueba el paquete sin publicarlo.

## Preparar producción en Cloudflare

`wrangler.jsonc` usa un identificador D1 de ejemplo. Antes de publicar:

1. Autenticá tu cuenta con `npx wrangler login`.
2. Creá una base con `npx wrangler d1 create roscolab` y poné el `database_id` devuelto en `wrangler.jsonc`.
3. Aplicá el esquema con `npx wrangler d1 migrations apply roscolab --remote`.
4. Ejecutá `npm run deploy:check` y, con la configuración lista, `npx wrangler deploy`.

Este repositorio incluye Worker, assets y migraciones. La base local y sus usuarios de prueba no se publican automáticamente. No se hizo un despliegue de producción desde la sesión de portada y clases.

## Diseño y alcance

### Materias y personajes desde D1

`0004_materias.sql` configura el catálogo de materias, personajes, imágenes, color y video de festejo opcional. El editor, las clases y la portada consultan `/api/materias`; el mismo jugador presenta todos los roscos, individuales o en vivo. Título, preguntas, respuestas, tiempo y resultados siguen en las tablas existentes. Ver `art/MOTOR-POR-MATERIAS.md` para agregar materias y conocer los límites actuales.

- `art/PORTADA-Y-CLASES.md`: recorridos implementados, verificación y siguientes etapas.
- `art/PILOTO-MATEMATICA.md`: piloto por equipos y sus límites.
- `art/DIRECCION-CREATIVA.md`: dirección artística y pendientes.

Pendientes de producto: sala sincronizada en vivo, desafíos con fecha de cierre, informes por alumno y unificación visual del jugador individual con el piloto. Las plantillas son ejemplos para revisión docente.

`0005_personajes_biografias.sql` agrega personalidad, frase y acompañamiento editorial a cada materia. La portada los muestra al pasar, enfocar o tocar una tarjeta. La colección de tres power-ups se presenta como arte en diseño; todavía no tiene efectos en partidas. Ver `art/PERSONAJES-Y-POWERUPS.md`.
