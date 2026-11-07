// Seudónimos armados: nadie escribe texto libre, así no aparecen nombres reales ni insultos en el ranking.
export const NOMBRES = ["Puma", "Cóndor", "Yaguareté", "Tucán", "Zorro", "Búho", "Delfín", "Pingüino", "Lobo", "Dragón", "Robot", "Cohete", "Trueno", "Volcán", "Cometa", "Rayo"];
export const ADJETIVOS = ["Veloz", "Sabio", "Curioso", "Valiente", "Astuto", "Brillante", "Feroz", "Tranquilo", "Genial", "Épico", "Ágil", "Audaz", "Cósmico", "Intrépido", "Eléctrico", "Turbo"];

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

export const generarSeudonimo = () => `${azar(NOMBRES)} ${azar(ADJETIVOS)} ${10 + Math.floor(Math.random() * 90)}`;

export function seudonimoValido(valor) {
  const partes = String(valor ?? "").split(" ");
  return partes.length === 3 && NOMBRES.includes(partes[0]) && ADJETIVOS.includes(partes[1]) && /^[1-9]\d$/.test(partes[2]);
}
