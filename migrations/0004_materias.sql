-- Catálogo compartido: una pantalla de juego, presentación configurable por materia.
CREATE TABLE materias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  personaje_id TEXT NOT NULL,
  personaje_nombre TEXT NOT NULL,
  imagen TEXT NOT NULL,
  miniatura TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#48e5ed',
  festejo TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1))
);
INSERT INTO materias(id,nombre,personaje_id,personaje_nombre,imagen,miniatura,color,orden) VALUES
('tecnologia','Tecnología','voltio','VOLTIO','/art/personajes/voltio-base.png','/art/personajes/voltio-mini.png','#ffdc55',1),
('lengua','Lengua','leti','LETI','/art/personajes/leti-base.png','/art/personajes/leti-mini.png','#48e5ed',2),
('matematica','Matemática','prismo','PRISMO','/art/personajes/prismo-base.png','/art/personajes/prismo-mini.png','#48e5ed',3),
('geografia','Geografía','mundi','MUNDI','/art/personajes/mundi-base.png','/art/personajes/mundi-mini.png','#48e5ed',4),
('historia','Historia','crono','CRONO','/art/personajes/crono-base.png','/art/personajes/crono-mini.png','#ffdc55',5),
('musica','Música','melo','MELO','/art/personajes/melo-base.png','/art/personajes/melo-mini.png','#ff8c88',6),
('biologia','Biología','broti','BROTI','/art/personajes/broti-base.png','/art/personajes/broti-mini.png','#48e5ed',7),
('artistica','Artística','trazo','TRAZO','/art/personajes/trazo-base.png','/art/personajes/trazo-mini.png','#ffdc55',8),
('fisica','Física','atomo','ÁTOMO','/art/personajes/atomo-base.png','/art/personajes/atomo-mini.png','#ffdc55',9),
('quimica','Química','burbu','BURBU','/art/personajes/burbu-base.png','/art/personajes/burbu-mini.png','#ff8c88',10),
('otra','Otra','voltio','VOLTIO','/art/personajes/voltio-base.png','/art/personajes/voltio-mini.png','#48e5ed',99);

-- Los videos de prueba no se activan como reacciones hasta aprobar su diseño y duración.
