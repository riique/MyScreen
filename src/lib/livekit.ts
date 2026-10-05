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
  });

  return await at.toJwt();
}
