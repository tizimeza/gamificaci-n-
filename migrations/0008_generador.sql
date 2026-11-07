CREATE TABLE fuentes_curriculares (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  jurisdiccion TEXT NOT NULL,
  anio INTEGER NOT NULL,
  modalidad TEXT NOT NULL,
  titulo TEXT NOT NULL,
  organismo TEXT NOT NULL,
  version TEXT NOT NULL,
  referencia TEXT NOT NULL,
  url TEXT NOT NULL,
  texto TEXT NOT NULL,
  creado INTEGER NOT NULL
);
CREATE INDEX fuentes_usuario ON fuentes_curriculares(usuario_id,creado DESC);
CREATE TABLE generaciones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('generando','listo','fallido')),
  solicitud TEXT NOT NULL,
  fuentes TEXT NOT NULL,
  borrador TEXT,
  error TEXT,
  modelo TEXT NOT NULL,
  creado INTEGER NOT NULL,
  actualizado INTEGER NOT NULL,
  UNIQUE(usuario_id,clave)
);
CREATE UNIQUE INDEX generacion_activa ON generaciones(usuario_id) WHERE estado='generando';
CREATE INDEX generaciones_usuario ON generaciones(usuario_id,creado DESC);
CREATE TABLE generacion_cuotas (dia TEXT PRIMARY KEY,cuenta INTEGER NOT NULL);
CREATE TABLE planes_generacion (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  activo INTEGER NOT NULL DEFAULT 0,
  solicitud TEXT NOT NULL,
  actualizado INTEGER NOT NULL
);
ALTER TABLE roscos ADD COLUMN generacion_id TEXT REFERENCES generaciones(id) ON DELETE SET NULL;
