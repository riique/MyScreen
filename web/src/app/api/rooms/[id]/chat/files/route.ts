import { NextResponse } from "next/server";
import { MAX_CHAT_FILE_BYTES, saveChatFile } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { HttpError, withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

const LIMIT_MB = MAX_CHAT_FILE_BYTES / 1024 / 1024;

/** Um anexo do chat (qualquer tipo de arquivo), `multipart/form-data` com `file`. */
async function handleUpload(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "chat-file", 60, 10 * 60_000);
  const roomId = normalizeRoomId((await params).id);
  const caller = await requireRoomCaller(req, roomId);

  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_CHAT_FILE_BYTES + 64 * 1024) {
    throw new HttpError(413, `Arquivo grande demais. O limite é ${LIMIT_MB} MB.`);
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Arquivo vazio.");
  if (file.size > MAX_CHAT_FILE_BYTES) throw new HttpError(413, `Arquivo grande demais. O limite é ${LIMIT_MB} MB.`);

  const stored = await saveChatFile(roomId, caller.identity, {
    name: file.name,
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json({ file: stored }, { status: 201 });
}

export const POST = withErrorHandling(handleUpload);
