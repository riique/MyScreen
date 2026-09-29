import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { generateRoomId } from "@/lib/utils";

// Create a new room
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    const body = await req.json().catch(() => ({}));
    const { title, password, customId } = body;

    let roomId = customId ? customId.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-") : generateRoomId();

    // Check if room ID already exists
    const existing = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (existing) {
      if (customId) {
        return NextResponse.json(
          { error: "Este ID de sala já está em uso. Escolha outro." },
          { status: 409 }
        );
      }
      roomId = `${roomId}-${Math.floor(100 + Math.random() * 900)}`;
    }

    let passwordHash: string | null = null;
    let isLocked = false;

    if (password && password.trim().length > 0) {
      passwordHash = await hashPassword(password.trim());
      isLocked = true;
    }

    const room = await prisma.room.create({
      data: {
        id: roomId,
        title: title?.trim() || `Sala ${roomId}`,
        passwordHash,
        isLocked,
        creatorId: session?.userId || null,
      },
    });

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        title: room.title,
        isLocked: room.isLocked,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error("Erro ao criar sala:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao criar sala." },
      { status: 500 }
    );
  }
}

// Get user's created rooms
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ rooms: [] });
    }

    const rooms = await prisma.room.findMany({
      where: { creatorId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        isLocked: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Erro ao buscar salas:", error);
    return NextResponse.json({ rooms: [] });
  }
}
