import { NextResponse } from "next/server";
import { deleteMessage } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { HttpError, withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Apaga do histórico uma mensagem de quem pede. Mensagem que nunca foi salva já não existe: 204 também. */
async function handleDelete(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "chat-delete", 120, 60_000);
  const { id, messageId } = await params;
  const roomId = normalizeRoomId(id);
  const caller = await requireRoomCaller(req, roomId);
  if (!messageId || messageId.length > 128) throw new HttpError(400, "Mensagem sem id.");

  const result = await deleteMessage(roomId, messageId, caller.identity);
  if (result === "forbidden") throw new HttpError(403, "Só quem mandou a mensagem pode apagá-la.");
  return new NextResponse(null, { status: 204 });
}

export const DELETE = withErrorHandling(handleDelete);
