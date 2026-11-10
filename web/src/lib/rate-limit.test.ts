import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/validate";

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function req(ip: string) {
  return new Request("http://x/api", { headers: { "x-forwarded-for": `${ip}, 10.0.0.9` } });
}

describe("rateLimit — janela fixa", () => {
  it("libera ate `limit` e bloqueia o_request seguinte", () => {
    const key = "teste-a";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000)).toBe(true);
    }
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("zera quando a janela expira", () => {
    vi.useFakeTimers();
    const key = "teste-b";
    expect(rateLimit(key, 1, 1_000)).toBe(true);
    expect(rateLimit(key, 1, 1_000)).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 1, 1_000)).toBe(true);
  });

  it("janelas de chaves diferentes nao se interferem", () => {
    expect(rateLimit("teste-c", 1, 60_000)).toBe(true);
    expect(rateLimit("teste-d", 1, 60_000)).toBe(true);
    expect(rateLimit("teste-c", 1, 60_000)).toBe(false);
  });
});

describe("enforceRateLimit", () => {
  it("agrupa por escopo + IP: um abusive nao derruba o vizinho", () => {
    for (let i = 0; i < 2; i++) {
      expect(() => enforceRateLimit(req("1.1.1.1"), "login", 2, 60_000)).not.toThrow();
    }
    expect(() => enforceRateLimit(req("1.1.1.1"), "login", 2, 60_000)).toThrow(HttpError);
    // Outro IP, mesmo escopo: passa.
    expect(() => enforceRateLimit(req("2.2.2.2"), "login", 2, 60_000)).not.toThrow();
  });

  it("o limite e por escopo: estourar `login` nao afeta `register`", () => {
    for (let i = 0; i < 2; i++) {
      expect(() => enforceRateLimit(req("3.3.3.3"), "login", 2, 60_000)).not.toThrow();
    }
    expect(() => enforceRateLimit(req("3.3.3.3"), "login", 2, 60_000)).toThrow(HttpError);
    expect(() => enforceRateLimit(req("3.3.3.3"), "register", 2, 60_000)).not.toThrow();
  });

  it("usa o PRIMEIRO X-Forwarded-For, nao o header cru", () => {
    // Atras do Caddy o header vem preenchido; sem confianca no proxy ele e so
    // palpite, entao o primeiro hop e o que separa os clientes.
    for (let i = 0; i < 2; i++) {
      enforceRateLimit(req("4.4.4.4"), "verifica", 2, 60_000);
    }
    expect(() => enforceRateLimit(req("4.4.4.4"), "verifica", 2, 60_000)).toThrow(HttpError);
    // Mesmo IP real, spoofado no segundo hop: continua bloqueado.
    expect(() =>
      enforceRateLimit(req("4.4.4.4"), "verifica", 2, 60_000)
    ).toThrow(HttpError);
  });

  it("lanca 429 com mensagem, nao um erro generico", () => {
    enforceRateLimit(req("5.5.5.5"), "msg", 1, 60_000);
    try {
      enforceRateLimit(req("5.5.5.5"), "msg", 1, 60_000);
      throw new Error("deveria ter lancado");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(429);
      expect((e as HttpError).message).toMatch(/Muitas tentativas/i);
    }
  });

  it("sem header de IP, cai em 'unknown' (compartilhado, mas nunca infinito)", () => {
    const semIp = new Request("http://x/api");
    expect(() => enforceRateLimit(semIp, "semip", 1, 60_000)).not.toThrow();
    expect(() => enforceRateLimit(semIp, "semip", 1, 60_000)).toThrow(HttpError);
  });
});
