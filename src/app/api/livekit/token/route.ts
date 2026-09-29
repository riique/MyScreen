import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, getSessionUser } from "@/lib/auth";
import { createLiveKitToken } from "@/lib/livekit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roomId, nickname, password } = body;

    if (!roomId || !nickname) {
      return NextResponse.json(
        { error: "ID da sala e apelido são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanRoomId = roomId.toLowerCase().trim();
    const cleanNickname = nickname.trim();

    // Check if room exists and is locked
    const room = await prisma.room.findUnique({
      where: { id: cleanRoomId },
    });

    const session = await getSessionUser();
    const isRoomCreator = session && room && room.creatorId === session.userId;

    if (room && room.isLocked && !isRoomCreator) {
      if (!password) {
        return NextResponse.json(
          { error: "Esta sala requer uma senha para entrar." },
          { status: 401 }
        );
      }

      if (room.passwordHash) {
        const isValid = await comparePassword(password, room.passwordHash);
        if (!isValid) {
          return NextResponse.json(
            { error: "Senha da sala incorreta." },
            { status: 401 }
          );
        }
      }
    }

    // Generate unique participant identity
    const participantIdentity = `${cleanNickname.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const token = await createLiveKitToken({
      roomName: cleanRoomId,
      participantIdentity,
      participantName: cleanNickname,
      isHost: Boolean(isRoomCreator),
    });

    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      (process.env.DOMAIN ? `wss://${process.env.DOMAIN}` : "ws://localhost:7880");

    return NextResponse.json({
      token,
      livekitUrl,
      participantIdentity,
      participantName: cleanNickname,
      isHost: Boolean(isRoomCreator),
    });
  } catch (error) {
    console.error("Erro ao gerar token LiveKit:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao gerar token da conferência." },
      { status: 500 }
    );
  }
}
