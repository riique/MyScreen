import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { generateRoomId } from "@/lib/utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { str, withErrorHandling } from "@/lib/validate";

/** Limite do bcrypt: 72 bytes. Acima disso o hash nao fica mais seguro. */
const BCRYPT_MAX_BYTES = 72;
const CUSTOM_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

async function handleCreate(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "rooms-create", 20, 60 * 60_000);

  const session = await getSessionUser();
  const body: Record<string, unknown> = await req.json().catch(() => ({}));

  const title = str(body, "title", { max: 120 });

  // `hashPassword` (bcrypt custo 12) roda por requisicao: um payload sem teto
  // de tamanho vira DoS de CPU, nao so de banda.
  const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
  if (Buffer.byteLength(rawPassword, "utf8") > BCRYPT_MAX_BYTES) {
    return NextResponse.json(
      { error: `A senha deve ter no máximo ${BCRYPT_MAX_BYTES} caracteres.` },
      { status: 400 }
    );
  }

  const wantsCustomId = typeof body.customId === "string" && body.customId.trim().length > 0;
  const customId = wantsCustomId
    ? str(body, "customId", { max: 32, pattern: CUSTOM_ID_PATTERN }).toLowerCase()
    : undefined;

  // Colisao em id gerado e normal (o espaço e 26^9). O codigo antigo
  // resolvia com um sufixo `-NNN` que podia colidir de novo; repetir o sorteio
  // nao tem chance de colidir com o id recem-criado.
  let roomId = customId ?? generateRoomId();
  if (customId) {
    const existing = await prisma.room.findUnique({ where: { id: roomId } });
    if (existing) {
      return NextResponse.json(
        { error: "Este ID de sala já está em uso. Escolha outro." },
        { status: 409 }
      );
    }
  } else {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.room.findUnique({ where: { id: roomId } });
      if (!existing) break;
      roomId = generateRoomId();
    }
  }

  const room = await prisma.room.create({
    data: {
      id: roomId,
      title,
      passwordHash: rawPassword ? await hashPassword(rawPassword) : null,
      isLocked: rawPassword.length > 0,
      creatorId: session?.userId ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    // `anonymous` importa: sala criada sem sessao fica com `creatorId: null` e
    // NUNCA aparece no painel de ninguem. Sem sinalizar isso no corpo da
    // resposta, o cliente fecha o modal, refaz a lista e o usuario conclui que
    // a sala sumiu — sem nenhum link em lugar nenhum.
    anonymous: room.creatorId === null,
    room: {
      id: room.id,
      title: room.title,
      isLocked: room.isLocked,
      createdAt: room.createdAt,
    },
  });
}

async function handleList(): Promise<NextResponse> {
  const session = await getSessionUser();
  if (!session) {
    // 401 e nao 200 com lista vazia: sem isso o painel nao distingue "voce nao
    // tem salas" de "sua sessao expirou" e mostra o estado vazio para quem esta
    // deslogado — que clica em criar, tem 200 na criacao e volta a ver vazio.
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente para ver suas salas." },
      { status: 401 }
    );
  }

  // Seguro porque `verifyToken` rejeita token sem a claim `userId`: sem esse
  // guard, `session.userId` era `undefined` e o Prisma tratava como
  // "remover este filtro", devolvendo TODAS as salas.
  const rooms = await prisma.room.findMany({
    where: { creatorId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, isLocked: true, createdAt: true },
  });

  return NextResponse.json({ rooms });
}

export const POST = withErrorHandling(handleCreate);
export const GET = withErrorHandling(handleList);
