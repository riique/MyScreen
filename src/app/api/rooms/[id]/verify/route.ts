import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roomId = id.toLowerCase().trim();
    const { password } = await req.json().catch(() => ({}));

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        passwordHash: true,
        isLocked: true,
      },
    });

    if (!room || !room.isLocked || !room.passwordHash) {
      return NextResponse.json({ valid: true });
    }

    if (!password) {
      return NextResponse.json(
        { valid: false, error: "Senha necessária para acessar esta sala." },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, room.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: "Senha incorreta." },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Erro ao validar senha da sala:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao validar senha." },
      { status: 500 }
    );
  }
}
