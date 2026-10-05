import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes de comportamento dos handlers: status code, o que NAO e velado e,
 * sobretudo, quais entradas nao podem alcanca a KDF.
 *
 * O Prisma e a fronteira mockada — e o unico motivo de o mock existir. O que se
 * afirma aqui e comportamento de ponta visivel ao consumidor.
 */
const { roomFindUnique, kdfCompare } = vi.hoisted(() => ({
  roomFindUnique: vi.fn(),
  kdfCompare: vi.fn(async () => false),
}));

/**
 * A KDF e observada, nao simulada em branco. A razao de existir e negativa —
 * "esta entrada NAO pode chegar ao bcrypt" — e um `expect(res.status).toBe(401)`
 * nao a prova: sem o guard, um hash invalido no mock tambem devolveria 401 e o
 * teste passaria pelo motivo errado. Contar as chamadas e o que torna a
 * assercao verdadeira.
 */
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hash"), compare: kdfCompare },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: { findUnique: roomFindUnique },
  },
}));

import { POST as token } from "@/app/api/livekit/token/route";

let ipCounter = 0;
/** IP novo por teste: o rate limit e estado de modulo, nao por request. */
function uniqueIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

function post(body: unknown, ip = uniqueIp()) {
  return new Request("http://x/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}


beforeEach(() => {
  roomFindUnique.mockReset();
  kdfCompare.mockClear();
  kdfCompare.mockResolvedValue(false);
});

describe("POST /api/livekit/token", () => {
  const trancada = { id: "abc", passwordHash: "$2a$04$hash", isLocked: true };
  const aberta = { id: "abc", passwordHash: null, isLocked: false };

  it("sala trancada sem senha responde 401 e nao emite token", async () => {
    roomFindUnique.mockResolvedValue(trancada);
    const res = await token(post({ roomId: "abc", nickname: "ana" }));
    expect(res.status).toBe(401);
    expect((await res.json()).token).toBeUndefined();
  });

  it("senha de sala de 1 MB nao alcanca a KDF", async () => {
    // Esta era a unica rota que rodava `comparePassword` sem teto: um corpo
    // grande virava DoS de CPU, e nao so de banda.
    roomFindUnique.mockResolvedValue(trancada);
    const res = await token(post({ roomId: "abc", nickname: "ana", password: "A".repeat(1_000_000) }));
    expect(res.status).toBe(401);
    expect(kdfCompare).not.toHaveBeenCalled();
  });

  it("senha de sala multibyte acima de 72 BYTES nao alcanca a KDF", async () => {
    roomFindUnique.mockResolvedValue(trancada);
    const res = await token(post({ roomId: "abc", nickname: "ana", password: "é".repeat(40) }));
    expect(res.status).toBe(401);
    expect(kdfCompare).not.toHaveBeenCalled();
  });

  it("senha dentro do limite CHEGA a KDF (controle: a assercao acima nao e vacua)", async () => {
    roomFindUnique.mockResolvedValue(trancada);
    kdfCompare.mockResolvedValue(true);
    const res = await token(post({ roomId: "abc", nickname: "ana", password: "segredo-curto" }));
    expect(res.status).toBe(200);
    expect(kdfCompare).toHaveBeenCalledTimes(1);
  });

  it("campos com tipo errado respondem 400 sem consultar o banco", async () => {
    const res = await token(post({ roomId: 42, nickname: {} }));
    expect(res.status).toBe(400);
    expect(roomFindUnique).not.toHaveBeenCalled();
  });

  it("sala aberta nao exige senha e normaliza o id", async () => {
    roomFindUnique.mockResolvedValue(aberta);
    const res = await token(post({ roomId: "ABC", nickname: "ana" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token as string).toBeTruthy();
    expect(body.participantIdentity as string).toMatch(/^ana-[0-9a-f]{8}$/);
  });

  it("reaproveita a identidade no refresh, mas nao a de outro apelido", async () => {
    roomFindUnique.mockResolvedValue(aberta);
    const primeira = await (await token(post({ roomId: "abc", nickname: "ana" }))).json();

    const refresh = await (
      await token(post({ roomId: "abc", nickname: "ana", participantIdentity: primeira.participantIdentity }))
    ).json();
    expect(refresh.participantIdentity).toBe(primeira.participantIdentity);

    // Sem o vinculo com o apelido, o corpo viraria vetor de impersonacao: o
    // atacante pediria a identidade de outra pessoa e receberia um AccessToken
    // assinado com ela.
    const forgery = await (
      await token(post({ roomId: "abc", nickname: "ana", participantIdentity: "bob-12345678" }))
    ).json();
    expect(forgery.participantIdentity).not.toBe("bob-12345678");
  });
});
