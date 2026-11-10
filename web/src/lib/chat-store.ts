import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Histórico do chat, uma pasta por sala. Quem sai, reinicia o app e volta
 * para a mesma sala encontra as mensagens e os arquivos como estavam.
 *
 * Disco, não banco: os anexos já são arquivos, e o histórico de uma sala é
 * sempre lido e escrito inteiro — um JSON por sala basta. Escritas na mesma
 * sala passam por uma fila, então dois envios simultâneos não se atropelam.
 */

export const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;
export const MAX_MESSAGE_CHARS = 20_000;
/** Acima disso as mensagens mais antigas (e os arquivos delas) saem. */
const MAX_MESSAGES = 2_000;
const MAX_ROOM_FILE_BYTES = 2 * 1024 * 1024 * 1024;
/** Arquivo enviado e nunca preso a uma mensagem (envio que falhou no meio). */
const ORPHAN_MS = 60 * 60 * 1000;

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface StoredMessage {
  id: string;
  timestamp: number;
  message: string;
  attributes: Record<string, string>;
  fromIdentity: string;
  fromName: string;
  files: StoredFile[];
}

interface FileMeta extends StoredFile {
  uploader: string;
  createdAt: number;
}

export function chatDir(): string {
  return process.env.CHAT_DIR || path.join(process.cwd(), "data", "chat");
}

/** O código da sala vira um hash: nada do que a pessoa digita chega ao caminho. */
function roomDir(roomId: string, base = chatDir()): string {
  return path.join(base, createHash("sha256").update(roomId).digest("hex").slice(0, 32));
}

const FILE_ID = /^[0-9a-f]{32}$/;

export function isFileId(id: string): boolean {
  return FILE_ID.test(id);
}

const queues = new Map<string, Promise<unknown>>();

