"use client";

import { Circle, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A gravação NÃO passa pelo servidor. Ela roda no navegador, via MediaRecorder,
 * misturando a faixa de tela com o microfone num `MediaStreamDestination`. Um
 * VPS de 1 vCPU não teria CPU sobrando para re-encodar, e mandar o arquivo para
 * lá só adicionaria upload e um ponto de falha.
 */

/**
 * A ordem importa. VP9 dá o melhor resultado e o Safari não o tem; o H.264 em
 * MP4 é o caminho do Safari; e `video/mp4` sozinho é o último recurso, porque
 * sem codecs declarados o navegador escolhe e nem sempre escolhe bem.
 */
const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

/**
 * A extensão segue o `mimeType` REAL do blob, não o do primeiro candidato que
 * passou: no Safari o resultado é `.mp4`, e um `.webm` renomeado não abre em
 * lugar nenhum.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/ogg": "ogv",
};

interface LocalRecorderProps {
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function LocalRecorder({ onRecordingStateChange }: LocalRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [extension, setExtension] = useState("webm");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const blobTypeRef = useRef("video/webm");
  const extensionRef = useRef("webm");
  const failedRef = useRef(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(
    () => () => {
      clearInterval(elapsedRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (error) {
          console.error("Falha ao finalizar a gravação no unmount:", error);
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    },
    [],
  );

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function releaseStreams() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }

  async function startRecording() {
    if (recorderRef.current?.state === "recording") {
      console.warn("Uma gravação já está em andamento.");
      return;
    }
    setError(null);
    failedRef.current = false;

    try {
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor", frameRate: { ideal: 60, max: 60 } },
          audio: true,
        });
      } catch (audioError) {
        // Windows em modo exclusivo recusa o áudio do sistema. A tela ainda pode
        // ser gravada; perder a gravação inteira por causa do som seria caro.
        console.warn(
          "Áudio do sistema indisponível para gravação (modo exclusivo do Windows). Gravando tela sem áudio do sistema...",
          audioError,
        );
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor", frameRate: { ideal: 60, max: 60 } },
          audio: false,
        });
      }

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (micError) {
        console.warn("Microfone não disponível para mesclar na gravação:", micError);
      }

      const AudioCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio API indisponível neste navegador.");
      const audioCtx = new AudioCtor();
      audioContextRef.current = audioCtx;

      const mixed = new MediaStream(displayStream.getVideoTracks());
      const destination = audioCtx.createMediaStreamDestination();
      for (const track of [...displayStream.getAudioTracks(), ...(micStream?.getAudioTracks() ?? [])]) {
        audioCtx.createMediaStreamSource(new MediaStream([track])).connect(destination);
      }
      for (const track of destination.stream.getAudioTracks()) mixed.addTrack(track);

      const supportedMimeType = MIME_TYPE_CANDIDATES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const blobType = supportedMimeType ? supportedMimeType.split(";")[0].trim() : "video/webm";
      const ext = EXTENSION_BY_MIME[blobType] ?? "webm";
      blobTypeRef.current = blobType;
      extensionRef.current = ext;
      setExtension(ext);

      const recorder = new MediaRecorder(mixed, {
        mimeType: supportedMimeType ?? undefined,
        videoBitsPerSecond: 4_500_000,
      });
      recorderRef.current = recorder;
      streamRef.current = mixed;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        failedRef.current = true;
        console.error("Falha de codificação durante a gravação:", event.error);
      };
      recorder.onstop = () => {
        clearInterval(elapsedRef.current);
        setIsRecording(false);
        onRecordingStateChange?.(false);

        const type = blobTypeRef.current;
        const recorded = chunksRef.current;
        chunksRef.current = [];
        releaseStreams();
        recorderRef.current = null;

        if (failedRef.current) {
          setError(
            "A gravação falhou na codificação do vídeo. Feche aplicativos pesados e clique em Gravar Tela para tentar novamente.",
          );
          return;
        }
        if (recorded.length === 0) {
          setError("A gravação terminou sem nenhum dado. Clique em Gravar Tela para tentar novamente.");
          return;
        }

        const blob = new Blob(recorded, { type });
        const url = URL.createObjectURL(blob);
        // Revogar a URL anterior só quando a nova chega evita deixar a página
        // segurando o blob antigo em memória durante a gravação seguinte.
        setDownloadUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
        triggerDownload(url);
      };

      // Fatias de 1 s: um blob só só existiria no stop, e uma queda no meio
      // perderia tudo.
      recorder.start(1000);
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setIsRecording(true);
      onRecordingStateChange?.(true);
    } catch (recordError) {
      console.error("Erro ao iniciar gravação:", recordError);
      releaseStreams();
      setError(
        "Não foi possível iniciar a gravação. Verifique as permissões de tela e clique em Gravar Tela para tentar novamente.",
      );
    }
  }

  function triggerDownload(url: string) {
    // Um <a> fora do React sobrevive ao unmount: o `onstop` pode disparar depois
    // de a pessoa ter saído da sala, e o download ainda precisa acontecer.
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myscreen-gravacao-${timestamp}.${extensionRef.current}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  return (
    <div>
      {error ? (
        <div className="mb-2 flex items-start gap-2 border border-alert-line bg-alert-wash px-3 py-2">
          <p role="alert" className="min-w-0 flex-1 text-[0.75rem] leading-[1.45] text-alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setError(null)}
            title="Fechar aviso"
            aria-label="Fechar aviso"
            className="shrink-0 text-alert transition-opacity hover:opacity-70"
          >
            <X size={13} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="border border-rule bg-sheet [border-radius:var(--radius-sheet)]">
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            title="Parar e baixar gravação"
            className="flex w-full items-center justify-center gap-2 border border-signal-line bg-signal-wash px-3 py-2.5 text-[0.75rem] font-semibold text-signal transition-colors hover:bg-signal-wash-2 [border-radius:var(--radius-sheet)]"
          >
            <span aria-hidden className="size-[7px] rounded-full bg-signal" />
            <span className="font-mono [font-variant-numeric:tabular-nums]">
              {formatTime(elapsed)}
            </span>
            <span>Parar &amp; baixar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            title="Gravar tela com áudio localmente"
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-[0.75rem] font-semibold text-ink-2 transition-colors hover:bg-band hover:text-ink [border-radius:var(--radius-sheet)]"
          >
            <Circle size={13} strokeWidth={1.5} aria-hidden />
            Gravar tela
          </button>
        )}

        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={`myscreen-gravacao.${extension}`}
            title="Baixar última gravação novamente"
            className="flex w-full items-center justify-center gap-2 border-t border-rule px-3 py-2 text-[0.75rem] text-ink-2 transition-colors hover:bg-band hover:text-ink"
          >
            <Download size={13} strokeWidth={1.5} aria-hidden />
            Baixar novamente
          </a>
        ) : null}
      </div>

      <p className="mt-1.5 text-[0.6875rem] leading-[1.45] text-ink-3">
        A gravação fica no seu navegador, em {extension.toUpperCase()}.
      </p>
    </div>
  );
}
