import { HttpError } from "@/lib/validate";

/**
 * Rate limit em memoria, por janela fixa.
 *
 * Suficiente para uma instancia. Em producao com mais de um container este
 * mapa nao e compartilhado e o limite vira por-processo — nesse caso troque
 * por Redis. Ainda assim resolve a grande maioria do abuso (forca bruta de
 * senha, enumeracao de salas).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Evita crescimento infinito do Map: remove janela expirada a cada limpeza. */
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

/** Retorna `true` se a requisicao passa. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/**
 * IP do cliente. Atrás do Caddy o header vem preenchido por `header_up`;
 * sem confianca no proxy, `x-forwarded-for` e so um palpite de cliente.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Aplica um limite por IP. Lanca `HttpError(429)` quando estoura, para que o
 * `withErrorHandling` da rota converta na resposta padrao.
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): void {
  if (rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs)) return;
  throw new HttpError(
    429,
    "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  );
}
