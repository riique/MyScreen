import { describe, expect, it } from "vitest";
import { chooseScreenCodec, type CodecProbe } from "../src/shared/codec";

const none = { supported: false, hardware: false };
const sw = { supported: true, hardware: false };
const hwOn = { supported: true, hardware: true };

function probe(p: Partial<CodecProbe>): CodecProbe {
  return { av1: none, vp9: sw, h264: sw, vp8: sw, ...p };
}

describe("chooseScreenCodec", () => {
  it("auto prefere AV1 por hardware, com H.264 de reserva quando ele também é por hardware", () => {
    const c = chooseScreenCodec("auto", probe({ av1: hwOn, h264: hwOn }));
    expect(c).toMatchObject({ codec: "av1", backup: "h264", hardware: true });
  });

  it("auto não usa AV1 em software", () => {
    expect(chooseScreenCodec("auto", probe({ av1: sw, h264: hwOn })).codec).toBe("h264");
  });

  it("auto cai em VP8 sem nenhum encoder por hardware", () => {
    expect(chooseScreenCodec("auto", probe({}))).toMatchObject({ codec: "vp8", backup: null });
  });

  it("hardware não medido (null) não conta como hardware", () => {
    expect(chooseScreenCodec("auto", probe({ av1: { supported: true, hardware: null } })).codec).toBe("vp8");
  });

  it("escolha manual de SVC leva reserva VP8 quando H.264 é software", () => {
    expect(chooseScreenCodec("vp9", probe({}))).toMatchObject({ codec: "vp9", backup: "vp8" });
  });

  it("escolha manual sem suporte cai em VP8 e diz por quê", () => {
    const c = chooseScreenCodec("av1", probe({}));
    expect(c.codec).toBe("vp8");
    expect(c.reason).toMatch(/não codifica AV1/);
  });
});
