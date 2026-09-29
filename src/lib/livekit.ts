import { AccessToken } from "livekit-server-sdk";

export interface TokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  isHost?: boolean;
}

export async function createLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
  isHost = false,
}: TokenOptions): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY || "myscreen_livekit_key";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "myscreen_livekit_secret_token_change_in_production";

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "24h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    roomAdmin: isHost,
  });

  return await at.toJwt();
}
