import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json({ user: user ?? null });
  } catch (error) {
    console.error("Erro ao obter sessão:", error);
    return NextResponse.json({ user: null });
  }
}
