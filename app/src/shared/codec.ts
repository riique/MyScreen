/**
 * Codec da tela: a escolha e o porquê. Puro, para teste; a sondagem do que a
 * máquina sabe fazer fica em renderer/lib/codecProbe.ts.
 *
 * O que muda na prática, com o mesmo orçamento de bits:
 * - AV1: ~30–40% mais eficiente que VP8/H.264 e tem ferramentas próprias para
 *   conteúdo de tela (texto nítido). Só vale com encoder por HARDWARE (RTX 40,
 *   Radeon RX 7000, Intel Arc/Core Ultra): em software, 1080p60 come a CPU que
 *   o jogo precisa.
 * - H.264 por hardware (NVENC, AMF, Quick Sync): qualidade parecida com VP8,
 *   mas quase sem custo de CPU — o melhor amigo de quem transmite jogo.
 * - VP9: melhor que VP8, porém quase sempre em software.
 * - VP8: o padrão do LiveKit, em software. Funciona em qualquer lugar.
 *
 * AV1 e VP9 saem com um codec reserva (H.264 ou VP8): se alguém na sala não
 * decodifica, o SFU pede o reserva e ninguém fica sem imagem.
 */

export type VideoCodecId = "av1" | "vp9" | "h264" | "vp8";
export type ScreenCodecPref = "auto" | VideoCodecId;

export const SCREEN_CODEC_PREFS: readonly ScreenCodecPref[] = ["auto", "av1", "vp9", "h264", "vp8"];

export const CODEC_LABEL: Record<VideoCodecId, string> = {
  av1: "AV1",
  vp9: "VP9",
  h264: "H.264",
  vp8: "VP8",
};

/** O que a máquina sabe codificar, por codec. `null` = não deu para medir. */
export type CodecProbe = Record<VideoCodecId, { supported: boolean; hardware: boolean | null }>;

export type CodecChoice = {
  codec: VideoCodecId;
  /** Codec reserva publicado para quem não decodifica o principal. */
  backup: "h264" | "vp8" | null;
  hardware: boolean | null;
  /** Uma linha, em pt-BR, dizendo por que este. */
  reason: string;
};

/** Codecs com camadas (SVC): precisam de reserva e de `scalabilityMode`. */
export function isSvcCodec(codec: VideoCodecId): boolean {
  return codec === "av1" || codec === "vp9";
}

function backupFor(codec: VideoCodecId, probe: CodecProbe): CodecChoice["backup"] {
  if (!isSvcCodec(codec)) return null;
  return probe.h264.supported && probe.h264.hardware ? "h264" : "vp8";
}

function hw(probe: CodecProbe, c: VideoCodecId): boolean {
  return probe[c].supported && probe[c].hardware === true;
}

export function chooseScreenCodec(pref: ScreenCodecPref, probe: CodecProbe): CodecChoice {
  if (pref !== "auto") {
    if (!probe[pref].supported) {
      return {
        codec: "vp8",
        backup: null,
        hardware: probe.vp8.hardware,
        reason: `Este computador não codifica ${CODEC_LABEL[pref]}; a tela vai em VP8.`,
      };
    }
    const where = probe[pref].hardware === true ? "por hardware" : probe[pref].hardware === false ? "em software (usa CPU)" : "";
    return {
      codec: pref,
      backup: backupFor(pref, probe),
      hardware: probe[pref].hardware,
      reason: `${CODEC_LABEL[pref]} escolhido por você${where ? `, ${where}` : ""}.`,
    };
  }
  if (hw(probe, "av1")) {
    return {
      codec: "av1",
      backup: backupFor("av1", probe),
      hardware: true,
      reason: "AV1 por hardware: mais nitidez com a mesma internet, sem pesar na CPU.",
    };
  }
  if (hw(probe, "h264")) {
    return {
      codec: "h264",
      backup: null,
      hardware: true,
      reason: "H.264 por hardware: a placa de vídeo codifica e a CPU fica livre para o jogo.",
    };
  }
  return {
    codec: "vp8",
    backup: null,
    hardware: probe.vp8.hardware,
    reason: "Sem encoder por hardware detectado: VP8, que funciona em qualquer lugar.",
  };
}
