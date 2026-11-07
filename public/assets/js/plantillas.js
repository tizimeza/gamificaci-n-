// Roscos de ejemplo para empezar a editar en lugar de arrancar con la hoja en blanco.
export const PLANTILLAS = [
  {
    nombre: "Tecnología y TIC (abecedario completo)",
    titulo: "Rosco de Tecnología y TIC",
    materia: "Tecnología",
    segundos: 300,
    entradas: [
      { letra: "A", palabra: "Algoritmo", definicion: "Secuencia ordenada de pasos para resolver un problema." },
      { letra: "B", palabra: "Bit", definicion: "Unidad mínima de información digital; vale 0 o 1." },
      { letra: "C", palabra: "Contraseña", alternativas: ["clave"], definicion: "Combinación secreta que protege el acceso a una cuenta." },
      { letra: "D", palabra: "Dominio", definicion: "Nombre que identifica a un sitio en la web, como el que se escribe en la barra de direcciones." },
      { letra: "E", palabra: "Encriptación", alternativas: ["cifrado"], definicion: "Proceso que transforma datos para que solo pueda leerlos quien tiene la clave." },
      { letra: "F", palabra: "Firewall", alternativas: ["cortafuegos"], definicion: "Sistema que filtra el tráfico de una red para bloquear accesos no autorizados." },
      { letra: "G", palabra: "Gigabyte", alternativas: ["GB"], definicion: "Unidad de almacenamiento equivalente a unos mil megabytes." },
      { letra: "H", palabra: "Hardware", definicion: "Conjunto de partes físicas de una computadora." },
      { letra: "I", palabra: "Internet", definicion: "Red mundial que conecta millones de computadoras y dispositivos." },
      { letra: "J", palabra: "JavaScript", definicion: "Lenguaje de programación que da interactividad a las páginas web." },
      { letra: "K", palabra: "Kilobyte", alternativas: ["KB"], definicion: "Unidad de almacenamiento equivalente a unos mil bytes." },
      { letra: "L", palabra: "Linux", definicion: "Sistema operativo de código abierto usado en servidores y computadoras." },
      { letra: "M", palabra: "Malware", definicion: "Programa diseñado para dañar un equipo o robar información." },
      { letra: "N", palabra: "Navegador", definicion: "Programa que permite visitar páginas web." },
      { letra: "Ñ", palabra: "Diseño", definicion: "Etapa en la que se planifica cómo se verá y funcionará un producto digital." },
      { letra: "O", palabra: "Ofimática", definicion: "Herramientas digitales para tareas de oficina, como textos y planillas." },
      { letra: "P", palabra: "Phishing", definicion: "Engaño con mensajes falsos para robar datos personales." },
      { letra: "Q", palabra: "Código QR", alternativas: ["QR"], definicion: "Imagen cuadrada que un celular escanea para abrir un enlace." },
      { letra: "R", palabra: "Router", definicion: "Dispositivo que conecta los equipos de una red y dirige sus datos." },
      { letra: "S", palabra: "Software", definicion: "Conjunto de programas y aplicaciones de una computadora." },
      { letra: "T", palabra: "Teclado", definicion: "Periférico de entrada que se usa para escribir." },
      { letra: "U", palabra: "USB", definicion: "Conector estándar para enchufar dispositivos a una computadora." },
      { letra: "V", palabra: "Virus", definicion: "Programa malicioso que se copia y se propaga entre archivos." },
      { letra: "W", palabra: "Wifi", alternativas: ["wi-fi"], definicion: "Tecnología que conecta dispositivos a una red sin cables." },
      { letra: "X", palabra: "Hexadecimal", definicion: "Sistema de numeración de base 16 usado en informática." },
      { letra: "Y", palabra: "Byte", definicion: "Conjunto de ocho bits." },
      { letra: "Z", palabra: "Interfaz", definicion: "Parte de un programa con la que interactúa quien lo usa." }
    ]
  },
  {
    nombre: "Electricidad (10 letras)",
    titulo: "Rosco de Electricidad",
    materia: "Física",
    segundos: 180,
    entradas: [
      { letra: "A", palabra: "Alternador", definicion: "Máquina eléctrica que convierte energía mecánica en eléctrica; tiene un rotor móvil y un estator fijo." },
      { letra: "C", palabra: "Corriente eléctrica", alternativas: ["corriente"], definicion: "Movimiento ordenado de cargas eléctricas a través de un material conductor." },
      { letra: "D", palabra: "Distribución", definicion: "Parte de la red eléctrica que reparte la energía desde las subestaciones hasta los usuarios." },
      { letra: "E", palabra: "Enchufe", alternativas: ["toma de corriente"], definicion: "Punto de conexión de una instalación eléctrica a la red de una vivienda." },
      { letra: "I", palabra: "Interruptor", definicion: "Dispositivo que abre o cierra un circuito y mantiene su posición hasta volver a accionarlo." },
      { letra: "N", palabra: "Neutrón", definicion: "Partícula del núcleo atómico que no tiene carga eléctrica." },
      { letra: "P", palabra: "Pila", alternativas: ["batería"], definicion: "Fuente electroquímica que entrega energía para impulsar las cargas eléctricas de un circuito." },
      { letra: "R", palabra: "Repulsión", definicion: "Fuerza que hace que dos cargas eléctricas del mismo signo se alejen entre sí." },
      { letra: "S", palabra: "Serie", alternativas: ["circuito en serie"], definicion: "Tipo de conexión eléctrica en la que los componentes tienen un único camino para la corriente." },
      { letra: "T", palabra: "Tensión", alternativas: ["voltaje"], definicion: "Diferencia de potencial eléctrico entre dos puntos, medida en voltios." }
    ]
  }
  ,{
    nombre: 'Matemática para secundaria (12 letras)',
    titulo: 'Matemática en juego', materia: 'Matemática', segundos: 300,
    entradas: [
      {letra:'A',palabra:'Ángulo',definicion:'Figura formada por dos semirrectas que comparten un mismo origen.'},
      {letra:'B',palabra:'Bisectriz',definicion:'Semirrecta que divide un ángulo en dos ángulos de igual medida.'},
      {letra:'C',palabra:'Cateto',definicion:'Cada uno de los dos lados que forman el ángulo recto de un triángulo rectángulo.'},
      {letra:'D',palabra:'Denominador',definicion:'Número que indica en cuántas partes iguales se divide la unidad en una fracción.'},
      {letra:'E',palabra:'Ecuación',definicion:'Igualdad matemática que incluye una o más incógnitas.'},
      {letra:'F',palabra:'Fracción',definicion:'Expresión que representa un cociente mediante un numerador y un denominador distinto de cero.'},
      {letra:'H',palabra:'Hipotenusa',definicion:'Lado opuesto al ángulo recto y de mayor longitud en un triángulo rectángulo.'},
      {letra:'M',palabra:'Mediana',definicion:'Valor central de un conjunto ordenado de datos; si hay dos centrales, se calcula su promedio.'},
      {letra:'P',palabra:'Perímetro',definicion:'Longitud total del contorno de una figura plana.'},
      {letra:'R',palabra:'Radio',definicion:'Segmento que une el centro de una circunferencia con cualquiera de sus puntos.'},
      {letra:'T',palabra:'Triángulo',definicion:'Polígono de tres lados.'},
      {letra:'V',palabra:'Vértice',definicion:'Punto donde se encuentran dos lados consecutivos de un polígono.'}
    ]
  }
];
