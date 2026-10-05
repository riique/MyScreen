import bcrypt from "bcryptjs";
import { HttpError } from "@/lib/validate";

/**
 * O MyScreen não tem contas. O que resta de "auth" é a senha opcional de
 * sala: hash no momento da criação e comparação na emissão do token do SFU.
 */

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

/**
 * Limite do bcrypt: 72 BYTES, nao 72 caracteres.
 *
 * Acima disso o hash TRUNCA EM SILENCIO (`bcryptjs` documenta em
 * `truncates()`), o que significa que "A"*72 e "A"*72 + qualquer sufixo
 * comparam como iguais: quem conhece os 72 primeiros bytes da senha da vitima
 * autentica com qualquer resto, e o servidor responde 200 emitindo cookie.
 *
 * Centralizado porque a contagem correta e em BYTES. Um `max: 72` em
 * caracteres deixa passar senha multibyte que estoura o limite no encode
 * UTF-8 — 24 "e" acentuados tem 24 caracteres e 46 bytes; 36 tem 36 e 69;
 * 40 tem 40 e 76. E o numero de bytes, nao o de caracteres, que o bcrypt
 * trunca.
 */
export const BCRYPT_MAX_BYTES = 72;

/** `true` se a senha estoura o limite do bcrypt. Rejeitar no request e sempre
 *  melhor do que truncar: truncar aceita, rejeitar nao. */
export function exceedsBcryptLimit(password: string): boolean {
  return Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES;
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
