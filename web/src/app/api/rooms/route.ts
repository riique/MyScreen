import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BCRYPT_MAX_BYTES, exceedsBcryptLimit, hashPassword } from "@/lib/auth";
import { generateRoomId } from "@/lib/utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { str, withErrorHandling } from "@/lib/validate";

const CUSTOM_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

async function handleCreate(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "rooms-create", 20, 60 * 60_000);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));

  const title = str(body, "title", { max: 120 });

  // `hashPassword` (bcrypt custo 12) roda por requisicao: um payload sem teto
  // de tamanho vira DoS de CPU, nao so de banda.
  const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
  if (exceedsBcryptLimit(rawPassword)) {
    return NextResponse.json(
      { error: `A senha deve ter no máximo ${BCRYPT_MAX_BYTES} bytes.` },
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
    },
  });

  return NextResponse.json({
    success: true,
    room: {
      id: room.id,
      title: room.title,
      isLocked: room.isLocked,
      createdAt: room.createdAt,
    },
  });
}

export const POST = withErrorHandling(handleCreate);
