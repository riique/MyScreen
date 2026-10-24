import { readdir, stat } from "node:fs/promises";
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
