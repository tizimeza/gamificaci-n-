# Avatares y práctica diaria

Implementado el 2026-11-06 en el jugador compartido y salas en vivo. Requiere migración `0007_avatares_actividad.sql`, además de las anteriores.

## Avatar

Diez personajes disponibles antes de jugar y en «Mis clases». Con cuenta, la elección se guarda en el perfil. Sin cuenta se conserva la preferencia local del navegador. El intento y el ingreso a sala guardan una copia del avatar; el ranking muestra el avatar de esa participación, no lo reemplaza retroactivamente al cambiar el perfil. La API acepta únicamente personajes visibles del catálogo.

El personaje que acompaña la materia sigue siendo el de la materia; es distinto del avatar elegido por el jugador.

## Actividad

Las cuentas tienen objetivo diario, racha actual, mejor racha, últimos siete días e insignias por 1, 3, 7 y 30 días de práctica acumulados. El perfil está disponible para ambos roles. La actividad se muestra en Mis clases y al finalizar una partida.

Un día cuenta al responder todas las letras de un rosco y lograr al menos un acierto. Abandonar o terminar sin aciertos no cuenta. Varias partidas en la misma fecha suman un solo día. La fecha se calcula en servidor con UTC-3 (Argentina); no depende del reloj del dispositivo. Si hoy todavía no se completó el objetivo, se mantiene la racha que llega hasta ayer. Un día de pausa corta la racha actual, pero conserva el récord y las insignias.

La actividad está vinculada a la cuenta autenticada, no al avatar, seudónimo o identificador local. Jugar como invitado admite avatar/ranking, pero no registra racha. La clave de jugador local se separa por alias cuando hay cuenta para evitar retomar en el mismo navegador el intento de otro perfil.

## Datos y API

- Avatar en usuarios, intentos y sala_jugadores; usuario autenticado asociado al intento/ingreso.
- actividad_diaria: una fila por usuario/fecha. Trigger al cerrar el intento, con verificación de respuestas y aciertos, y clave única para impedir duplicados.
- GET /api/perfil: perfil y actividad de la sesión.
- PATCH /api/perfil con {avatar}: cambia únicamente el avatar de la cuenta autenticada. No acepta actividad ni fechas del navegador.

## Verificación

28 pruebas de API/salas aprobadas: validación de avatares, ranking, aislamiento de cuentas, días duplicados, abandono, cero aciertos, fecha argentina, cortes de racha y sala autenticada. Empaquetado de despliegue aprobado. Recorrido visible con BROTI: elegir, completar 5/5, ver avatar en ranking y primera insignia, volver a Mis clases y recuperar preferencias/progreso. Sin desborde a 390 px. Capturas en art/previews/personajes/elegir-avatar.jpg y avatar-ranking-racha.jpg.

Migraciones aplicadas solo a desarrollo y QA locales. Cambios sin commit/push ni despliegue. Los power-ups y esta feature están pendientes de subir. El piloto offline de Matemática sigue separado.
