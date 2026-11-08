// Gera build/installerSidebar.bmp (164×314, BMP 24 bits — o formato que o NSIS
// aceita) para as telas de boas-vindas e conclusão do instalador. Azul da marca
// (--color-signal) em degradê, grade de pontos discreta e o ícone do app.
import { mkdirSync, writeFileSync } from "node:fs";
import * as esbuild from "esbuild";

const bundled = await esbuild.build({
  entryPoints: ["src/shared/raster.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { appIcon } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const W = 164;
const H = 314;
const TOP = [0x1b, 0x3a, 0x7d]; // --color-signal
const BOTTOM = [0x10, 0x22, 0x4a]; // um tom abaixo de --color-signal-2
const px = new Float64Array(W * H * 3);

const mix = (a, b, t) => a + (b - a) * t;
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) px[k + c] = mix(TOP[c], BOTTOM[c], t);
  }
}

function blend(x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= W || y >= H || alpha <= 0) return;
  const k = (y * W + x) * 3;
  for (let c = 0; c < 3; c++) px[k + c] = mix(px[k + c], rgb[c], alpha);
}

// Grade de pontos que some em direção ao topo.
for (let y = 10; y < H; y += 12) {
  for (let x = 10; x < W; x += 12) blend(x, y, [255, 255, 255], 0.05 + 0.07 * (y / H));
}

// Halo suave atrás do ícone.
const ICON = 96;
const cx = W / 2;
const cy = 112;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy) / 90;
    if (d < 1) blend(x, y, [0x3d, 0x63, 0xb8], 0.35 * (1 - d) ** 2);
  }
}

// O ícone, com sombra leve.
const icon = appIcon(ICON);
const ox = Math.round(cx - ICON / 2);
const oy = Math.round(cy - ICON / 2);
for (let y = 0; y < ICON; y++) {
  for (let x = 0; x < ICON; x++) {
    const a = icon[(y * ICON + x) * 4 + 3] / 255;
    blend(ox + x, oy + y + 4, [0, 0, 0], a * 0.22);
  }
}
for (let y = 0; y < ICON; y++) {
  for (let x = 0; x < ICON; x++) {
    const k = (y * ICON + x) * 4;
    blend(ox + x, oy + y, [icon[k], icon[k + 1], icon[k + 2]], icon[k + 3] / 255);
  }
}
// Contorno claro de 1 px para o quadrado do ícone não sumir no fundo azul.
for (let y = 0; y < ICON; y++) {
  for (let x = 0; x < ICON; x++) {
    const a = icon[(y * ICON + x) * 4 + 3];
    if (a === 0) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx < 0 || ny < 0 || nx >= ICON || ny >= ICON || icon[(ny * ICON + nx) * 4 + 3] < 128;
    });
    if (edge && a >= 128) blend(ox + x, oy + y, [255, 255, 255], 0.28);
  }
}

// Fio fino de acento perto da base.
for (let x = 24; x < W - 24; x++) blend(x, H - 40, [255, 255, 255], 0.18);

function bmp24(width, height, rgb) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const data = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * rowSize; // BMP guarda de baixo para cima
    for (let x = 0; x < width; x++) {
      const k = (y * width + x) * 3;
      data[row + x * 3] = Math.round(rgb[k + 2]);
      data[row + x * 3 + 1] = Math.round(rgb[k + 1]);
      data[row + x * 3 + 2] = Math.round(rgb[k]);
    }
  }
  const header = Buffer.alloc(54);
  header.write("BM", 0, "ascii");
  header.writeUInt32LE(54 + data.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(data.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, data]);
}

mkdirSync("build", { recursive: true });
writeFileSync("build/installerSidebar.bmp", bmp24(W, H, px));
console.log("build/installerSidebar.bmp gerado");
