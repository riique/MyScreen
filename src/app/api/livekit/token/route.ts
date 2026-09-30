import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { comparePassword, exceedsBcryptLimit, getSessionUser } from "@/lib/auth";
import { createLiveKitToken } from "@/lib/livekit";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { str, withErrorHandling } from "@/lib/validate";

/**
 * Emite token do SFU.
 *
 * Sem autenticacao e com `comparePassword` (bcrypt custo 12) no caminho da
 * senha de sala, esta rota e o alvo natural de forca bruta — por isso o rate
 * limit e obrigatorio aqui, e nao opcional.
 */
async function handleToken(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "livekit-token", 30, 15 * 60_000);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const roomId = str(body, "roomId", { max: 64 }).toLowerCase();
  const nickname = str(body, "nickname", { max: 64 });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, passwordHash: true, isLocked: true, creatorId: true },
  });

  const session = await getSessionUser();
  const isRoomCreator = Boolean(session && room && room.creatorId === session.userId);

  if (room && room.isLocked && !isRoomCreator) {
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json(
        { error: "Esta sala requer uma senha para entrar." },
        { status: 401 }
      );
    }
    // Guarda de BYTES antes do bcrypt. Esta era a UNICA rota que rodava
    // `comparePassword` sem teto: um corpo com senha de vários MB consumia o
    // custo 12 inteiro, e um `str(... {max: 72})` em caracteres nao serviria
    // aqui — a senha de sala nao passa por `str` porque e opcional.
    if (exceedsBcryptLimit(password)) {
      return NextResponse.json(
        { error: "Senha incorreta." },
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

  // Identidade ESTAVEL. Antes era sorteada a cada chamada, o que fazia o
  // console obvio ("so buscar o token de novo") reconectar o usuario sob uma
  // segunda identidade: participante duplicado na sala por ate 300s e
  // `localIdentity` trocado no chat.
  //
  // A identidade so e REUSADA quando casa com a forma que este proprio
  // servidor emite para ESTE apelido: `<apelido-sanitizado>-<8 hex>`. Sem essa
  // checagem, o corpo da requisicao viraria um vetor de impersonacao — o
  // atacante escreveria `participantIdentity` de outra pessoa e receberia um
  // AccessToken assinado com a identidade alheia, entrando na sala como ela
  // (com nome e avatar no chat). Vinculando o prefixo ao apelido da propria
  // requisicao, ninguem consegue reivindicar a identidade de outro apelido.
  const identityPrefix = `${nickname.replace(/[^a-zA-Z0-9_-]/g, "_")}-`;
  const provided =
    typeof body.participantIdentity === "string" ? body.participantIdentity.trim() : "";
  const reusesIssuedIdentity =
    provided.length > 0 &&
    provided.length <= 64 &&
    provided.startsWith(identityPrefix) &&
    provided.length === identityPrefix.length + 8 &&
    /^[0-9a-f]{8}$/.test(provided.slice(identityPrefix.length));

  const participantIdentity = reusesIssuedIdentity
    ? provided
    : `${identityPrefix}${randomUUID().slice(0, 8)}`;

  const token = await createLiveKitToken({
    roomName: roomId,
    participantIdentity,
    participantName: nickname,
    isHost: isRoomCreator,
  });

  return NextResponse.json({
    token,
    livekitUrl: env.publicLiveKitUrl,
    participantIdentity,
    participantName: nickname,
    isHost: isRoomCreator,
  });
}

export const POST = withErrorHandling(handleToken);
