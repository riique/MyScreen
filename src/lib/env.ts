/**
 * Configuracao de ambiente — falha no boot, nunca degrada.
 *
 * Server-only.
 *
 * A validacao e **preguicosa de proposito**. Este modulo e importado por
 * `auth.ts` e `livekit.ts`, alcancados pelos route handlers; o `next build` os
 * carrega no passo "Collecting page data" para colher a configuracao das rotas.
 * Se a validacao rodasse no import, o build quebraria em qualquer ambiente sem
 * os segredos — e no Docker e exatamente isso: o `.dockerignore` exclui o `.env`
 * e o stage `builder` so tem `DATABASE_URL`. O servico nunca subiria.
 *
 * O que mantem a garantia de fail-closed e o `/api/health`, que verifica o
 * ambiente e o banco: com config invalida ele responde 503, o container fica
 * `unhealthy` e o `depends_on: service_healthy` do Caddy nunca publica trafego
 * para um app quebrado. Nada degrada em silencio.
 *
 * O padrao proibido aqui e `process.env.X || "<literal>"`: o Compose injeta
 * string vazia quando a variavel nao existe no shell, e `"" || "literal"` cai
 * no literal — o segredo commitado no git vira a chave real de producao.
 */

const MIN_LENGTHS: Record<string, number> = {
  LIVEKIT_API_KEY: 8,
  LIVEKIT_API_SECRET: 32,
  LIVEKIT_URL: 8,
  DATABASE_URL: 8,
};

function required(key: string): string {
  const minLength = MIN_LENGTHS[key];
  const value = process.env[key];
  if (!value || value.trim().length < minLength) {
    throw new Error(
      `Configuracao invalida: ${key} ausente ou com menos de ${minLength} caracteres. ` +
        `Defina a variavel antes de iniciar o servidor.`
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : fallback;
}

// Memoizado por variavel: o `TextEncoder` e a validacao so rodam uma vez,
// mesmo com leitura concorrente de varias requisicoes.
const cache = new Map<string, string>();

function memoized(key: string): string {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = required(key);
  cache.set(key, value);
  return value;
}

export const env = {
  get livekitApiKey(): string {
    return memoized("LIVEKIT_API_KEY");
  },

  get livekitApiSecret(): string {
    return memoized("LIVEKIT_API_SECRET");
  },

  /** URL do SFU vista pelo servidor (rede interna do Docker). */
  get livekitUrl(): string {
    return memoized("LIVEKIT_URL");
  },

  get databaseUrl(): string {
    return memoized("DATABASE_URL");
  },

  /** URL do SFU vista pelo navegador (wss:// em producao). */
  get publicLiveKitUrl(): string {
    return optional(
      "NEXT_PUBLIC_LIVEKIT_URL",
      process.env.DOMAIN ? `wss://${process.env.DOMAIN}` : "ws://localhost:7880"
    );
  },

  get domain(): string {
    return optional("DOMAIN", "localhost");
  },

  /**
   * Verifica todas as variaveis de uma vez, sem lancar. Usado pelo
   * `/api/health` para decide se o container pode receber trafego.
   */
  check(): { ok: true } | { ok: false; missing: string[] } {
    const missing = Object.keys(MIN_LENGTHS).filter(
      (key) => !process.env[key] || process.env[key].trim().length < MIN_LENGTHS[key]
    );
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
  },
} as const;
