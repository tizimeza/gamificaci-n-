ALTER TABLE roscos ADD COLUMN powerups INTEGER NOT NULL DEFAULT 0;
ALTER TABLE intentos ADD COLUMN powerups INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salas ADD COLUMN powerups INTEGER NOT NULL DEFAULT 0;
-- Las partidas que ya están en curso conservan sus reglas originales.
UPDATE roscos SET powerups=1;
CREATE TABLE powerup_usos (
  intento_id TEXT NOT NULL REFERENCES intentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('tiempo','pista','reintento')),
  pos INTEGER,
  usado INTEGER NOT NULL,
  sala_id TEXT REFERENCES salas(id) ON DELETE CASCADE,
  PRIMARY KEY(intento_id,tipo)
);
CREATE UNIQUE INDEX tiempo_por_sala ON powerup_usos(sala_id) WHERE tipo='tiempo' AND sala_id IS NOT NULL;
-- Puntaje y respuesta se actualizan en la misma transacción.
CREATE TRIGGER respuesta_puntaje_insert AFTER INSERT ON respuestas BEGIN
  UPDATE intentos SET aciertos=aciertos+NEW.correcta, errores=errores+1-NEW.correcta WHERE id=NEW.intento_id;
END;
CREATE TRIGGER respuesta_puntaje_delete AFTER DELETE ON respuestas BEGIN
  UPDATE intentos SET aciertos=aciertos-OLD.correcta, errores=errores-1+OLD.correcta WHERE id=OLD.intento_id;
END;
CREATE TRIGGER powerup_efecto AFTER INSERT ON powerup_usos BEGIN
  UPDATE salas SET limite=limite+15000 WHERE id=NEW.sala_id AND NEW.tipo='tiempo';
  UPDATE intentos SET limite=limite+15000 WHERE NEW.tipo='tiempo' AND fin IS NULL AND
    ((NEW.sala_id IS NULL AND id=NEW.intento_id) OR (NEW.sala_id IS NOT NULL AND sala_id=NEW.sala_id));
  DELETE FROM respuestas WHERE intento_id=NEW.intento_id AND pos=NEW.pos AND correcta=0 AND NEW.tipo='reintento';
END;
