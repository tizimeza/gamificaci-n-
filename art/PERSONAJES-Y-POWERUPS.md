# Personajes con personalidad y colección de power-ups

## Fichas

Los diez personajes tienen personalidad, una frase y un texto de acompañamiento por materia. Los campos `personalidad`, `ayuda` y `frase` viven en D1 (migración `0005_personajes_biografias.sql`) y se exponen en el catálogo y las presentaciones compartidas.

La portada abre la ficha al entrar con el mouse o enfocar el botón con teclado. Clic/toque fija o cierra la ficha; Escape la cierra. En celular, el texto forma parte de la tarjeta para evitar superposiciones. El personaje se eleva y gira suavemente; se respeta la preferencia de movimiento reducido. Se mantiene un enlace explícito para crear la clase de esa materia. Si falla la API, siguen disponibles las tarjetas HTML originales.

## Arte de las ayudas

Tres imágenes generadas con la herramienta integrada de imágenes, una llamada por sprite, fondo transparente. Originales en `art/powerups/`; copias web de 512 px en `public/art/powerups/`. Las tres copias pesan aproximadamente 149 KB en total y conservan alpha.

- Tiempo extra: cronómetro turquesa con signo más dorado.
- Pista: bombita dorada con lupa turquesa.
- Segunda oportunidad: flecha de regreso turquesa con corazón dorado.

Los tres power-ups funcionan en el jugador compartido y en salas en vivo. La portada ya no muestra «En diseño».

## Mecánica implementada (2026-11-06)

El editor ofrece un interruptor de ayudas para cada rosco, activo por defecto en la creación desde la interfaz. Puede escribirse una pista opcional por letra (hasta 180 caracteres, sin la respuesta). Las copias preservan configuración y pistas.

- **Tiempo extra:** agrega 15 segundos, una sola vez por intento individual. En vivo suma 15 segundos al reloj de toda la sala, una sola vez entre todos los participantes; los intentos nuevos reciben el límite extendido.
- **Pista:** una carga por jugador; revela la orientación del docente para una letra pendiente. El botón queda deshabilitado donde no hay pista. No consume una carga si la letra no admite la ayuda.
- **Segunda oportunidad:** una carga por jugador; permite elegir una letra incorrecta y responderla de nuevo. Elimina el error anterior y el puntaje se recalcula al responder. Si al completar la rueda quedan errores y la ayuda sigue disponible, se ofrece reintentar o terminar ahora, siempre dentro del reloj.

La migración `0006_powerups.sql` guarda configuración en el rosco y una copia en cada intento/sala. Habilita las ayudas en los roscos existentes y conserva las reglas de los intentos y salas que ya estaban en curso. La API de creación sin el campo `powerups:true` mantiene el comportamiento sin ayudas para clientes anteriores.

El registro `powerup_usos` tiene una clave única por intento y tipo y un índice único para Tiempo extra en vivo. Condiciones SQL comprueban inicio, reloj, fin, disponibilidad y respuesta. Triggers aplican el efecto, eliminan la respuesta errada y actualizan el puntaje en la misma transacción. El servidor revela únicamente las pistas consumidas, no todas las pistas ni las respuestas. Recargar conserva cargas y pistas ya abiertas. El anfitrión conserva el cierre explícito de la sala.

Endpoints: `POST /api/intentos/:token/powerups` con `{tipo,pos}` (`tiempo`, `pista`, `reintento`); `GET /api/intentos/:token` para sincronizar estado mediante el token privado del intento.

## Validación

25 pruebas de API y salas aprobadas, incluyendo consumo simultáneo, reloj compartido, pistas individuales, copia/configuración, persistencia, última letra errada, puntaje corregido y bloqueo tras cierre. La prueba de cierre de sala usa y comprueba el endpoint real `/terminar`.

Recorrido visible: guardar un rosco con pista en el editor, comenzar, usar las tres ayudas y cerrar 5/5 con cero errores; reingresar después de recargar conserva la pista consumida. Diseño sin desborde a 390 px y botones adaptables. Compilación CSS y empaquetado en seco aprobados. Migraciones aplicadas a las bases locales de desarrollo y QA; sin publicación. El piloto offline de Matemática sigue separado del jugador compartido.

## Prompts finales (herramienta integrada)

### Tiempo extra
Use case: stylized-concept. One premium 3D collectible power-up icon for RoscoLab, a secondary-school quiz game with glossy friendly 3D mascots. Subject: a chunky turquoise and midnight-blue stopwatch with a floating golden plus symbol, conveying extra time. Isolated single object centered, three-quarter view, bold simple silhouette readable at 64px, polished toy-like resin and soft bevels, cyan rim light, controlled gold highlights. No face, no words, no letters, no numbers, no frame, no floor, no cast shadow outside object, no other items. Genuine transparent background. Square composition, generous 15 percent margin. This is a single production UI inventory sprite, sophisticated playful game aesthetic, not a flat vector.

### Pista
Use case: stylized-concept. One premium 3D collectible power-up inventory sprite for RoscoLab secondary-school quiz game. Subject: chunky glowing golden light bulb in a midnight-blue and turquoise socket, a small cyan magnifying-glass-shaped accent around the bulb, conveys a hint and discovering an idea. Single coherent object, centered three-quarter view, simple bold silhouette readable at 64px. Polished toy resin, soft bevels, warm yellow glass, cyan edge accents, high-quality playful 3D mascot game aesthetic. Genuine transparent background, no floor, no outside cast shadow, no face, no letters, no words, no numbers, no border, no other items. Square composition with generous 15 percent safety margin.

### Segunda oportunidad
Use case: stylized-concept. One premium 3D collectible power-up inventory sprite for RoscoLab secondary-school quiz game. Subject: a thick curved turquoise circular return arrow embracing a small golden heart, conveying second opportunity and retry. Single coherent object in centered three-quarter view, bold simple silhouette readable at 64px, high-quality polished toy resin, chunky soft bevels, cyan turquoise body with midnight-blue sides, warm gold heart, subtle glossy reflections. Friendly sophisticated 3D game asset matching glossy education mascots. Genuine transparent background, no face, no words, no letters, no numbers, no border, no floor, no cast shadow outside the object, no extra objects or sparks. Square image, entire icon visible with generous 15 percent margin.
