import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

/**
 * Testes de comportamento dos handlers: status code, o que NAO e velado e,
 * sobretudo, quais entradas nao podem alcanca a KDF.
 *
 * O Prisma e a fronteira mockada — e o unico motivo de o mock existir. O que se
 * afirma aqui e comportamento de ponta visivel ao consumidor.
 */
const { userFindUnique, roomFindUnique, roomFindMany, kdfCompare } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  roomFindUnique: vi.fn(),
  roomFindMany: vi.fn(),
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
    user: { findUnique: userFindUnique },
    room: { findUnique: roomFindUnique, findMany: roomFindMany },
  },
}));

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
  })),
}));

import { signToken } from "@/lib/auth";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as token } from "@/app/api/livekit/token/route";
import { GET as listRooms } from "@/app/api/rooms/route";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

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

function get(path: string, ip = uniqueIp()) {
  return new Request(`http://x${path}`, { headers: { "x-forwarded-for": ip } });
}

beforeEach(() => {
  userFindUnique.mockReset();
  roomFindUnique.mockReset();
  roomFindMany.mockReset();
  kdfCompare.mockClear();
  kdfCompare.mockResolvedValue(false);
  cookieValue = undefined;
});

describe("POST /api/auth/login", () => {
  it("senha errada responde 401 sem emitir cookie", async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await login(post({ email: "ana@teste.com", password: "errada-123" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("email de tipo errado responde 400 sem consultar o banco", async () => {
    const res = await login(post({ email: 123, password: "qualquer" }));
    expect(res.status).toBe(400);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("campo ausente responde 400", async () => {
    const res = await login(post({ email: "ana@teste.com" }));
    expect(res.status).toBe(400);
  });

  it("senha acima de 72 caracteres responde 400 sem tocar no banco", async () => {
    const res = await login(post({ email: "ana@teste.com", password: "A".repeat(200) }));
    expect(res.status).toBe(400);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("senha multibyte acima de 72 BYTES responde 401 sem tocar no banco", async () => {
    // 40 caracteres / 80 bytes: passa em qualquer teto contado em caracteres
    // e ainda assim e o caso que o bcrypt trunca em silencio.
    const multibyte = "é".repeat(40);
    userFindUnique.mockResolvedValue({ id: "usr_1", email: "ana@teste.com", name: "Ana", passwordHash: "$2a$04$x" });
    const res = await login(post({ email: "ana@teste.com", password: multibyte }));
    expect(res.status).toBe(401);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("a mensagem nao distingue e-mail inexistente de senha errada", async () => {
    userFindUnique.mockResolvedValue(null);
    const semConta = await login(post({ email: "ninguem@teste.com", password: "errada-123" }));
    const msgSemConta = (await semConta.json()).error as string;

    userFindUnique.mockResolvedValue({ id: "usr_1", email: "ana@teste.com", name: "Ana", passwordHash: "$2a$04$invalido" });
    const comConta = await login(post({ email: "ana@teste.com", password: "errada-123" }));
    const msgComConta = (await comConta.json()).error as string;

    expect(semConta.status).toBe(401);
    expect(comConta.status).toBe(401);
    expect(msgSemConta).toBe(msgComConta);
  });
});

describe("POST /api/auth/register", () => {
  it("senha abaixo de 10 caracteres responde 400", async () => {
    const res = await register(post({ name: "Ana", email: "ana@teste.com", password: "curta123" }));
    expect(res.status).toBe(400);
  });

  it("senha multibyte acima de 72 BYTES responde 400 citando bytes", async () => {
    const res = await register(post({ name: "Ana", email: "ana@teste.com", password: "é".repeat(40) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error as string).toMatch(/72 bytes/);
  });

  it("email invalido responde 400", async () => {
    const res = await register(post({ name: "Ana", email: "nao-e-email", password: "senha-bem-longa" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/livekit/token", () => {
  const trancada = { id: "abc", passwordHash: "$2a$04$hash", isLocked: true, creatorId: "outro" };
  const aberta = { id: "abc", passwordHash: null, isLocked: false, creatorId: null };

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

describe("GET /api/rooms — a claim userId nunca pode faltar", () => {
  it("token forjado sem userId responde 401 e nao devolve salas", async () => {
    // Fecho da cadeia: `where: { creatorId: undefined }` no Prisma significa
    // "remover o filtro" e devolvia TODAS as salas do sistema.
    cookieValue = await new SignJWT({ email: "x@y.com", name: "X" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(SECRET);

    const res = await listRooms(get("/api/rooms"));
    expect(res.status).toBe(401);
    expect((await res.json()).rooms).toBeUndefined();
    expect(roomFindMany).not.toHaveBeenCalled();
  });

  it("sessao valida filtra as salas pelo proprio creatorId", async () => {
    roomFindMany.mockResolvedValue([{ id: "abc", title: "Sala", isLocked: false, createdAt: new Date() }]);
    cookieValue = await signToken({ userId: "usr_1", email: "a@b.com", name: "A" });

    const res = await listRooms(get("/api/rooms"));
    expect(res.status).toBe(200);
    expect((await res.json()).rooms as unknown[]).toHaveLength(1);
    expect(roomFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorId: "usr_1" } })
    );
  });
});
