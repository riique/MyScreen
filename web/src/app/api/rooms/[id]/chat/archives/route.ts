import { NextResponse } from "next/server";
import { archiveChat, listArchives } from "@/lib/chat-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { normalizeRoomId } from "@/lib/utils";
import { HttpError, withErrorHandling } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** As conversas arquivadas da sala, da mais nova para a mais antiga (sem as mensagens). */
async function handleList(req: Request, { params }: Ctx): Promise<NextResponse> {
  enforceRateLimit(req, "chat-archives-list", 120, 60_000);
  const roomId = normalizeRoomId((await params).id);
  await requireRoomCaller(req, roomId);
  const archives = await listArchives(roomId);
  return NextResponse.json({ archives }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Arquiva a conversa atual: as mensagens e os anexos vão para uma conversa
 * salva e o chat da sala recomeça vazio. Qualquer um na sala pode.
 */
async function handleArchive(req: Request, { params }: Ctx): Promise<NextResponse> {
  enforceRateLimit(req, "chat-archive", 10, 10 * 60_000);
  const roomId = normalizeRoomId((await params).id);
  const caller = await requireRoomCaller(req, roomId);
  const result = await archiveChat(roomId, caller.name || caller.identity);
  if (!result.ok) throw new HttpError(409, "Não há mensagens para arquivar.");
  return NextResponse.json({ archive: result.archive, archivedIds: result.archivedIds }, { status: 201 });
}

export const GET = withErrorHandling(handleList);
export const POST = withErrorHandling(handleArchive);
