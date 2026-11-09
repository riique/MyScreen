/**
 * Ícones desenhados em código, a partir da marca em brand/mark.svg.
 * Rasterizado por distância com supersampling 4×4 — sem dependência de imagem.
 *
 * Saída RGBA, linha a linha. Usado pelo processo principal (bandeja, janela,
 * botões da miniatura) e pelo script que gera o `.ico` do instalador.
 */

type Rgba = [number, number, number, number];
type Sdf = (x: number, y: number) => number;
type Layer = { sdf: Sdf; color: Rgba; erase?: boolean };

const INK: Rgba = [0x0f, 0x11, 0x1a, 255];
const LIVE: Rgba = [0xe0, 0x36, 0x2c, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const ALERT: Rgba = LIVE;

function roundRect(cx: number, cy: number, hw: number, hh: number, r: number): Sdf {
  return (x, y) => {
    const qx = Math.abs(x - cx) - hw + r;
    const qy = Math.abs(y - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
}

function circle(cx: number, cy: number, r: number): Sdf {
  return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

/** Segmento com espessura (cápsula). */
function segment(ax: number, ay: number, bx: number, by: number, r: number): Sdf {
  return (x, y) => {
    const pax = x - ax;
    const pay = y - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
    return Math.hypot(pax - bax * h, pay - bay * h) - r;
  };
}

/** Contorno de uma forma, com espessura `w`. */
function stroke(sdf: Sdf, w: number): Sdf {
  return (x, y) => Math.abs(sdf(x, y)) - w / 2;
}

/** Arco inferior (meia-lua) de um anel. */
function lowerArc(cx: number, cy: number, r: number, w: number): Sdf {
  const ring = stroke(circle(cx, cy, r), w);
  const capL = circle(cx - r, cy, w / 2);
  const capR = circle(cx + r, cy, w / 2);
  // Acima do centro, só as pontas arredondadas; abaixo, o anel.
  return (x, y) => (y < cy ? Math.min(capL(x, y), capR(x, y)) : ring(x, y));
}

function rasterize(size: number, layers: Layer[]): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          // Coordenadas normalizadas 0..1.
          const u = (x + (sx + 0.5) / S) / size;
          const v = (y + (sy + 0.5) / S) / size;
          let c: Rgba | null = null;
          for (const layer of layers) {
            if (layer.sdf(u, v) <= 0) c = layer.erase ? null : layer.color;
          }
          if (c) {
            const ca = c[3] / 255;
            r += c[0] * ca;
            g += c[1] * ca;
            b += c[2] * ca;
            a += ca;
          }
        }
      }
      const k = (y * size + x) * 4;
      const n = S * S;
      if (a > 0) {
        px[k] = Math.round(r / a);
        px[k + 1] = Math.round(g / a);
        px[k + 2] = Math.round(b / a);
      }
      px[k + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

/**
 * O ícone do app — o selo do canal: quadrado de tinta, a tela em traço branco
 * e o ponto vermelho de "no ar" sentado no canto dela, separado por um vão de
 * tinta. O mesmo desenho de brand/mark.svg (grade de 64).
 */
export function appIcon(size: number): Uint8Array {
  const u = (n: number) => n / 64;
  const layers: Layer[] = [
    { sdf: roundRect(0.5, 0.5, 0.5, 0.5, u(16)), color: INK },
    { sdf: stroke(roundRect(0.5, 0.5, u(15.5), u(10.5), u(3.5)), u(5)), color: WHITE },
    { sdf: circle(u(47), u(19), u(9.5)), color: INK },
    { sdf: circle(u(47), u(19), u(7)), color: LIVE },
  ];
  return rasterize(size, layers);
}

export type Glyph = "mic" | "mic-off" | "cam" | "cam-off" | "leave";

/** Pictogramas brancos para os botões da miniatura da barra de tarefas. */
export function glyph(kind: Glyph, size: number): Uint8Array {
  const layers: Layer[] = [];
  const slash = (): void => {
    layers.push({ sdf: segment(0.15, 0.15, 0.85, 0.85, 0.11), color: WHITE, erase: true });
    layers.push({ sdf: segment(0.15, 0.15, 0.85, 0.85, 0.05), color: WHITE });
  };
  if (kind === "mic" || kind === "mic-off") {
    layers.push({ sdf: roundRect(0.5, 0.36, 0.13, 0.24, 0.13), color: WHITE });
    layers.push({ sdf: lowerArc(0.5, 0.45, 0.25, 0.07), color: WHITE });
    layers.push({ sdf: segment(0.5, 0.72, 0.5, 0.86, 0.035), color: WHITE });
    layers.push({ sdf: segment(0.36, 0.88, 0.64, 0.88, 0.035), color: WHITE });
    if (kind === "mic-off") slash();
  } else if (kind === "cam" || kind === "cam-off") {
    layers.push({ sdf: roundRect(0.4, 0.5, 0.28, 0.2, 0.06), color: WHITE });
    layers.push({
      sdf: (x, y) => Math.max(0.68 - x, Math.abs(y - 0.5) - (x - 0.68) * 0.9 - 0.06, x - 0.92),
      color: WHITE,
    });
    if (kind === "cam-off") slash();
  } else {
    layers.push({ sdf: circle(0.5, 0.5, 0.46), color: ALERT });
    layers.push({ sdf: segment(0.34, 0.34, 0.66, 0.66, 0.06), color: WHITE });
    layers.push({ sdf: segment(0.66, 0.34, 0.34, 0.66, 0.06), color: WHITE });
  }
  return rasterize(size, layers);
}

/** RGBA → BGRA, o formato do `nativeImage.createFromBitmap` no Windows. */
export function rgbaToBgra(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 1] = rgba[i + 1];
    out[i + 2] = rgba[i];
    out[i + 3] = rgba[i + 3];
  }
  return out;
}
