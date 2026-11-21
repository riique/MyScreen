import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { HttpError, withErrorHandling } from "@/lib/validate";
import {
  checkDeletePassword,
  deleteSound,
  isSoundFileName,
  MAX_SOUND_BYTES,
  renameSound,
  SOUND_TYPES,
  soundsDir,
} from "@/lib/sounds";

export const dynamic = "force-dynamic";

/** O arquivo de um áudio, pelo nome que a lista devolveu. */
async function handleGet(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-get", 60, 60_000);

  const { id } = await params;
  if (!isSoundFileName(id)) {
    return NextResponse.json({ error: "Áudio não encontrado." }, { status: 404 });
  }
  const file = path.join(soundsDir(), id);
  try {
    const s = await stat(file);
    if (!s.isFile() || s.size > MAX_SOUND_BYTES) throw new Error("fora do limite");
  } catch {
    return NextResponse.json({ error: "Áudio não encontrado." }, { status: 404 });
  }
  const bytes = await readFile(file);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": SOUND_TYPES[path.extname(id).toLowerCase()],
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-cache",
    },
  });
}

async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * Troca o nome de um áudio. Qualquer pessoa numa sala pode, como no envio.
 * Corpo: `{ name }`, sem extensão (a original fica).
 */
async function handleRename(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-rename", 30, 60_000);
  await requireRoomCaller(req);
  const { id } = await params;
  const body = await jsonBody(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(400, "Escreva o nome novo do áudio.", "name");
  if (name.length > 100) throw new HttpError(400, "Nome longo demais. O limite é 100 caracteres.", "name");

  const result = await renameSound(id, name);
  if (result === "not-found") throw new HttpError(404, "Esse áudio não está mais no servidor.");
  if (result === "invalid") throw new HttpError(400, "Esse nome não serve para um arquivo. Tente outro.", "name");
  if (result === "exists") throw new HttpError(409, "Já existe um áudio com esse nome.", "name");
  return NextResponse.json({ sound: result });
}

/**
 * Apaga um áudio do servidor: some para todo mundo. Além de estar numa sala,
 * pede a senha. Corpo: `{ password }`.
 */
async function handleDelete(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Teto baixo: a senha não pode ser adivinhada na força bruta.
  enforceRateLimit(req, "sounds-delete", 10, 10 * 60_000);
  await requireRoomCaller(req);
  const { id } = await params;
  const body = await jsonBody(req);
  if (!checkDeletePassword(body.password)) throw new HttpError(403, "Senha errada.", "password");
  if (!(await deleteSound(id))) throw new HttpError(404, "Esse áudio não está mais no servidor.");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrorHandling(handleGet);
export const PATCH = withErrorHandling(handleRename);
export const DELETE = withErrorHandling(handleDelete);
