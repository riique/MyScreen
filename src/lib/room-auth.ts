import { TokenVerifier } from "livekit-server-sdk";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/validate";

export interface RoomCaller {
  room: string;
  identity: string;
  name: string;
}

/**
 * Quem está numa sala prova isso com o próprio token do SFU (`Authorization:
 * Bearer <jwt>`): este servidor o assinou, e ele só sai depois da senha da
 * sala. Assim o histórico de uma sala trancada não vaza para quem só sabe o
 * código, e a autoria de uma mensagem vem do token, não do corpo do pedido.
 */
export async function requireRoomCaller(req: Request, roomId?: string): Promise<RoomCaller> {
  const header = req.headers.get("authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!jwt || jwt.length > 4096) throw new HttpError(401, "Entre na sala para fazer isso.");

  let claims;
  try {
    claims = await new TokenVerifier(env.livekitApiKey, env.livekitApiSecret).verify(jwt);
  } catch {
    throw new HttpError(401, "Sessão da sala expirada. Entre de novo.");
  }
  const room = claims.video?.room;
  const identity = claims.sub;
  if (!room || !identity || claims.video?.roomJoin !== true) {
    throw new HttpError(401, "Entre na sala para fazer isso.");
  }
  if (roomId !== undefined && room !== roomId) {
    throw new HttpError(403, "Esse token é de outra sala.");
  }
  return { room, identity, name: typeof claims.name === "string" && claims.name ? claims.name : identity };
}
