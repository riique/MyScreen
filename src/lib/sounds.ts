import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Áudios que alguém na chamada pode tocar para a sala inteira. Os arquivos
 * moram numa pasta do servidor (montada só para leitura no container) e são
 * lidos a cada pedido: colocar ou tirar um arquivo vale na hora, sem deploy.
 */

export const SOUND_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

/** O app baixa o arquivo inteiro antes de tocar: acima disso não vale a pena. */
export const MAX_SOUND_BYTES = 25 * 1024 * 1024;
const MAX_SOUNDS = 200;

export interface SoundEntry {
  /** Nome do arquivo: é o que vai na URL. */
  id: string;
  /** Nome para mostrar, sem extensão. */
  name: string;
  size: number;
}

export function soundsDir(): string {
  return process.env.SOUNDS_DIR || path.join(process.cwd(), "sounds");
}

/**
 * Só um nome de arquivo simples, com extensão de áudio. Barras, `..` e
 * arquivos ocultos ficam de fora: a pasta é o único lugar que se lê.
 */
export function isSoundFileName(name: string): boolean {
  if (!name || name.length > 200 || name.startsWith(".")) return false;
  if (name !== path.basename(name) || /[\\/\0]/.test(name)) return false;
  return path.extname(name).toLowerCase() in SOUND_TYPES;
}

export async function listSounds(dir = soundsDir()): Promise<SoundEntry[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // Pasta ausente: nenhum áudio, não erro.
    return [];
  }
  const out: SoundEntry[] = [];
  for (const id of names.filter(isSoundFileName)) {
    try {
      const s = await stat(path.join(dir, id));
      if (!s.isFile() || s.size === 0 || s.size > MAX_SOUND_BYTES) continue;
      out.push({ id, name: id.slice(0, -path.extname(id).length), size: s.size });
    } catch {
      // Sumiu entre o readdir e o stat.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })).slice(0, MAX_SOUNDS);
}

/**
 * Nome de arquivo seguro a partir do que a pessoa mandou: sem pastas, sem
 * caracteres que o Windows ou a URL estranhariam, e com a extensão de áudio
 * original. Devolve null quando a extensão não é de áudio.
 */
export function soundFileNameFrom(original: string): string | null {
  const base = path.basename(original.replace(/\\/g, "/"));
  const ext = path.extname(base).toLowerCase();
  if (!(ext in SOUND_TYPES)) return null;
  const stem = base
    .slice(0, -ext.length)
    .normalize("NFC")
    .replace(/[\u0000-\u001f<>:"/\\|?*#%]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 100)
    .trim();
  return `${stem || "audio"}${ext}`;
}

/**
 * Grava um áudio enviado por alguém da sala. Nome repetido não sobrescreve
 * o que já estava lá: vira "nome (2).mp3". `wx` garante isso mesmo com dois
 * envios iguais ao mesmo tempo.
 */
export async function saveSound(fileName: string, bytes: Uint8Array, dir = soundsDir()): Promise<SoundEntry> {
  await mkdir(dir, { recursive: true });
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, -ext.length);
  for (let n = 1; n <= 50; n++) {
    const id = n === 1 ? fileName : `${stem} (${n})${ext}`;
    try {
      await writeFile(path.join(dir, id), bytes, { flag: "wx" });
      return { id, name: id.slice(0, -ext.length), size: bytes.byteLength };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
  throw new Error("Nomes repetidos demais para este áudio.");
}

export async function soundCount(dir = soundsDir()): Promise<number> {
  try {
    return (await readdir(dir)).filter(isSoundFileName).length;
  } catch {
    return 0;
  }
}

export { MAX_SOUNDS };
