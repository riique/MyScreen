import { describe, it, expect } from "vitest";
import { HttpError, str, EMAIL_PATTERN } from "@/lib/validate";
import { MAX_ROOM_ID_LENGTH, generateRoomId, normalizeRoomId } from "@/lib/utils";

describe("str — validacao de entrada", () => {
  it("devolve o valor aparado", () => {
    expect(str({ nome: "  Ana  " }, "nome", { max: 10 })).toBe("Ana");
  });

  it("campo ausente e 400, nao 500", () => {
    // `undefined` no Prisma e "remover o filtro". Um handler que devolve 500
    // nesse caso esconde o bug; a excecao tipada garante 400.
    expect(() => str({}, "email", { max: 10 })).toThrow(HttpError);
    try {
      str({}, "email", { max: 10 });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
    }
  });

  it("tipo errado e 400, com o campo nomeado", () => {
    // `{email: 123}` virava 500 antes da validacao existir.
    for (const value of [123, true, null, {}, [], () => {}]) {
      try {
        str({ email: value }, "email", { max: 10 });
        throw new Error("deveria ter lancado");
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        expect((e as HttpError).status).toBe(400);
        expect((e as HttpError).field).toBe("email");
      }
    }
  });

  it("acima do teto e 400", () => {
    expect(() => str({ titulo: "x".repeat(11) }, "titulo", { max: 10 })).toThrow(HttpError);
  });

  it("abaixo do minimo e 400", () => {
    expect(() => str({ senha: "curta" }, "senha", { min: 10, max: 72 })).toThrow(HttpError);
  });

  it("string so com espacos viola o minimo, porque e aparada antes", () => {
    // Sem o trim, "   " passaria como senha de 6 caracteres.
    expect(() => str({ senha: "      " }, "senha", { min: 6, max: 72 })).toThrow(HttpError);
  });

  it("pattern rejeita formato invalido", () => {
    expect(() => str({ email: "nao-e-email" }, "email", { max: 254, pattern: EMAIL_PATTERN })).toThrow(HttpError);
    expect(str({ email: "ana@teste.com" }, "email", { max: 254, pattern: EMAIL_PATTERN })).toBe("ana@teste.com");
  });
});

describe("normalizeRoomId", () => {
  it("normaliza para minusculo e sem espacas nas pontas", () => {
    expect(normalizeRoomId("  ABC-DEF  ")).toBe("abc-def");
  });

  it("aplica o teto — o id vem de um segmento de path", () => {
    const longo = "a".repeat(MAX_ROOM_ID_LENGTH + 500);
    expect(normalizeRoomId(longo)).toHaveLength(MAX_ROOM_ID_LENGTH);
  });

  it("nao altera um id dentro do limite", () => {
    expect(normalizeRoomId("abc-def-ghi")).toBe("abc-def-ghi");
  });
});

describe("generateRoomId", () => {
  it("gera apenas letras minusculas do alphabet", () => {
    expect(generateRoomId()).toMatch(/^[a-z]{9}$/);
  });

  it("respeita o comprimento pedido", () => {
    expect(generateRoomId(20)).toHaveLength(20);
  });

  it("nao repete (sanidade do CSPRNG, nao prova criptografica)", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateRoomId()));
    expect(ids.size).toBe(500);
  });
});
