/**
 * Ícones desenhados em código, a partir da marca em brand/mark.svg.
 * Rasterizado por distância com supersampling 4×4 — sem dependência de imagem.
 *
 * Saída RGBA, linha a linha. Usado pelo processo principal (bandeja, janela,
 * botões da miniatura) e pelo script que gera o `.ico` do instalador.
 */

type Rgba = [number, number, number, number];
type Sdf = (x: number, y: number) => number;
/** Cor fixa ou função da posição (gradientes, brilhos), em coordenadas 0..1. */
type Paint = Rgba | ((x: number, y: number) => Rgba);
type Layer = { sdf: Sdf; color: Paint; erase?: boolean };

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
          // Composição "over", camada a camada, em alfa pré-multiplicado.
          let cr = 0;
          let cg = 0;
          let cb = 0;
          let ca = 0;
          for (const layer of layers) {
            if (layer.sdf(u, v) > 0) continue;
            if (layer.erase) {
              cr = cg = cb = ca = 0;
              continue;
            }
            const c = typeof layer.color === "function" ? layer.color(u, v) : layer.color;
            const la = c[3] / 255;
            cr = c[0] * la + cr * (1 - la);
            cg = c[1] * la + cg * (1 - la);
            cb = c[2] * la + cb * (1 - la);
            ca = la + ca * (1 - la);
          }
          r += cr;
          g += cg;
          b += cb;
          a += ca;
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

type Stop = [number, number, number, number];

