import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";

/**
 * Sondagem de sessao. O `catch` interno e deliberado: uma falha de banco aqui
 * deve virar `{user: null}` (a UI cai no estado deslogado) e nao um 500 — mas o
 * rate limit fica FORA dele, para estourar o limite de verdade nao virar um
 * `{user: null}` silencioso a cada tentativa.
 */
async function handleMe(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "auth-me", 120, 60_000);

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

export const GET = withErrorHandling(handleMe);