function serialized<T>(roomId: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(roomId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  queues.set(roomId, next);
  void next.finally(() => {
    if (queues.get(roomId) === next) queues.delete(roomId);
  }).catch(() => {});
  return next;
}

async function readMessages(dir: string): Promise<StoredMessage[]> {
  try {
    const raw = JSON.parse(await readFile(path.join(dir, "messages.json"), "utf8"));
    return Array.isArray(raw) ? (raw as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

async function writeMessages(dir: string, messages: StoredMessage[]): Promise<void> {
  const file = path.join(dir, "messages.json");
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(messages));
  await rename(tmp, file);
}

export async function listMessages(roomId: string, base = chatDir()): Promise<StoredMessage[]> {
  return readMessages(roomDir(roomId, base));
}

async function readFileMeta(dir: string, fileId: string): Promise<FileMeta | null> {
  try {
    return JSON.parse(await readFile(path.join(dir, "files", `${fileId}.json`), "utf8")) as FileMeta;
  } catch {
    return null;
  }
}

/** Guarda um anexo; ele só entra no histórico quando uma mensagem o citar. */
export async function saveChatFile(
  roomId: string,
  uploader: string,
  file: { name: string; type: string; bytes: Uint8Array },
  base = chatDir()
): Promise<StoredFile> {
  const dir = path.join(roomDir(roomId, base), "files");
  await mkdir(dir, { recursive: true });
  const id = randomUUID().replace(/-/g, "");
  const meta: FileMeta = {
    id,
    name: path.basename(file.name.replace(/\\/g, "/")).slice(0, 200) || "arquivo",
    type: /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type.slice(0, 100) : "application/octet-stream",
    size: file.bytes.byteLength,
    uploader,
    createdAt: Date.now(),
  };
  await writeFile(path.join(dir, id), file.bytes);
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(meta));
  return { id, name: meta.name, type: meta.type, size: meta.size };
}

export async function readChatFile(
  roomId: string,
  fileId: string,
  base = chatDir()
): Promise<{ meta: StoredFile; bytes: Buffer } | null> {
  if (!isFileId(fileId)) return null;
  const dir = roomDir(roomId, base);
  const meta = await readFileMeta(dir, fileId);
  if (!meta) return null;
  try {
    const bytes = await readFile(path.join(dir, "files", fileId));
    return { meta: { id: meta.id, name: meta.name, type: meta.type, size: meta.size }, bytes };
  } catch {
    return null;
  }
}

export type AppendResult = { ok: true; message: StoredMessage; duplicate: boolean } | { ok: false; error: string };

/**
 * Acrescenta uma mensagem. O mesmo `id` duas vezes (reenvio, dois cliques)
 * fica uma só. Os anexos precisam ter sido enviados por quem manda a mensagem.
 */
export function appendMessage(
  roomId: string,
  input: Omit<StoredMessage, "files"> & { fileIds: string[] },
  base = chatDir()
): Promise<AppendResult> {
  return serialized(roomId, async () => {
    const dir = roomDir(roomId, base);
    await mkdir(dir, { recursive: true });
    const messages = await readMessages(dir);
    const existing = messages.find((m) => m.id === input.id);
    if (existing) return { ok: true, message: existing, duplicate: true };

    const files: StoredFile[] = [];
    for (const fileId of input.fileIds) {
      const meta = isFileId(fileId) ? await readFileMeta(dir, fileId) : null;
      if (!meta || meta.uploader !== input.fromIdentity) return { ok: false, error: "Anexo não encontrado." };
      files.push({ id: meta.id, name: meta.name, type: meta.type, size: meta.size });
    }

    const message: StoredMessage = {
      id: input.id,
      timestamp: input.timestamp,
      message: input.message,
      attributes: input.attributes,
      fromIdentity: input.fromIdentity,
      fromName: input.fromName,
      files,
    };
    messages.push(message);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    await prune(dir, messages);
    await writeMessages(dir, messages);
    return { ok: true, message, duplicate: false };
  });
}

export type DeleteResult = "deleted" | "missing" | "forbidden";

/** Só o autor apaga. Os anexos da mensagem saem do disco junto. */
export function deleteMessage(roomId: string, messageId: string, identity: string, base = chatDir()): Promise<DeleteResult> {
  return serialized(roomId, async () => {
    const dir = roomDir(roomId, base);
    const messages = await readMessages(dir);
    const index = messages.findIndex((m) => m.id === messageId);
    if (index < 0) return "missing";
    const [gone] = messages.splice(index, 1);
    if (gone.fromIdentity !== identity) return "forbidden";
    await writeMessages(dir, messages);
    for (const f of gone.files) {
      await unlink(path.join(dir, "files", f.id)).catch(() => {});
      await unlink(path.join(dir, "files", `${f.id}.json`)).catch(() => {});
    }
    return "deleted";
  });
}

/** Tira as mensagens mais antigas além dos tetos e apaga os arquivos que ninguém mais cita. */
async function prune(dir: string, messages: StoredMessage[]): Promise<void> {
  let bytes = messages.reduce((sum, m) => sum + m.files.reduce((s, f) => s + f.size, 0), 0);
  while (messages.length > MAX_MESSAGES || (bytes > MAX_ROOM_FILE_BYTES && messages.length > 1)) {
    const old = messages.shift()!;
    bytes -= old.files.reduce((s, f) => s + f.size, 0);
  }

  const referenced = new Set(messages.flatMap((m) => m.files.map((f) => f.id)));
  const filesDir = path.join(dir, "files");
  let names: string[];
  try {
    names = await readdir(filesDir);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!isFileId(name) || referenced.has(name)) continue;
    const meta = await readFileMeta(dir, name);
    // Recém-enviado: a mensagem que o cita pode estar a caminho.
    if (meta && now - meta.createdAt < ORPHAN_MS) continue;
    if (!meta) {
      const s = await stat(path.join(filesDir, name)).catch(() => null);
      if (s && now - s.mtimeMs < ORPHAN_MS) continue;
    }
    await unlink(path.join(filesDir, name)).catch(() => {});
    await unlink(path.join(filesDir, `${name}.json`)).catch(() => {});
  }
}
