import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { EMAIL_PATTERN, HttpError, str, withErrorHandling } from "@/lib/validate";

/**
 * Limite do bcrypt: 72 bytes. Acima disso o hash nao fica mais seguro, o
 * truncamento e silencioso — e ainda assim o servidor gasta CPU com o resto.
 */
const BCRYPT_MAX_BYTES = 72;

async function handleRegister(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "register", 5, 60 * 60_000);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const name = str(body, "name", { max: 80 });
  const email = str(body, "email", { max: 254, pattern: EMAIL_PATTERN }).toLowerCase();
  // `str` conta caracteres, o bcrypt corta em bytes: 128 chars podem passar do
  // limite em UTF-8 sem o transporte rejeitar.
  const password = str(body, "password", { min: 10, max: BCRYPT_MAX_BYTES });

  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw new HttpError(400, "A senha deve ter no máximo 72 bytes.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Este email já está cadastrado." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, name: true },
  });

  const token = await signToken({ userId: user.id, email: user.email, name: user.name });

  const response = NextResponse.json({ success: true, user });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}

export const POST = withErrorHandling(handleRegister);
