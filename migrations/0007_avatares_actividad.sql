ALTER TABLE usuarios ADD COLUMN avatar TEXT NOT NULL DEFAULT 'voltio';
ALTER TABLE intentos ADD COLUMN avatar TEXT NOT NULL DEFAULT 'voltio';
ALTER TABLE intentos ADD COLUMN usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE sala_jugadores ADD COLUMN avatar TEXT NOT NULL DEFAULT 'voltio';
ALTER TABLE sala_jugadores ADD COLUMN usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE TABLE actividad_diaria (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia TEXT NOT NULL,
  PRIMARY KEY(usuario_id,dia)
);
-- Fecha de Argentina calculada con el reloj del servidor, nunca con el del navegador.
CREATE TRIGGER actividad_al_completar AFTER UPDATE OF fin ON intentos
WHEN OLD.fin IS NULL AND NEW.fin IS NOT NULL AND NEW.usuario_id IS NOT NULL AND NEW.aciertos>0
AND (SELECT COUNT(*) FROM respuestas WHERE intento_id=NEW.id)>=json_array_length(NEW.entradas)
BEGIN
  INSERT OR IGNORE INTO actividad_diaria(usuario_id,dia)
  VALUES(NEW.usuario_id,strftime('%Y-%m-%d',NEW.fin/1000,'unixepoch','-3 hours'));
END;
