/**
 * A banda da home promete ser a mesma régua do lobby. Isso só é verdade se as
 * escolhas chegarem: sem isto, mexer na banda seria demonstração e o produto
 * mentiria sobre si mesmo.
 *
 * `sessionStorage` e o armazenamento certo — a preferência vale para a sessão
 * aberta e some quando a aba fecha. Um id de sala numa URL seria lido por
 * qualquer pessoa que pegasse o link, e a preferência não é da sala.
 *
 * Três verbos porque existem dois consumidores: o lobby LÊ para mostrar a régua
 * já posicionada, e a sala CONSOME para virar os ajustes vivos da faixa. Ler sem
 * consumir é o que permite os dois.
 *
 * O tipo mora AQUI, e não no componente, para não criar um ciclo: a régua, a
 * banda e este módulo precisam falar do mesmo CaptureSettings.
 */
const KEY = "myscreen:capture";

export type CaptureSettings = {
  resolution: "720p" | "1080p" | "4k";
  frameRate: "15" | "30" | "60";
  contentHint: "detail" | "motion";
  systemAudio: boolean;
};

export const DEFAULT_CAPTURE: CaptureSettings = {
  resolution: "1080p",
  frameRate: "60",
  contentHint: "detail",
  systemAudio: true,
};

const RESOLUTIONS = ["720p", "1080p", "4k"];
const FRAME_RATES = ["15", "30", "60"];
const CONTENT_HINTS = ["detail", "motion"];

/**
 * Toda propriedade é conferida na volta: o storage é gravável por qualquer
 * script da mesma origem, e um valor fora do conjunto aceito viraria um
 * `contentHint` inválido no `getDisplayMedia` — um erro que só apareceria no
 * momento exato de compartilhar a tela.
 */
function parse(raw: string | null): CaptureSettings | null {
  if (!raw) return null;
  try {
    const c: unknown = JSON.parse(raw);
    if (typeof c !== "object" || c === null) return null;
    const v = c as Record<string, unknown>;
    if (
      !RESOLUTIONS.includes(v.resolution as string) ||
      !FRAME_RATES.includes(v.frameRate as string) ||
      !CONTENT_HINTS.includes(v.contentHint as string) ||
      typeof v.systemAudio !== "boolean"
    ) {
      return null;
    }
    return v as unknown as CaptureSettings;
  } catch {
    return null;
  }
}

export function readCapture(): CaptureSettings {
  try {
    return parse(sessionStorage.getItem(KEY)) ?? DEFAULT_CAPTURE;
  } catch {
    return DEFAULT_CAPTURE;
  }
}

export function writeCapture(settings: CaptureSettings): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Modo privado e quota negada não podem impedir alguém de entrar na sala.
  }
}

/** Consome a preferência: a escolha vira ajuste vivo e para de ser rascunho. */
export function consumeCapture(): CaptureSettings {
  try {
    const value = readCapture();
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return DEFAULT_CAPTURE;
  }
}
