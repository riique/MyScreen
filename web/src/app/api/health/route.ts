import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health check do container. E o que mantem a garantia de fail-closed depois
 * que `env.ts` passou a validar preguiçosamente: com configuracao invalida o
 * processo sobe (para o build nao quebrar), mas responde 503 aqui — o container
 * fica `unhealthy` e o `depends_on: service_healthy` do Caddy nunca publica
 * trafego para um app que nao funciona.
 */
export async function GET() {
  const started = Date.now();

  const config = env.check();
  if (!config.ok) {
    return NextResponse.json(
      { ok: false, db: "unknown", config: "invalid", missing: config.missing },
      { status: 503 }
    );
  }

  try {
    // `SELECT 1` so prova que o processo alcancou o arquivo do SQLite — num
    // banco recem-criado sem schema ele responde 200, o container fica `healthy`,
    // o Caddy libera o trafego e todo endpoint que fala com o Prisma responde
    // 500. Ler uma tabela real e o que torna o sinal verdadeiro.
    await prisma.$queryRaw`SELECT 1 FROM "Room" LIMIT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      dbLatencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check falhou:", err);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
