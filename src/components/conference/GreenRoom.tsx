"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2, Shield, ArrowRight, Settings2 } from "lucide-react";

interface GreenRoomProps {
  roomId: string;
  roomTitle: string;
  isLocked: boolean;
  initialNickname?: string;
  onJoin: (config: {
    nickname: string;
    password?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }) => void;
}

export function GreenRoom({
  roomId,
  roomTitle,
  isLocked,
  initialNickname = "",
  onJoin,
}: GreenRoomProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [password, setPassword] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Device selections
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // Media preview refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mic level meter
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  // Enumerate devices and request initial preview
  useEffect(() => {
    let active = true;

    async function setupPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup Audio Analyser for VU Meter
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const micTrack = stream.getAudioTracks()[0];
        if (micTrack) {
          const source = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!active) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }

        // Enumerate devices list
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (active) {
          const aDevs = devices.filter((d) => d.kind === "audioinput");
          const vDevs = devices.filter((d) => d.kind === "videoinput");
          setAudioDevices(aDevs);
          setVideoDevices(vDevs);

          if (!selectedAudioId && aDevs.length > 0) setSelectedAudioId(aDevs[0].deviceId);
          if (!selectedVideoId && vDevs.length > 0) setSelectedVideoId(vDevs[0].deviceId);
        }
      } catch (err) {
        console.warn("Permissão de mídia negada ou dispositivo indisponível:", err);
        setHasPermissionError(true);
      }
    }

    setupPreview();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedAudioId, selectedVideoId]);

  // Toggle audio track
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
      }
    }
    setAudioEnabled(!audioEnabled);
  };

  // Toggle video track
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
      }
    }
    setVideoEnabled(!videoEnabled);
  };

  const handleJoinClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    // Clean up local preview stream before joining LiveKit room
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }

    onJoin({
      nickname: nickname.trim(),
      password: password.trim() || undefined,
      audioEnabled,
      videoEnabled,
      audioDeviceId: selectedAudioId,
      videoDeviceId: selectedVideoId,
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Video Preview and VU Meter */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#11131c] border border-border/80 shadow-2xl flex items-center justify-center group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover transition-opacity duration-300 -scale-x-100 ${
                videoEnabled && !hasPermissionError ? "opacity-100" : "opacity-0"
              }`}
            />

            {(!videoEnabled || hasPermissionError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0f17] text-gray-400">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/80 text-gray-400 border border-border/80 mb-3">
                  <VideoOff className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-sm font-medium">Câmera desligada</p>
              </div>
            )}

            {/* Bottom floating toggles on preview */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0d0f17]/90 backdrop-blur-md px-4 py-2 rounded-full border border-border/80 shadow-lg">
              <button
                type="button"
                onClick={toggleAudio}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  audioEnabled
                    ? "bg-secondary text-white hover:bg-secondary/80"
                    : "bg-red-600 text-white hover:bg-red-500"
                }`}
                title={audioEnabled ? "Silenciar microfone" : "Ativar microfone"}
              >
                {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  videoEnabled
                    ? "bg-secondary text-white hover:bg-secondary/80"
                    : "bg-red-600 text-white hover:bg-red-500"
                }`}
                title={videoEnabled ? "Desligar câmera" : "Ligar câmera"}
              >
                {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* VU Meter (Microphone Volume Bar) */}
          <div className="mt-4 w-full flex items-center gap-3 bg-[#11131c] px-4 py-2.5 rounded-xl border border-border/60">
            <Mic className={`h-4 w-4 ${audioLevel > 5 ? "text-emerald-400" : "text-gray-500"}`} />
            <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-16 text-right">
              {audioLevel > 5 ? "Captando" : "Silêncio"}
            </span>
          </div>

          {/* Device Selection dropdowns */}
          <div className="mt-3 grid grid-cols-2 gap-3 w-full">
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="rounded-lg border border-border bg-[#11131c] px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>

            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="rounded-lg border border-border bg-[#11131c] px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
            >
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Câmera ${d.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Column: Room Details, Nickname & Join Form */}
        <div className="lg:col-span-5 bg-[#11131c] rounded-2xl border border-border/80 p-6 shadow-2xl">
          <div className="mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Lobby Pré-Reunião
            </span>
            <h1 className="text-2xl font-bold text-white mt-1">{roomTitle}</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {roomId}</p>
          </div>

          <form onSubmit={handleJoinClick} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Seu Nome ou Apelido *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Henrique"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#181b26] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>

            {isLocked && (
              <div>
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>Senha da Reunião *</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite a senha da sala"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-[#181b26] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!nickname.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <span>Entrar na Reunião</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-gray-500">
              Ao entrar, você poderá compartilhar sua tela com áudio e sua câmera simultaneamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
