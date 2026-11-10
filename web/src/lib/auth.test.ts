import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  BCRYPT_MAX_BYTES,
  comparePassword,
  exceedsBcryptLimit,
} from "@/lib/auth";

describe("exceedsBcryptLimit — o limite e em BYTES, nao em caracteres", () => {
  it("aceita exatamente 72 bytes", () => {
    expect(exceedsBcryptLimit("A".repeat(BCRYPT_MAX_BYTES))).toBe(false);
  });

  it("rejeita 73 bytes", () => {
    expect(exceedsBcryptLimit("A".repeat(BCRYPT_MAX_BYTES + 1))).toBe(true);
  });

  it("rejeita senha curta em caracteres mas longa em bytes", () => {
    // 40 caracteres, 80 bytes: passa em qualquer `max: 72` contado em
    // caracteres e ainda assim estoura o limite que o bcrypt trunca.
    const multibyte = "é".repeat(40);
    expect(multibyte).toHaveLength(40);
    expect(Buffer.byteLength(multibyte, "utf8")).toBe(80);
    expect(exceedsBcryptLimit(multibyte)).toBe(true);
  });

  it("aceita 71 bytes multibyte", () => {
    // 23 x "é" (46 bytes) e 46 x "é" (92) estouram; 36 x "é" fecha em 72.
    expect(exceedsBcryptLimit("é".repeat(36))).toBe(false);
  });
});

describe("bcrypt trunca em silencio — razao de o guard existir", () => {
  // Nao e um teste do guard: e a prova de que o guard e necessario. Sem ele,
  // qualquer um que conhecesse os 72 primeiros bytes autenticaria com o resto
  // a vontade e o servidor responderia 200 emitindo cookie.
  it("senha + sufixo arbitrario compara como igual a senha sozinha", async () => {
    const base = "A".repeat(BCRYPT_MAX_BYTES);
    const hash = await bcrypt.hash(base, 4);
    expect(await comparePassword(`${base}SUFIXO-QUALQUER`, hash)).toBe(true);
  }, 20_000);

  it("senha diferente nos 72 primeiros bytes NAO autentica", async () => {
    const base = "A".repeat(BCRYPT_MAX_BYTES);
    const hash = await bcrypt.hash(base, 4);
    expect(await comparePassword(`B${"A".repeat(BCRYPT_MAX_BYTES - 1)}`, hash)).toBe(false);
  }, 20_000);
});
