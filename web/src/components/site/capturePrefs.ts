/**
 * A última escolha de captura (resolução, taxa, conteúdo, áudio), perguntada no
 * diálogo de compartilhar tela. `localStorage` porque é preferência da pessoa
 * nesta máquina, não da sala: quem compartilha código sempre em 1080p/Texto
 * não deveria responder a mesma coisa toda vez.
 *
 * O tipo mora AQUI, e não no componente, para a régua e a sala falarem do
 * mesmo CaptureSettings sem ciclo de import.
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
    return parse(localStorage.getItem(KEY)) ?? DEFAULT_CAPTURE;
  } catch {
    return DEFAULT_CAPTURE;
  }
}

export function writeCapture(settings: CaptureSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Modo privado e quota negada não podem impedir alguém de compartilhar.
  }
}
