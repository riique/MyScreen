import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isSoundFileName, listSounds } from "@/lib/sounds";

describe("isSoundFileName", () => {
  it("aceita só nome simples com extensão de áudio", () => {
    expect(isSoundFileName("Risada 1.mp3")).toBe(true);
    expect(isSoundFileName("aplausos.OGG")).toBe(true);
    expect(isSoundFileName("../segredo.mp3")).toBe(false);
    expect(isSoundFileName("pasta/som.mp3")).toBe(false);
    expect(isSoundFileName("..\som.mp3")).toBe(false);
    expect(isSoundFileName(".oculto.mp3")).toBe(false);
    expect(isSoundFileName("script.js")).toBe(false);
    expect(isSoundFileName("")).toBe(false);
  });
});

describe("listSounds", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("lista os áudios em ordem, ignorando o resto", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "sounds-"));
    await writeFile(path.join(dir, "som 10.mp3"), "x");
    await writeFile(path.join(dir, "som 2.wav"), "xy");
    await writeFile(path.join(dir, "vazio.mp3"), "");
    await writeFile(path.join(dir, "notas.txt"), "x");
    await mkdir(path.join(dir, "pasta.mp3"));
    expect(await listSounds(dir)).toEqual([
      { id: "som 2.wav", name: "som 2", size: 2 },
      { id: "som 10.mp3", name: "som 10", size: 1 },
    ]);
  });

  it("pasta ausente é lista vazia", async () => {
    expect(await listSounds(path.join(os.tmpdir(), "nao-existe-myscreen-sounds"))).toEqual([]);
  });
});
