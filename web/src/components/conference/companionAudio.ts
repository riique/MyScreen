/**
 * Ponte com o app "MyScreen Áudio" (Windows).
 *
 * O Chrome no Windows não captura o som do sistema quando a saída padrão tem
 * mais de 2 canais (fone 7.1, por exemplo): o `getDisplayMedia` falha com
 * `NotReadableError`. O app captura o som pelo loopback do próprio Windows, já
 * em estéreo, e o entrega aqui por um WebSocket local. Esta página transforma
 * o PCM numa faixa de áudio e a publica como o áudio da tela.
 *
 * Protocolo: `ws://127.0.0.1:47810/?code=<código>`; cada mensagem binária é
 * PCM 16 bits, estéreo intercalado, 48 kHz (10 ms por mensagem). O app só
 * aceita a origem do MyScreen e o código de pareamento que ele mostra.
 */

const KEY = "myscreen:companion";
const URL_BASE = "ws://127.0.0.1:47810/";
const SAMPLE_RATE = 48_000;

export type CompanionPrefs = { enabled: boolean; code: string };

export function readCompanion(): CompanionPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<CompanionPrefs> | null;
    if (v && typeof v.enabled === "boolean" && typeof v.code === "string") {
      return { enabled: v.enabled, code: v.code };
    }
  } catch {
    // Valor corrompido: volta ao padrão.
  }
  return { enabled: false, code: "" };
}

export function writeCompanion(prefs: CompanionPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Modo privado não pode impedir alguém de compartilhar.
  }
}

/**
 * Buffer circular no thread de áudio. Acumula ~50 ms antes de tocar; se a
 * rede local atrasar e o buffer passar de ~200 ms, descarta o excesso para o
 * som não ficar cada vez mais atrasado em relação à tela.
 */
const WORKLET = `
const TARGET = 2400, MAX = 9600, CAP = 48000;
class MyScreenPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.l = new Float32Array(CAP); this.r = new Float32Array(CAP);
    this.w = 0; this.rd = 0; this.playing = false;
    this.port.onmessage = (e) => {
      const s = new Int16Array(e.data);
      for (let i = 0; i + 1 < s.length; i += 2) {
        const k = this.w % CAP;
        this.l[k] = s[i] / 32768; this.r[k] = s[i + 1] / 32768; this.w++;
      }
      if (this.w - this.rd > MAX) this.rd = this.w - TARGET;
    };
  }
  process(_inputs, outputs) {
    const L = outputs[0][0], R = outputs[0][1] || L, n = L.length;
    const avail = this.w - this.rd;
    if (!this.playing && avail >= TARGET) this.playing = true;
    if (!this.playing || avail < n) {
      this.playing = false; L.fill(0); R.fill(0); return true;
    }
    for (let i = 0; i < n; i++) {
      const k = this.rd % CAP; L[i] = this.l[k]; R[i] = this.r[k]; this.rd++;
    }
    return true;
  }
}
registerProcessor("myscreen-pcm", MyScreenPcm);
`;

export type CompanionAudio = {
  track: MediaStreamTrack;
  close: () => void;
};

/**
 * Conecta ao app e devolve uma faixa de áudio pronta para publicar. Rejeita se
 * o app não estiver aberto ou o código não bater (o app recusa o handshake).
 * `onLost` é chamado se a conexão cair depois de aberta.
 */
export async function openCompanionAudio(
  code: string,
  onLost: () => void,
): Promise<CompanionAudio> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
  let ws: WebSocket | null = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    ws?.close();
    void ctx.close();
  };

  try {
    const blobUrl = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    try {
      await ctx.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    await ctx.resume();

    const node = new AudioWorkletNode(ctx, "myscreen-pcm", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const dest = ctx.createMediaStreamDestination();
    dest.channelCount = 2;
    node.connect(dest);

    const socket = new WebSocket(`${URL_BASE}?code=${encodeURIComponent(code)}`);
    ws = socket;
    socket.binaryType = "arraybuffer";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("tempo esgotado")), 5000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("conexão recusada"));
      };
    });

    socket.onmessage = (e) => {
      const data = e.data as ArrayBuffer;
      node.port.postMessage(data, [data]);
    };
    socket.onclose = () => {
      if (!closed) {
        close();
        onLost();
      }
    };

    const track = dest.stream.getAudioTracks()[0];
    return { track, close };
  } catch (error) {
    close();
    throw error;
  }
}
