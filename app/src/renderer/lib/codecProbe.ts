import type { CodecProbe, VideoCodecId } from "@shared/codec";

/**
 * Sonda o que este navegador/GPU codifica para WebRTC: a lista de codecs do
 * `RTCRtpSender` diz se existe; o `MediaCapabilities` (tipo "webrtc") diz se é
 * eficiente em energia — a forma que a web tem de dizer "por hardware". Sem
 * resposta, `hardware` fica `null` (não medido), nunca chutado.
 */

const MIME: Record<VideoCodecId, string> = {
  av1: "video/AV1",
  vp9: "video/VP9",
  h264: "video/H264",
  vp8: "video/VP8",
};

const cache = new Map<string, Promise<CodecProbe>>();

async function hardware(mime: string, width: number, height: number, framerate: number): Promise<boolean | null> {
  try {
    if (!("mediaCapabilities" in navigator)) return null;
    const info = await navigator.mediaCapabilities.encodingInfo({
      type: "webrtc",
      video: { contentType: mime, width, height, framerate, bitrate: 8_000_000 },
    } as MediaEncodingConfiguration);
    if (!info.supported) return false;
    return info.powerEfficient;
  } catch {
    return null;
  }
}

export function probeEncoders(width = 1920, height = 1080, framerate = 60): Promise<CodecProbe> {
  const key = `${width}x${height}@${framerate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const run = (async () => {
    const caps = (typeof RTCRtpSender !== "undefined" && RTCRtpSender.getCapabilities?.("video")?.codecs) || [];
    const has = (mime: string) => caps.some((c) => c.mimeType.toLowerCase() === mime.toLowerCase());
    const ids: VideoCodecId[] = ["av1", "vp9", "h264", "vp8"];
    const entries = await Promise.all(
      ids.map(async (id) => {
        const supported = has(MIME[id]);
        return [id, { supported, hardware: supported ? await hardware(MIME[id], width, height, framerate) : false }] as const;
      }),
    );
    return Object.fromEntries(entries) as CodecProbe;
  })();
  cache.set(key, run);
  return run;
}
