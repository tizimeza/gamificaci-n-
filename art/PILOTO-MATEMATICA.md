# Piloto de Matemática — dirección de interfaz

## Implementado

Entrada: `public/matematica.html`, enlazada desde `public/index.html` y `public/aula.html`. Estilos propios en `public/assets/matematica.css` y lógica en `public/assets/js/matematica.js`. PRISMO se sirve desde `public/art/personajes/prismo-base.png`.

Incluye editor con doce preguntas iniciales y capacidad de 3 a 26, variantes de respuesta, equipos y tiempo; vista previa; rosco con PRISMO y marcador que cambia de letra; acierto/error/pase, reloj pausable y sonidos opcionales; cierre, resultados, repetición y recuperación local. El avance cambia de equipo al pasar o avanzar tras resolver; el tiempo agotado pasa la letra y avanza una vez.

El borrador incompleto también se conserva. El reloj se pausa al ocultar la pestaña. Los ejemplos son una base para revisión docente y adaptación al año del curso.

## Verificación

Pruebas de navegador con Edge mediante Playwright: edición, letra duplicada, vista previa, respuesta sin tilde, puntuación sin duplicados, turnos, pase, error, restauración de partida, pausa y agotamiento del reloj, cierre anticipado, recuperación de resultados, repetición y final completo de doce respuestas. Verificados borradores incompletos, recuperación de almacenamiento malformado y render de texto sin interpretarlo como HTML.

Revisión visual con capturas a 1440 y 390 píxeles. Sin desborde horizontal ni excepciones de navegador en los recorridos probados. También carga abriendo el HTML directamente. Capturas en `art/previews/matematica/`.

## Límites y próximos pasos

Piloto local de aula; no se conecta todavía con cuentas, códigos o ranking compartido de la plataforma. Los movimientos usan el PNG base, sin nuevas poses ilustradas. Validar vocabulario y ritmo con docentes y estudiantes antes de extender a las otras materias. No se publicó ni desplegó desde esta sesión.

---

## Plan visual original

Público: secundaria. Recorrido: preparar → jugar → resultados.

Paleta: noche #09152d, superficie #122542, cian #48e5ed, amarillo #ffdc55, coral #ff8c88, texto #f3f7ff. Montserrat para títulos y letras; Inter para lectura. Fuentes locales existentes.

Composición: preparación con titular a la izquierda y PRISMO grande a la derecha, geometrías de fondo discretas; formulario editorial debajo. Partida con rosco a la izquierda y pregunta a la derecha; resultados con personaje y balance de equipos. Alineación izquierda para contenido, centrada para el rosco.

El rasgo distintivo es PRISMO dentro del rosco, acompañado por un marcador que recorre las letras. Las geometrías pertenecen a Matemática; se evita llenar todas las superficies de tarjetas y efectos. La interfaz mantiene el contenido docente legible.

Alcance: editar hasta 26 preguntas con letras únicas, definir equipos y tiempo, previsualizar, jugar, pasar, responder, guardar y continuar, terminar y repetir. Datos de ejemplo orientados a conceptos iniciales de secundaria. Un punto por acierto, sin descuento por error. Cambio de equipo al pasar, errar o avanzar tras un acierto. Las preguntas pasadas vuelven a estar disponibles.

Las poses se representan mediante movimiento del PNG base; todavía no hay nuevas ilustraciones de poses. El reconocimiento de participación se basa en intentos registrados, no en una evaluación automática de colaboración.
