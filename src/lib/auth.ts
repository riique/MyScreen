import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/validate";


export interface UserSession {
  userId: string;
  email: string;
  name: string;
}

/**
 * Semáforo da KDF (bcrypt).
 *
 * `bcryptjs` é JavaScript puro e roda no ÚNICO event loop do processo Node.
 * Um custo 12 ocupa um core inteiro por ~1-2 s, cedendo o loop a cada 100 ms de
 * trabalho. Sem este limite, um punhado de requisições não autenticadas
 * (`POST /api/rooms` aceita `password` e hasheia; rate limit por IP não é teto
 * quando o atacante tem vários IPs) derruba TODAS as rotas, inclusive
 * `/api/health` — o container fica unhealthy e o Caddy corta o tráfego.
 *
 * O limite é de concorrência, não de taxa: é o que de fato protege o event loop.
 */
const MAX_CONCURRENT_KDF = 2;
const KDF_QUEUE_MAX = 32;

let kdfActive = 0;
const kdfWaiters: (() => void)[] = [];

function acquireKdf(): Promise<void> {
  if (kdfActive < MAX_CONCURRENT_KDF) {
    kdfActive += 1;
    return Promise.resolve();
  }
  if (kdfWaiters.length >= KDF_QUEUE_MAX) {
    // Fila cheia: recusar é melhor do que aceitar e travar o processo todo.
    return Promise.reject(
      new HttpError(503, "Muitos acessos simultâneos. Tente em alguns instantes.")
    );
  }
  return new Promise<void>((resolve) => kdfWaiters.push(resolve));
}

function releaseKdf(): void {
  const next = kdfWaiters.shift();
  // Repassa o slot diretamente, sem decrementar: o waiter já ocupa a vaga.
  if (next) next();
  else kdfActive -= 1;
}

export async function hashPassword(password: string): Promise<string> {
  await acquireKdf();
  try {
    return await bcrypt.hash(password, 12);
  } finally {
    releaseKdf();
  }
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  await acquireKdf();
  try {
    return await bcrypt.compare(password, hash);
  } finally {
    releaseKdf();
  }
}

export async function signToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(env.jwtSecret);
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, env.jwtSecret);

    // Sem este guard, um token assinado sem a claim `userId` produz
    // `session.userId === undefined`, e o Prisma trata `undefined` como
    // "remover este filtro": `where: { creatorId: undefined }` devolve TODAS as
    // salas em GET /api/rooms — incluindo o id das protegidas por senha.
    if (typeof payload.userId !== "string" || payload.userId.length === 0) {
      return null;
    }

    return {
      userId: payload.userId,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "myscreen_token";

/** Atributos do cookie de sessao, centralizados para login e logout divergirem nunca. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};
