"use client";

import { useState, useRef, useEffect } from "react";
import { Circle, Download, AlertCircle, X } from "lucide-react";

// Ordem de preferência: WebM (VP9 → VP8) e, para o Safari, MP4 com codecs
// explícitos — o "video/mp4" sem codecs falha no construtor do MediaRecorder.
const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

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
  const [duration, setDuration] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // `onstop` chega de forma assíncrona e pode ocorrer depois do unmount.
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const failedRef = useRef(false);
  const blobTypeRef = useRef("video/webm");
  const extensionRef = useRef("webm");

  const releaseStreams = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  };

  const closeAudioContext = () => {
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => {});
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimer();

      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;

      if (!recorder || recorder.state === "inactive") {
        releaseStreams();
        closeAudioContext();
        return;
      }

      // Sem stop() não vem a sequência dataavailable/stop: o chunk final nunca é
      // flushed e nenhum Blob é produzido — a gravação é perdida em silêncio.
      // Quem libera as tracks agora é o onstop.
      try {
        recorder.stop();
      } catch (err) {
        console.error("Falha ao finalizar a gravação no unmount:", err);
        releaseStreams();
        closeAudioContext();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    // Trava síncrona: o guard por `mediaRecorderRef` só fecha depois dos
    // `await` de permissão, então dois cliques rápidos abriam duas capturas.
    if (startingRef.current || mediaRecorderRef.current?.state === "recording") {
      console.warn("Uma gravação já está em andamento.");
      return;
    }
    startingRef.current = true;

    closeAudioContext();
    releaseStreams();
    chunksRef.current = [];
    failedRef.current = false;

    // Libera o object URL anterior antes de trocar o download.
    setDownloadUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setErrorMessage(null);

    try {
      // Capture screen with system/tab audio
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
            frameRate: { ideal: 60, max: 60 },
          },
          audio: true,
        });
      } catch (displayErr: unknown) {
        const isNotReadable =
          displayErr instanceof DOMException && displayErr.name === "NotReadableError";
        const displayMessage =
          displayErr && typeof displayErr === "object" && "message" in displayErr
            ? String(displayErr.message)
            : "";

        if (isNotReadable || displayMessage.includes("audio")) {
          console.warn(
            "Áudio do sistema indisponível para gravação (modo exclusivo do Windows). Gravando tela sem áudio do sistema..."
          );
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: "monitor",
              frameRate: { ideal: 60, max: 60 },
            },
            audio: false,
          });
        } else {
          throw displayErr;
        }
      }
      displayStreamRef.current = displayStream;

      // Capture microphone audio to mix in
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        micStreamRef.current = micStream;
      } catch (err) {
        console.warn("Microfone não disponível para mesclar na gravação:", err);
      }

      // Mix audio using Web Audio API
      const AudioContextClass =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API indisponível neste navegador.");
      }
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      // Connect screen audio if present
      if (displayStream.getAudioTracks().length > 0) {
        const displayAudioSource = audioCtx.createMediaStreamSource(
          new MediaStream(displayStream.getAudioTracks())
        );
        displayAudioSource.connect(dest);
      }

      // Connect mic audio if present
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micAudioSource = audioCtx.createMediaStreamSource(micStream);
        micAudioSource.connect(dest);
      }

      // Combine video track + mixed audio track
      const combinedTracks = [
        ...displayStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);
      streamRef.current = combinedStream;

      // Detect best supported mime type
      const supportedMimeType =
        MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      const blobType = supportedMimeType ? supportedMimeType.split(";")[0].trim() : "video/webm";
      blobTypeRef.current = blobType;
      // Sem isso o download sairia como .webm mesmo no Safari, que grava MP4.
      extensionRef.current = EXTENSION_BY_MIME[blobType] ?? "webm";

      const recorder = new MediaRecorder(combinedStream, {
        ...(supportedMimeType ? { mimeType: supportedMimeType } : {}),
        videoBitsPerSecond: 4_500_000, // 4.5 Mbps for crisp HD
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event: Event) => {
        // Falha de encoder é provável em 1080p60: sem isso o timer continua
        // marcando "gravando" e o download sai corrompido ou com 0 bytes.
        const reason = "error" in event ? event.error : null;
        console.error("Falha de codificação durante a gravação:", reason);
        failedRef.current = true;
        clearTimer();
        // Falha de encoder tambem encerra a gravacao: sem liberar a ref, o
        // botao "Gravar Tela" reaparece mas todo clique seguinte entra no
        // early return e a segunda gravacao da sessao vira no-op silencioso.
        mediaRecorderRef.current = null;
        if (mountedRef.current) {
          setIsRecording(false);
          setErrorMessage(
            "A gravação falhou na codificação do vídeo. Feche aplicativos pesados e clique em Gravar Tela para tentar novamente."
          );
          onRecordingStateChange?.(false);
        }
      };

      recorder.onstop = () => {
        // Sem limpar o ref, a guarda de reentrada continuava verdadeira
        // apontando para um MediaRecorder `inactive` e a segunda gravação na
        // mesma montagem virava no-op silencioso.
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        releaseStreams();
        closeAudioContext();

        // Depois de um erro não há arquivo utilizável: nada de baixar lixo.
        if (failedRef.current) return;

        if (chunksRef.current.length === 0) {
          if (mountedRef.current) {
            setIsRecording(false);
            setErrorMessage(
              "A gravação terminou sem nenhum dado. Clique em Gravar Tela para tentar novamente."
            );
            onRecordingStateChange?.(false);
          }
          return;
        }

        const blob = new Blob(chunksRef.current, { type: blobTypeRef.current });
        const url = URL.createObjectURL(blob);
        if (mountedRef.current) {
          setDownloadUrl(url);
        }

        // Efeito de DOM: o download precisa acontecer mesmo pós-unmount.
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const a = document.createElement("a");
        a.href = url;
        a.download = `myscreen-gravacao-${timestamp}.${extensionRef.current}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (mountedRef.current) {
          setIsRecording(false);
          onRecordingStateChange?.(false);
        }
      };

      // Handle user stopping display share via browser banner
      const displayVideoTrack = displayStream.getVideoTracks()[0];
      if (displayVideoTrack) {
        displayVideoTrack.onended = () => {
          stopRecording();
        };
      }

      // O unmount pode ter ocorrido durante os `await` de `getDisplayMedia` /
      // `getUserMedia`. Nesse instante o cleanup já rodou com o ref vazio e
      // não liberate nada — sem este guard a captura e o microfone ficavam
      // ligados para sempre, com encoder a 100% e nenhum botão para parar.
      if (!mountedRef.current) {
        mediaRecorderRef.current = null;
        releaseStreams();
        closeAudioContext();
        startingRef.current = false;
        return;
      }

      recorder.start(1000); // 1s slice

      setIsRecording(true);
      setDuration(0);
      onRecordingStateChange?.(true);

      timerRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      mediaRecorderRef.current = null;
      releaseStreams();
      closeAudioContext();
      const errorName =
        err && typeof err === "object" && "name" in err && typeof err.name === "string"
          ? err.name
          : "";

      // NotAllowedError = o usuário dispensou o seletor de tela; não é erro.
      if (errorName !== "NotAllowedError") {
        console.error("Erro ao iniciar gravação:", err);
        if (mountedRef.current) {
          setErrorMessage(
            "Não foi possível iniciar a gravação. Verifique as permissões de tela e clique em Gravar Tela para tentar novamente."
          );
        }
      }
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    clearTimer();
    if (mountedRef.current) {
      setIsRecording(false);
      onRecordingStateChange?.(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            title="Gravar tela com áudio localmente"
            className="flex items-center gap-2 rounded-xl bg-[#1e2230] px-3.5 py-2.5 text-xs font-semibold text-gray-200 border border-border/80 hover:bg-secondary hover:text-white transition-all shadow-sm group"
          >
            <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500 group-hover:scale-110 transition-transform" />
            <span>Gravar Tela</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-red-950/80 border border-red-500/40 px-3.5 py-2 text-xs font-semibold text-white animate-pulse">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-mono text-red-200 font-bold">{formatTime(duration)}</span>
            <button
              onClick={stopRecording}
              title="Parar e baixar gravação"
              className="ml-2 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-500 transition-colors"
            >
              Parar & Baixar
            </button>
          </div>
        )}

        {downloadUrl && !isRecording && (
          <a
            href={downloadUrl}
            download={`myscreen-gravacao.${extensionRef.current}`}
            className="flex items-center gap-1 rounded-xl bg-indigo-600/30 border border-indigo-500/50 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-600/50 transition-colors"
            title="Baixar última gravação novamente"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar Novamente</span>
          </a>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-300"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            title="Fechar aviso"
            className="ml-1 rounded-md p-0.5 text-red-300 hover:text-white hover:bg-red-500/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
