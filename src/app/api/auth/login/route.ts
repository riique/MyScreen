import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BCRYPT_MAX_BYTES,
  comparePassword,
  exceedsBcryptLimit,
  signToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { EMAIL_PATTERN, str, withErrorHandling } from "@/lib/validate";

async function handleLogin(req: Request): Promise<NextResponse> {
  // Antes do rate limit, esta rota aceitava tentativas ilimitadas de senha
  // contra um bcrypt — a conta nao existe e a senha esta errada devolvem a
  // mesma resposta, mas o custo de CPU e real.
  enforceRateLimit(req, "login", 10, 15 * 60_000);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const email = str(body, "email", { max: 254, pattern: EMAIL_PATTERN }).toLowerCase();
  // `str` limita em CARACTERES; o bcrypt trunca em BYTES. Os dois guards sao
  // necessarios: sem o de bytes, uma senha multibyte de exatamente 72 bytes
  // (36 acentos) passa em `str` e o truncamento silencioso do bcrypt volta a
  // ser exploravel no login. Rejeitar devolve a mesma 401 generica do resto.
  const password = str(body, "password", { max: BCRYPT_MAX_BYTES });
  if (exceedsBcryptLimit(password)) {
    return NextResponse.json(
      { error: "Email ou senha incorretos." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Mensagem unica para "conta nao existe" e "senha errada": nao entrega
  // quais e-mails estao cadastrados.
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Email ou senha incorretos." },
      { status: 401 }
    );
  }

  const token = await signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}

export const POST = withErrorHandling(handleLogin);
