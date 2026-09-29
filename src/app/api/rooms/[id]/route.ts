import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";

/** Consulta publica de sala: existe, titulo, se esta trancada. */
async function handleGet(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "room-lookup", 120, 60_000);

  const { id } = await params;
  const roomId = id.toLowerCase().trim();

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, title: true, isLocked: true, createdAt: true },
  });

  // Salas efemeras nunca persistidas continuam valendo: o SFU aceita qualquer
  // nome de sala e o app cria sala ao entrar.
  if (!room) {
    return NextResponse.json({
      exists: false,
      room: { id: roomId, title: `Sala ${roomId}`, isLocked: false },
    });
  }

  return NextResponse.json({ exists: true, room });
}

export const GET = withErrorHandling(handleGet);
