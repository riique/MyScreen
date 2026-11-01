import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AccessToken } from "livekit-server-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMessage, deleteMessage, listMessages, readChatFile, saveChatFile } from "@/lib/chat-store";
import { requireRoomCaller } from "@/lib/room-auth";
import { saveSound, soundFileNameFrom } from "@/lib/sounds";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "myscreen-chat-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const base = { timestamp: 1, attributes: {}, fromName: "Ana" };

describe("chat por sala", () => {
  it("guarda, lê de volta e não duplica pelo id", async () => {
    await appendMessage("sala-a", { ...base, id: "m1", message: "oi", fromIdentity: "ana-1", fileIds: [] }, dir);
    const again = await appendMessage("sala-a", { ...base, id: "m1", message: "oi", fromIdentity: "ana-1", fileIds: [] }, dir);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(await listMessages("sala-a", dir)).toHaveLength(1);
    expect(await listMessages("sala-b", dir)).toEqual([]);
  });

  it("anexo de qualquer tipo, só de quem o enviou", async () => {
    const f = await saveChatFile("sala-a", "ana-1", { name: "x.exe", type: "", bytes: new Uint8Array([1, 2]) }, dir);
    expect(f.type).toBe("application/octet-stream");
    const theft = await appendMessage("sala-a", { ...base, id: "m2", message: "", fromIdentity: "bob-2", fileIds: [f.id] }, dir);
    expect(theft.ok).toBe(false);
    const ok = await appendMessage("sala-a", { ...base, id: "m3", message: "", fromIdentity: "ana-1", fileIds: [f.id] }, dir);
    expect(ok.ok).toBe(true);
    expect((await readChatFile("sala-a", f.id, dir))?.bytes.length).toBe(2);
    // O id do arquivo não abre a mesma pasta por outra sala.
    expect(await readChatFile("sala-b", f.id, dir)).toBeNull();
  });
});

describe("apagar mensagem", () => {
  it("só o autor apaga, e o anexo sai do disco", async () => {
    const f = await saveChatFile("sala-a", "ana-1", { name: "a.txt", type: "text/plain", bytes: new Uint8Array([1]) }, dir);
    await appendMessage("sala-a", { ...base, id: "m1", message: "", fromIdentity: "ana-1", fileIds: [f.id] }, dir);
    expect(await deleteMessage("sala-a", "m1", "bob-2", dir)).toBe("forbidden");
    expect(await listMessages("sala-a", dir)).toHaveLength(1);
    expect(await deleteMessage("sala-a", "m1", "ana-1", dir)).toBe("deleted");
    expect(await listMessages("sala-a", dir)).toEqual([]);
    expect(await readChatFile("sala-a", f.id, dir)).toBeNull();
  });
});

describe("áudios enviados", () => {
  it("limpa o nome e não sobrescreve", async () => {
    expect(soundFileNameFrom("C:\\pasta\\Risada?.MP3")).toBe("Risada.mp3");
    expect(soundFileNameFrom("virus.exe")).toBeNull();
    const a = await saveSound("Risada.mp3", new Uint8Array([1]), dir);
    const b = await saveSound("Risada.mp3", new Uint8Array([2]), dir);
    expect([a.id, b.id]).toEqual(["Risada.mp3", "Risada (2).mp3"]);
  });
});

describe("requireRoomCaller", () => {
  async function tokenFor(room: string) {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: "ana-1", name: "Ana" });
    at.addGrant({ roomJoin: true, room });
    return at.toJwt();
  }
  const req = (jwt?: string) => new Request("http://x", { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });

  it("aceita o token da própria sala e recusa o resto", async () => {
    const jwt = await tokenFor("sala-a");
    await expect(requireRoomCaller(req(jwt), "sala-a")).resolves.toMatchObject({ identity: "ana-1", name: "Ana" });
    await expect(requireRoomCaller(req(jwt), "sala-b")).rejects.toMatchObject({ status: 403 });
    await expect(requireRoomCaller(req())).rejects.toMatchObject({ status: 401 });
    await expect(requireRoomCaller(req(jwt + "x"))).rejects.toMatchObject({ status: 401 });
  });
});
