CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE COLLATE NOCASE,
  clave TEXT NOT NULL,
  recuperacion TEXT NOT NULL,
  creado INTEGER NOT NULL
);

CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vence INTEGER NOT NULL
);
CREATE INDEX sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE roscos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  materia TEXT NOT NULL,
  segundos INTEGER NOT NULL,
  entradas TEXT NOT NULL,
  creado INTEGER NOT NULL,
  actualizado INTEGER NOT NULL
);
CREATE INDEX roscos_usuario ON roscos(usuario_id, actualizado DESC);

-- Cada intento guarda una copia de las palabras: editar un rosco no rompe partidas en curso.
CREATE TABLE intentos (
  id TEXT PRIMARY KEY,
  rosco_id TEXT NOT NULL REFERENCES roscos(id) ON DELETE CASCADE,
  jugador TEXT NOT NULL,
  seudonimo TEXT NOT NULL,
  entradas TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  limite INTEGER NOT NULL,
  fin INTEGER,
  aciertos INTEGER NOT NULL DEFAULT 0,
  errores INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX intentos_rosco ON intentos(rosco_id, jugador);

CREATE TABLE respuestas (
  intento_id TEXT NOT NULL REFERENCES intentos(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  correcta INTEGER NOT NULL,
  PRIMARY KEY (intento_id, pos)
);

CREATE TABLE limites (
  clave TEXT PRIMARY KEY,
  cuenta INTEGER NOT NULL,
  vence INTEGER NOT NULL
);
