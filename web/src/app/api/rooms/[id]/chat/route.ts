import { NextResponse } from "next/server";
import { appendMessage, listMessages, MAX_FILES_PER_MESSAGE, MAX_MESSAGE_CHARS } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { HttpError, withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Histórico do chat da sala, para quem está nela. */
async function handleList(req: Request, { params }: Ctx): Promise<NextResponse> {
  enforceRateLimit(req, "chat-list", 120, 60_000);
  const roomId = normalizeRoomId((await params).id);
  await requireRoomCaller(req, roomId);
  const messages = await listMessages(roomId);
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Guarda uma mensagem que acabou de ir pela sala. O autor vem do token; os
 * anexos já subiram por `/chat/files` e vêm aqui só pelos ids.
 */
async function handleAppend(req: Request, { params }: Ctx): Promise<NextResponse> {
  enforceRateLimit(req, "chat-append", 240, 60_000);
  const roomId = normalizeRoomId((await params).id);
  const caller = await requireRoomCaller(req, roomId);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || id.length > 128) throw new HttpError(400, "Mensagem sem id.");
  const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE_CHARS) : "";
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((f): f is string => typeof f === "string").slice(0, MAX_FILES_PER_MESSAGE)
    : [];
  if (!message.trim() && fileIds.length === 0) throw new HttpError(400, "Mensagem vazia.");

  const attributes: Record<string, string> = {};
  if (typeof body.attributes === "object" && body.attributes !== null) {
    for (const [k, v] of Object.entries(body.attributes).slice(0, 10)) {
      if (typeof v === "string" && k.length <= 64) attributes[k] = v.slice(0, 256);
    }
  }
  // A hora do cliente ordena a conversa, mas não pode cair no futuro nem muito no passado.
  const now = Date.now();
  const ts = typeof body.timestamp === "number" && Number.isFinite(body.timestamp) ? body.timestamp : now;
  const timestamp = Math.min(now, Math.max(now - 10 * 60_000, ts));

  const result = await appendMessage(roomId, {
    id,
    timestamp,
    message,
    attributes,
    fromIdentity: caller.identity,
    fromName: caller.name,
    fileIds,
  });
  if (!result.ok) throw new HttpError(400, result.error);
  return NextResponse.json({ message: result.message }, { status: result.duplicate ? 200 : 201 });
}

export const GET = withErrorHandling(handleList);
export const POST = withErrorHandling(handleAppend);
