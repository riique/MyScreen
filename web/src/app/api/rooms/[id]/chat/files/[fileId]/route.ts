import { NextResponse } from "next/server";
import { readChatFile } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Os bytes de um anexo do histórico. Sempre como download, nunca renderizado aqui. */
async function handleGet(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "chat-file-get", 300, 60_000);
  const { id, fileId } = await params;
  const roomId = normalizeRoomId(id);
  await requireRoomCaller(req, roomId);

  const found = await readChatFile(roomId, fileId);
  if (!found) return NextResponse.json({ error: "Arquivo não está mais no servidor." }, { status: 404 });
  return new NextResponse(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.meta.type,
      "Content-Length": String(found.bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(found.meta.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export const GET = withErrorHandling(handleGet);