/** Interpola entre paradas [posição, r, g, b] — o `<linearGradient>` do SVG. */
function ramp(stops: Stop[], t: number): [number, number, number] {
  const tt = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [p1, ...c1] = stops[i];
    if (tt <= p1 || i === stops.length - 1) {
      const [p0, ...c0] = stops[i - 1];
      const k = p1 === p0 ? 0 : Math.max(0, Math.min(1, (tt - p0) / (p1 - p0)));
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return [stops[0][1], stops[0][2], stops[0][3]];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Arco de um anel, aberto `deg` graus para cima e para baixo da horizontal, com pontas redondas. */
function sideArc(cx: number, cy: number, r: number, w: number, side: 1 | -1, deg: number): Sdf {
  const a = (deg * Math.PI) / 180;
  const ex = cx + side * r * Math.cos(a);
  const ey1 = cy - r * Math.sin(a);
  const ey2 = cy + r * Math.sin(a);
  return (x, y) => {
    const dx = (x - cx) * side;
    const dy = y - cy;
    if (dx > 0 && Math.abs(Math.atan2(dy, dx)) <= a) return Math.abs(Math.hypot(dx, dy) - r) - w / 2;
    return Math.min(Math.hypot(x - ex, y - ey1), Math.hypot(x - ex, y - ey2)) - w / 2;
  };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, rot: number): Sdf {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return (x, y) => {
    const px = (x - cx) * c + (y - cy) * s;
    const py = -(x - cx) * s + (y - cy) * c;
    return (Math.hypot(px / rx, py / ry) - 1) * Math.min(rx, ry);
  };
}

/**
 * O ícone do app — a tela no ar: quadrado de tinta com luz de cima, uma tela
 * branca que derrama luz no fundo e, no meio dela, o ponto vermelho de "no
 * ar" entre duas ondas de sinal. O mesmo desenho de brand/mark.svg (grade de
 * 1024).
 */
export function appIcon(size: number): Uint8Array {
  const u = (n: number) => n / 1024;
  const tile = roundRect(0.5, 0.5, 0.5, 0.5, u(230));
  const screen = roundRect(u(512), u(488), u(350), u(226), u(92));
  const glow = roundRect(u(512), u(500), u(316), u(200), u(96));
  const shadow = roundRect(u(512), u(510), u(350), u(226), u(92));
  const dot = { x: u(512), y: u(488), r: u(58) };
  const INK_RGB: [number, number, number] = [0x0f, 0x11, 0x1a]; // tinta
  const layers: Layer[] = [
    // Chão: tinta, mais clara no alto, com um foco de luz no topo.
    {
      sdf: tile,
      color: (x, y) => {
        const [r, g, b] = ramp([[0, 0x26, 0x2b, 0x3b], [0.5, 0x12, 0x14, 0x1c], [1, 0x07, 0x08, 0x0c]], y);
        const spot = 0.16 * Math.max(0, 1 - Math.hypot(x - 0.5, y) / 0.8);
        return [r + (255 - r) * spot, g + (255 - g) * spot, b + (255 - b) * spot, 255];
      },
    },
    // Luz que a tela derrama no fundo.
    {
      sdf: (x, y) => Math.max(tile(x, y), glow(x, y) - u(110)),
      color: (x, y) => [0xc9, 0xd4, 0xff, Math.round(255 * 0.28 * (1 - smoothstep(-u(60), u(110), glow(x, y))))],
    },
    // Brilho fino na borda de cima do quadrado.
    {
      sdf: (x, y) => Math.max(tile(x, y), -tile(x, y) - u(6)),
      color: (_x, y) => [255, 255, 255, Math.round(255 * 0.14 * Math.max(0, 1 - y / 0.4))],
    },
    // Pé.
    { sdf: roundRect(u(512), u(783), u(95), u(15), u(15)), color: [255, 255, 255, 56] },
    // Sombra da tela.
    {
      sdf: (x, y) => shadow(x, y) - u(66),
      color: (x, y) => [0, 0, 0, Math.round(255 * 0.45 * (1 - smoothstep(-u(44), u(66), shadow(x, y))))],
    },
    // A tela.
    {
      sdf: screen,
      color: (_x, y) => [...ramp([[0, 255, 255, 255], [0.6, 0xee, 0xf0, 0xf5], [1, 0xd5, 0xda, 0xe4]], (y - u(262)) / u(452)), 255] as Rgba,
    },
    // Ondas de sinal.
    { sdf: sideArc(dot.x, dot.y, u(204), u(36), 1, 42), color: [...INK_RGB, 107] },
    { sdf: sideArc(dot.x, dot.y, u(204), u(36), -1, 42), color: [...INK_RGB, 107] },
    { sdf: sideArc(dot.x, dot.y, u(124), u(36), 1, 42), color: [...INK_RGB, 255] },
    { sdf: sideArc(dot.x, dot.y, u(124), u(36), -1, 42), color: [...INK_RGB, 255] },
    // Halo e ponto "no ar".
    {
      sdf: circle(dot.x, dot.y, u(120)),
      color: (x, y) => [0xff, 0x51, 0x45, Math.round(255 * 0.35 * (1 - Math.hypot(x - dot.x, y - dot.y) / u(120)))],
    },
    {
      sdf: circle(dot.x, dot.y, dot.r),
      color: (x, y) => {
        const fx = dot.x - dot.r + 0.38 * 2 * dot.r;
        const fy = dot.y - dot.r + 0.3 * 2 * dot.r;
        const t = Math.hypot(x - fx, y - fy) / (0.75 * 2 * dot.r);
        return [...ramp([[0, 0xff, 0x6a, 0x5f], [0.6, 0xe8, 0x3a, 0x2f], [1, 0xc4, 0x2a, 0x21]], t), 255] as Rgba;
      },
    },
    { sdf: ellipse(u(495), u(467), u(22), u(13), (-28 * Math.PI) / 180), color: [255, 255, 255, 71] },
  ];
  return rasterize(size, size <= 24 ? smallIcon() : layers);
}

/**
 * Bandeja e 16–24 px: as ondas viram borrão nesse tamanho, então fica só a
 * tela grande com o ponto "no ar" no meio.
 */
function smallIcon(): Layer[] {
  const u = (n: number) => n / 1024;
  return [
    {
      sdf: roundRect(0.5, 0.5, 0.5, 0.5, u(230)),
      color: (_x, y) => [...ramp([[0, 0x26, 0x2b, 0x3b], [1, 0x0a, 0x0b, 0x10]], y), 255] as Rgba,
    },
    { sdf: roundRect(u(512), u(512), u(420), u(300), u(110)), color: [0xf4, 0xf5, 0xf8, 255] },
    { sdf: circle(u(512), u(512), u(150)), color: LIVE },
  ];
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
