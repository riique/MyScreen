import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";

/** Limite do bcrypt: 72 bytes. */
const BCRYPT_MAX_BYTES = 72;

/**
 * Oraculo de senha de sala — sem rate limit isto e um verificador de senha
 * ilimitado e sem autenticacao, rodando bcrypt a cada requisicao.
 */
async function handleVerify(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "room-verify", 20, 15 * 60_000);

  const { id } = await params;
  const roomId = id.toLowerCase().trim();
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    return NextResponse.json({ valid: false, error: "Senha incorreta." }, { status: 401 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { passwordHash: true, isLocked: true },
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

  if (!(await comparePassword(password, room.passwordHash))) {
    return NextResponse.json({ valid: false, error: "Senha incorreta." }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}

export const POST = withErrorHandling(handleVerify);
