import { NextResponse } from "next/server";
import { readArchive } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Uma conversa arquivada, com as mensagens. Os anexos vêm por `/chat/files/:fileId`. */
async function handleGet(
  req: Request,
  { params }: { params: Promise<{ id: string; archiveId: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "chat-archive-get", 120, 60_000);
  const { id, archiveId } = await params;
  const roomId = normalizeRoomId(id);
  await requireRoomCaller(req, roomId);
  const archive = await readArchive(roomId, archiveId);
  if (!archive) return NextResponse.json({ error: "Essa conversa salva não existe mais." }, { status: 404 });
  return NextResponse.json({ archive }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withErrorHandling(handleGet);
