const video = document.querySelector('#prismo-video');
const status = document.querySelector('#motion-status');
document.querySelector('#try-celebration').addEventListener('click', async () => {
  video.currentTime = 0;
  try { await video.play(); } catch { status.textContent = 'Usá el botón de reproducción del video para continuar.'; }
});
video.addEventListener('play', () => { status.textContent = '¡Bien pensado! PRISMO festeja.'; });
video.addEventListener('ended', () => { status.textContent = 'Festejo terminado. ¿Cómo se siente el ritmo?'; });
video.addEventListener('error', () => { status.textContent = 'No se pudo cargar el video. Probá descargarlo desde el enlace de abajo.'; });
