const codificar = new TextEncoder();
const ITERACIONES = 100000; // Tope de PBKDF2 en Cloudflare Workers.

const aHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (hex) => Uint8Array.from(hex.match(/../g), (par) => parseInt(par, 16));

export const tokenAleatorio = (bytes = 32) => aHex(crypto.getRandomValues(new Uint8Array(bytes)));
export const sha256 = async (valor) => aHex(await crypto.subtle.digest("SHA-256", codificar.encode(valor)));

async function derivar(secreto, sal, iteraciones) {
  const clave = await crypto.subtle.importKey("raw", codificar.encode(secreto), "PBKDF2", false, ["deriveBits"]);
  return aHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones }, clave, 256));
}

export async function hashearSecreto(secreto) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `${ITERACIONES}$${aHex(sal)}$${await derivar(secreto, sal, ITERACIONES)}`;
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export async function verificarSecreto(secreto, guardado) {
  const [iteraciones, sal, hash] = guardado.split("$");
  return iguales(await derivar(secreto, deHex(sal), Number(iteraciones)), hash);
}

// Para que un alias inexistente tarde lo mismo que uno existente.
export const SECRETO_FALSO = `${ITERACIONES}$${"00".repeat(16)}$${"00".repeat(32)}`;

const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // Sin 0/O ni 1/I/L: se dictan en voz alta.
export function codigoAleatorio(largo) {
  const azar = crypto.getRandomValues(new Uint8Array(largo));
  return [...azar].map((n) => ALFABETO_CODIGO[n % ALFABETO_CODIGO.length]).join("");
}
