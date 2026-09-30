import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";

/** Logout nao custa CPU (nao ha KDF nem query), mas o loop infinito de POST
 *  ainda escreve cookie em cada resposta — e o limite mantem o padrao de "toda
 *  rota de API tem teto". */
async function handleLogout(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "auth-logout", 30, 60_000);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  return response;
}

export const POST = withErrorHandling(handleLogout);
