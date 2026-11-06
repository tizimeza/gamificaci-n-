// Reglas compartidas entre el navegador y el servidor. El servidor siempre vuelve a validar.
export const LIMITES = {
  entradasMin: 5,
  entradasMax: 27,
  segundosMin: 60,
  segundosMax: 900,
  segundosPorDefecto: 180,
  titulo: 80,
  palabra: 40,
  definicion: 220,
  alternativas: 5
};

export const MATERIAS = [
  "Tecnología", "Lengua", "Matemática", "Geografía", "Historia", "Música",
  "Biología", "Artística", "Física", "Química", "Otra"
];

export const LETRAS = [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"];

// Conserva la ñ: "año" y "ano" no son la misma respuesta.
export function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("es")
    .replace(/ñ/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(//g, "ñ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const modoDeLetra = (letra, palabra) =>
  normalizar(palabra).startsWith(normalizar(letra)) ? "empieza" : "contiene";

export function respuestaCorrecta(entrada, respuesta) {
  const dada = normalizar(respuesta);
  return Boolean(dada) && [entrada.palabra, ...(entrada.alternativas ?? [])].some((item) => normalizar(item) === dada);
}

const texto = (valor) => (typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "");

// Devuelve el rosco limpio y una lista de errores legibles; `fila` señala la entrada con problemas.
export function revisarRosco(datos) {
  const errores = [];
  const agregar = (mensaje, fila = null) => errores.push({ mensaje, fila });
  const titulo = texto(datos?.titulo);
  const materia = MATERIAS.includes(datos?.materia) ? datos.materia : null;
  const segundos = Number(datos?.segundos);
  const crudas = Array.isArray(datos?.entradas) ? datos.entradas : [];

  if (titulo.length < 3 || titulo.length > LIMITES.titulo) agregar(`El título debe tener entre 3 y ${LIMITES.titulo} caracteres.`);
  if (!materia) agregar("Elegí una materia.");
  if (!Number.isInteger(segundos) || segundos < LIMITES.segundosMin || segundos > LIMITES.segundosMax) {
    agregar(`El tiempo debe estar entre ${LIMITES.segundosMin} y ${LIMITES.segundosMax} segundos.`);
  }
  if (crudas.length < LIMITES.entradasMin || crudas.length > LIMITES.entradasMax) {
    agregar(`El rosco debe tener entre ${LIMITES.entradasMin} y ${LIMITES.entradasMax} letras.`);
  }

  const vistas = new Set();
  const entradas = crudas.slice(0, LIMITES.entradasMax).map((cruda, fila) => {
    const letra = texto(cruda?.letra).toLocaleUpperCase("es");
    const palabra = texto(cruda?.palabra);
    const definicion = texto(cruda?.definicion);
    const alternativas = (Array.isArray(cruda?.alternativas) ? cruda.alternativas : [])
      .map(texto).filter(Boolean).slice(0, LIMITES.alternativas).map((item) => item.slice(0, LIMITES.palabra));
    const palabraNormal = normalizar(palabra);

    if (!LETRAS.includes(letra)) agregar(`Fila ${fila + 1}: elegí una letra.`, fila);
    else if (vistas.has(letra)) agregar(`La letra ${letra} está repetida.`, fila);
    vistas.add(letra);
    if (!palabraNormal || palabra.length > LIMITES.palabra) agregar(`Fila ${fila + 1}: la palabra debe tener hasta ${LIMITES.palabra} caracteres.`, fila);
    else if (LETRAS.includes(letra) && !palabraNormal.includes(normalizar(letra))) agregar(`"${palabra}" no contiene la letra ${letra}.`, fila);
    if (definicion.length < 5 || definicion.length > LIMITES.definicion) agregar(`Fila ${fila + 1}: la definición debe tener entre 5 y ${LIMITES.definicion} caracteres.`, fila);
    else if (palabraNormal && ` ${normalizar(definicion)} `.includes(` ${palabraNormal} `)) agregar(`Fila ${fila + 1}: la definición no puede incluir la respuesta.`, fila);
    return { letra, palabra, definicion, alternativas };
  });

  entradas.sort((a, b) => LETRAS.indexOf(a.letra) - LETRAS.indexOf(b.letra));
  return { errores, rosco: { titulo, materia, segundos, entradas } };
}
