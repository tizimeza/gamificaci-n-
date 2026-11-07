-- Sala en vivo: una copia del rosco que todos juegan al mismo tiempo.
CREATE TABLE salas (
  id TEXT PRIMARY KEY,
  pin TEXT NOT NULL UNIQUE,
  rosco_id TEXT NOT NULL REFERENCES roscos(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  materia TEXT NOT NULL,
  segundos INTEGER NOT NULL,
  entradas TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'espera' CHECK (estado IN ('espera', 'jugando', 'terminada')),
  creada INTEGER NOT NULL,
  inicio INTEGER,
  limite INTEGER
);
CREATE INDEX salas_rosco ON salas(rosco_id, estado);

CREATE TABLE sala_jugadores (
  sala_id TEXT NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
  jugador TEXT NOT NULL,
  seudonimo TEXT NOT NULL,
  unido INTEGER NOT NULL,
  PRIMARY KEY (sala_id, jugador),
  UNIQUE (sala_id, seudonimo)
);

ALTER TABLE intentos ADD COLUMN sala_id TEXT REFERENCES salas(id) ON DELETE CASCADE;
-- Una sola partida por jugador en cada sala, aun con pedidos simultáneos.
CREATE UNIQUE INDEX intentos_sala_jugador ON intentos(sala_id, jugador) WHERE sala_id IS NOT NULL;
