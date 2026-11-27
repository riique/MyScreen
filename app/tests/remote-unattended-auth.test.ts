import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createUnattendedCredential,
  isProof,
  isSalt,
  isUnattendedCredential,
  proveUnattendedChallenge,
  unattendedChallengeMessage,
  verifyUnattendedProof,
} from "@shared/remote/unattendedAuth";

const REQ = "AAECAwQFBgcICQoLDA0ODw";
const NONCE = "EBESExQVFhcYGRobHB0eHw";

describe("unattendedAuth (desafio-resposta)", () => {
  it("gera credencial válida e prova verificada tanto via Web Crypto quanto via Node HMAC", async () => {
    const cred = await createUnattendedCredential("senha-super-segura");
    expect(isSalt(cred.salt)).toBe(true);
    expect(isProof(cred.key)).toBe(true);
    expect(isUnattendedCredential(cred)).toBe(true);

    const proof = await proveUnattendedChallenge("senha-super-segura", cred.salt, REQ, NONCE);
    expect(isProof(proof)).toBe(true);
    expect(await verifyUnattendedProof(cred.key, REQ, NONCE, proof)).toBe(true);

    // Interoperabilidade com o caminho síncrono do processo principal (`node:crypto`).
    const expected = createHmac("sha256", Buffer.from(cred.key, "base64url"))
      .update(unattendedChallengeMessage(REQ, NONCE))
      .digest();
    const given = Buffer.from(proof, "base64url");
    expect(given.length).toBe(expected.length);
    expect(timingSafeEqual(given, expected)).toBe(true);
  });

  it("rejeita senha errada, nonce diferente ou reqId diferente", async () => {
    const cred = await createUnattendedCredential("minha-senha-123");
    const validProof = await proveUnattendedChallenge("minha-senha-123", cred.salt, REQ, NONCE);
    const wrongPwProof = await proveUnattendedChallenge("outra-senha-123", cred.salt, REQ, NONCE);

    expect(await verifyUnattendedProof(cred.key, REQ, NONCE, wrongPwProof)).toBe(false);
    expect(await verifyUnattendedProof(cred.key, REQ, REQ, validProof)).toBe(false);
    expect(await verifyUnattendedProof(cred.key, NONCE, NONCE, validProof)).toBe(false);
    expect(await verifyUnattendedProof(cred.key, REQ, NONCE, "curto")).toBe(false);
  });

  it("valida estrutura de credenciais armazenadas", () => {
    expect(isUnattendedCredential(null)).toBe(false);
    expect(isUnattendedCredential({ salt: "curto", key: "A".repeat(43) })).toBe(false);
    expect(isUnattendedCredential({ salt: REQ, key: "curto" })).toBe(false);
    expect(isUnattendedCredential({ salt: REQ, key: "A".repeat(43) })).toBe(true);
  });
});
