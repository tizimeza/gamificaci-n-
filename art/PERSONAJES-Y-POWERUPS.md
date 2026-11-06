# Personajes con personalidad y colección de power-ups

## Fichas

Los diez personajes tienen personalidad, una frase y un texto de acompañamiento por materia. Los campos `personalidad`, `ayuda` y `frase` viven en D1 (migración `0005_personajes_biografias.sql`) y se exponen en el catálogo y las presentaciones compartidas.

La portada abre la ficha al entrar con el mouse o enfocar el botón con teclado. Clic/toque fija o cierra la ficha; Escape la cierra. En celular, el texto forma parte de la tarjeta para evitar superposiciones. El personaje se eleva y gira suavemente; se respeta la preferencia de movimiento reducido. Se mantiene un enlace explícito para crear la clase de esa materia. Si falla la API, siguen disponibles las tarjetas HTML originales.

## Arte de las ayudas

Tres imágenes generadas con la herramienta integrada de imágenes, una llamada por sprite, fondo transparente. Originales en `art/powerups/`; copias web de 512 px en `public/art/powerups/`. Las tres copias pesan aproximadamente 149 KB en total y conservan alpha.

- Tiempo extra: cronómetro turquesa con signo más dorado.
- Pista: bombita dorada con lupa turquesa.
- Segunda oportunidad: flecha de regreso turquesa con corazón dorado.

Se muestran como colección **En diseño** en la portada. No alteran las reglas ni conceden efectos durante las partidas.

## Próxima implementación propuesta

Ayudas opcionales elegidas por el docente antes de jugar. Como punto de partida para probar: una carga por tipo, Tiempo extra suma 15 segundos, Pista revela un texto escrito por el profe y Segunda oportunidad reabre una respuesta errada sin conservar puntos anteriores. Todas las acciones deberían validarse en servidor, consumirse una sola vez y quedar registradas en el intento. En sala en vivo, el anfitrión debe controlar si las habilita. Son decisiones de diseño propuestas, todavía sin implementación ni validación de balance.

## Validación

Migración aplicada en las bases locales normal y de QA. Prueba de catálogo aprobada: once opciones con biografía y presentación consistente al crear roscos. Recorrido de navegador: abrir PRISMO, cerrar con Escape, navegar a MUNDI con Tab, abrir/cerrar LETI con clic. Pantalla de 390 px sin desborde; tres imágenes de ayudas cargadas. Compilación CSS y despliegue en seco aprobados. Sin publicación. Capturas en `art/previews/personajes/`.

## Prompts finales (herramienta integrada)

### Tiempo extra
Use case: stylized-concept. One premium 3D collectible power-up icon for RoscoLab, a secondary-school quiz game with glossy friendly 3D mascots. Subject: a chunky turquoise and midnight-blue stopwatch with a floating golden plus symbol, conveying extra time. Isolated single object centered, three-quarter view, bold simple silhouette readable at 64px, polished toy-like resin and soft bevels, cyan rim light, controlled gold highlights. No face, no words, no letters, no numbers, no frame, no floor, no cast shadow outside object, no other items. Genuine transparent background. Square composition, generous 15 percent margin. This is a single production UI inventory sprite, sophisticated playful game aesthetic, not a flat vector.

### Pista
Use case: stylized-concept. One premium 3D collectible power-up inventory sprite for RoscoLab secondary-school quiz game. Subject: chunky glowing golden light bulb in a midnight-blue and turquoise socket, a small cyan magnifying-glass-shaped accent around the bulb, conveys a hint and discovering an idea. Single coherent object, centered three-quarter view, simple bold silhouette readable at 64px. Polished toy resin, soft bevels, warm yellow glass, cyan edge accents, high-quality playful 3D mascot game aesthetic. Genuine transparent background, no floor, no outside cast shadow, no face, no letters, no words, no numbers, no border, no other items. Square composition with generous 15 percent safety margin.

### Segunda oportunidad
Use case: stylized-concept. One premium 3D collectible power-up inventory sprite for RoscoLab secondary-school quiz game. Subject: a thick curved turquoise circular return arrow embracing a small golden heart, conveying second opportunity and retry. Single coherent object in centered three-quarter view, bold simple silhouette readable at 64px, high-quality polished toy resin, chunky soft bevels, cyan turquoise body with midnight-blue sides, warm gold heart, subtle glossy reflections. Friendly sophisticated 3D game asset matching glossy education mascots. Genuine transparent background, no face, no words, no letters, no numbers, no border, no floor, no cast shadow outside the object, no extra objects or sparks. Square image, entire icon visible with generous 15 percent margin.
