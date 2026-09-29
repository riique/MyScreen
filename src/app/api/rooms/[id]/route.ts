import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roomId = id.toLowerCase().trim();

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        title: true,
        isLocked: true,
        createdAt: true,
      },
    });

    if (!room) {
      // Allow instant ephemeral rooms if not yet saved in database
      return NextResponse.json({
        exists: false,
        room: {
          id: roomId,
          title: `Sala ${roomId}`,
          isLocked: false,
        },
      });
    }

    return NextResponse.json({
      exists: true,
      room,
    });
  } catch (error) {
    console.error("Erro ao consultar sala:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao consultar sala." },
      { status: 500 }
    );
  }
}
