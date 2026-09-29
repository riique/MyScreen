"use client";

import { useState, useRef, useEffect } from "react";
import { Circle, Square, Download, AlertCircle } from "lucide-react";

interface LocalRecorderProps {
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function LocalRecorder({ onRecordingStateChange }: LocalRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      chunksRef.current = [];
      setDownloadUrl(null);

      // Capture screen with system/tab audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });

      // Capture microphone audio to mix in
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (err) {
        console.warn("Microfone não disponível para mesclar na gravação:", err);
      }

      // Mix audio using Web Audio API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 4_500_000, // 4.5 Mbps for crisp HD
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "video/webm",
        });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        // Auto trigger download
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const a = document.createElement("a");
        a.href = url;
        a.download = `myscreen-gravacao-${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Stop all tracks
        combinedStream.getTracks().forEach((track) => track.stop());
        displayStream.getTracks().forEach((track) => track.stop());
        if (micStream) micStream.getTracks().forEach((track) => track.stop());
      };

      // Handle user stopping display share via browser banner
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      recorder.start(1000); // 1s slice
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setDuration(0);
      onRecordingStateChange?.(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        console.error("Erro ao iniciar gravação:", err);
        alert("Não foi possível iniciar a gravação. Verifique as permissões de tela.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    onRecordingStateChange?.(false);
  };

  return (
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
          download="myscreen-gravacao.webm"
          className="flex items-center gap-1 rounded-xl bg-indigo-600/30 border border-indigo-500/50 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-600/50 transition-colors"
          title="Baixar última gravação novamente"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Baixar Novamente</span>
        </a>
      )}
    </div>
  );
}
