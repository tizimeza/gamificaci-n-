// Copia fuentes e íconos de node_modules a assets/ para servirlos sin CDN.
import { copyFileSync, mkdirSync } from "node:fs";

const copies = [
  ["@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", "public/assets/fonts/inter-latin-wght-normal.woff2"],
  ["@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2", "public/assets/fonts/montserrat-latin-wght-normal.woff2"],
  ["@fortawesome/fontawesome-free/css/all.min.css", "public/assets/fontawesome/css/all.min.css"],
  ["@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2", "public/assets/fontawesome/webfonts/fa-solid-900.woff2"],
  ["@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2", "public/assets/fontawesome/webfonts/fa-regular-400.woff2"]
];

for (const [from, to] of copies) {
  mkdirSync(to.slice(0, to.lastIndexOf("/")), { recursive: true });
  copyFileSync(`node_modules/${from}`, to);
}
