import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AccessToken } from "livekit-server-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listChat, POST as appendChat } from "@/app/api/rooms/[id]/chat/route";
import { DELETE as deleteChat } from "@/app/api/rooms/[id]/chat/[messageId]/route";
import { POST as uploadChatFile } from "@/app/api/rooms/[id]/chat/files/route";
import { GET as getChatFile } from "@/app/api/rooms/[id]/chat/files/[fileId]/route";
import { GET as listSounds, POST as uploadSound } from "@/app/api/sounds/route";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "myscreen-api-"));
  process.env.CHAT_DIR = path.join(dir, "chat");
  process.env.SOUNDS_DIR = path.join(dir, "sounds");
});
afterAll(async () => {
  delete process.env.CHAT_DIR;
  delete process.env.SOUNDS_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function tokenFor(room: string, identity: string) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, name: identity });
  at.addGrant({ roomJoin: true, room });
  return at.toJwt();
}

let ip = 0;
function req(url: string, jwt: string, init: RequestInit = {}) {
  ip += 1;
  return new Request(`http://x${url}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${jwt}`, "x-forwarded-for": `10.9.0.${ip}` },
  });
}
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) });

describe("API do chat e dos áudios", () => {
  it("anexo, mensagem, histórico, download e apagar", async () => {
    const ana = await tokenFor("sala1", "ana");
    const bob = await tokenFor("sala1", "bob");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([7, 7, 7])], { type: "application/x-msdownload" }), "setup.exe");
    const up = await uploadChatFile(req("/api/rooms/sala1/chat/files", ana, { method: "POST", body: form }), ctx({ id: "sala1" }));
    expect(up.status).toBe(201);
    const { file } = await up.json();

    const post = await appendChat(
      req("/api/rooms/sala1/chat", ana, {
        method: "POST",
        body: JSON.stringify({ id: "msg-1", timestamp: Date.now(), message: "olha", fileIds: [file.id] }),
      }),
      ctx({ id: "sala1" })
    );
    expect(post.status).toBe(201);

    const hist = await (await listChat(req("/api/rooms/sala1/chat", bob), ctx({ id: "sala1" }))).json();
    expect(hist.messages).toHaveLength(1);
    expect(hist.messages[0]).toMatchObject({ fromIdentity: "ana", message: "olha", files: [{ name: "setup.exe", size: 3 }] });

    const other = await tokenFor("sala2", "eve");
    expect((await listChat(req("/api/rooms/sala1/chat", other), ctx({ id: "sala1" }))).status).toBe(403);

    const dl = await getChatFile(req("/x", bob), ctx({ id: "sala1", fileId: file.id }));
    expect(dl.status).toBe(200);
    expect(new Uint8Array(await dl.arrayBuffer())).toEqual(new Uint8Array([7, 7, 7]));

    expect((await deleteChat(req("/x", bob, { method: "DELETE" }), ctx({ id: "sala1", messageId: "msg-1" }))).status).toBe(403);
    expect((await deleteChat(req("/x", ana, { method: "DELETE" }), ctx({ id: "sala1", messageId: "msg-1" }))).status).toBe(204);
    const after = await (await listChat(req("/api/rooms/sala1/chat", bob), ctx({ id: "sala1" }))).json();
    expect(after.messages).toEqual([]);
  });

  it("qualquer um na sala manda áudio; quem não está, não", async () => {
    const form = () => {
      const f = new FormData();
      f.append("file", new Blob([new Uint8Array([1, 2, 3])]), "Buzina.mp3");
      return f;
    };
    const noToken = new Request("http://x/api/sounds", { method: "POST", body: form(), headers: { "x-forwarded-for": "10.9.1.1" } });
    expect((await uploadSound(noToken)).status).toBe(401);

    const jwt = await tokenFor("qualquer", "zé");
    const res = await uploadSound(req("/api/sounds", jwt, { method: "POST", body: form() }));
    expect(res.status).toBe(201);
    const list = await (await listSounds(req("/api/sounds", jwt))).json();
    expect(list.sounds.map((s: { id: string }) => s.id)).toEqual(["Buzina.mp3"]);
  });
});
