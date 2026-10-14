import { createHmac, timingSafeEqual } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { env } from "@/lib/env";

export interface TokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName: string;
}

export async function createLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
}: TokenOptions): Promise<string> {
  const at = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity: participantIdentity,
    name: participantName,
    // 6h em vez de 24h: com o refresh no cliente em vigor, o pior caso de
    // "morreu no meio da call" fica limitado pela janela de renovacao.
    ttl: "6h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    // O app de Windows anuncia nos atributos que pode ser controlado
    // (`rc.v`, `rc.display`, `rc.by`). Efeito colateral: o participante pode
    // trocar o proprio nome — que ja e livre na entrada.
    canUpdateOwnMetadata: true,
  });

  return await at.toJwt();
}

/**
 * Prova de que ESTE servidor emitiu `identity` para `roomId`. Sem ela o
 * cliente nao reusa identidade: quem soubesse a identidade de alguem (todos na
 * sala veem) pediria um token com ela, o SFU derrubaria o dono e o atacante
 * entraria no lugar — com controle remoto, sequestraria a sessao de controle.
 */
export function identityProof(roomId: string, identity: string): string {
  return createHmac("sha256", env.livekitApiSecret).update(`${roomId}\n${identity}`).digest("base64url");
}

export function verifyIdentityProof(roomId: string, identity: string, proof: unknown): boolean {
  if (typeof proof !== "string" || proof.length === 0 || proof.length > 128) return false;
  const expected = Buffer.from(identityProof(roomId, identity));
  const given = Buffer.from(proof);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
