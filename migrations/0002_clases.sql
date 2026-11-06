ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'docente' CHECK (rol IN ('docente', 'alumno'));

CREATE TABLE clases (
  id TEXT PRIMARY KEY,
  docente_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  materia TEXT NOT NULL,
  creado INTEGER NOT NULL
);
CREATE INDEX clases_docente ON clases(docente_id, creado DESC);

CREATE TABLE clase_miembros (
  clase_id TEXT NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  alumno_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unido INTEGER NOT NULL,
  PRIMARY KEY (clase_id, alumno_id)
);
CREATE INDEX miembros_alumno ON clase_miembros(alumno_id, unido DESC);

CREATE TABLE clase_roscos (
  clase_id TEXT NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  rosco_id TEXT NOT NULL REFERENCES roscos(id) ON DELETE CASCADE,
  asignado INTEGER NOT NULL,
  PRIMARY KEY (clase_id, rosco_id)
);
