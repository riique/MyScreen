/**
 * Autenticação por desafio-resposta para o acesso direto (admin / não assistido).
 *
 * A senha nunca trafega pela rede nem é guardada em texto puro: o PC controlado
 * guarda apenas `{ salt, key }` derivado com PBKDF2-HMAC-SHA256, e cada pedido
 * de acesso direto gera um `nonce` único que quem controla assina com HMAC-SHA256.
 *
 * Módulo puro (Web Crypto): roda igual no processo principal, no renderer e nos testes.
 */

export const UNATTENDED_PASSWORD_MIN = 6;
export const UNATTENDED_PASSWORD_MAX = 128;
export const UNATTENDED_PBKDF2_ITERATIONS = 120_000;
export const UNATTENDED_DOMAIN = "myscreen.rc.unattended.v1";

/** 16 bytes em base64url (22 caracteres). */
const SALT_RE = /^[A-Za-z0-9_-]{22}$/;
/** 32 bytes em base64url (43 caracteres). */
const PROOF_RE = /^[A-Za-z0-9_-]{43}$/;

export interface UnattendedCredential {
  salt: string;
  key: string;
}

export function isSalt(v: unknown): v is string {
  return typeof v === "string" && SALT_RE.test(v);
}

export function isProof(v: unknown): v is string {
  return typeof v === "string" && PROOF_RE.test(v);
}

export function isUnattendedCredential(v: unknown): v is UnattendedCredential {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return isSalt(o.salt) && isProof(o.key);
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const pad = (4 - (text.length % 4)) % 4;
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function unattendedChallengeMessage(reqId: string, nonce: string): string {
  return `${UNATTENDED_DOMAIN}\n${reqId}\n${nonce}`;
}

/** Deriva a chave de 256 bits a partir da senha e do salt (base64url). */
export async function deriveUnattendedKey(password: string, salt: string): Promise<string> {
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: decodeBase64Url(salt),
      iterations: UNATTENDED_PBKDF2_ITERATIONS,
    },
    baseKey,
    256,
  );
  return encodeBase64Url(new Uint8Array(bits));
}

/** Cria a credencial para guardar no PC controlado (salt aleatório + chave derivada). */
export async function createUnattendedCredential(password: string): Promise<UnattendedCredential> {
  const saltBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(saltBytes);
  const salt = encodeBase64Url(saltBytes);
  const key = await deriveUnattendedKey(password, salt);
  return { salt, key };
}

/** Assina o desafio `(reqId, nonce)` com a chave derivada (32 bytes em base64url). */
export async function signUnattendedChallenge(keyB64: string, reqId: string, nonce: string): Promise<string> {
  const hmacKey = await globalThis.crypto.subtle.importKey(
    "raw",
    decodeBase64Url(keyB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(unattendedChallengeMessage(reqId, nonce)),
  );
  return encodeBase64Url(new Uint8Array(sig));
}

/** Lado de quem pede acesso direto: deriva a chave da senha e assina o desafio. */
export async function proveUnattendedChallenge(
  password: string,
  salt: string,
  reqId: string,
  nonce: string,
): Promise<string> {
  const key = await deriveUnattendedKey(password, salt);
  return signUnattendedChallenge(key, reqId, nonce);
}

/** Comparação em tempo constante de duas provas em base64url. */
export async function verifyUnattendedProof(
  keyB64: string,
  reqId: string,
  nonce: string,
  proof: string,
): Promise<boolean> {
  if (!isProof(proof) || !isProof(keyB64)) return false;
  const expected = await signUnattendedChallenge(keyB64, reqId, nonce);
  const a = decodeBase64Url(expected);
  const b = decodeBase64Url(proof);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
