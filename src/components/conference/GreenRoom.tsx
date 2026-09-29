"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2, Shield, ArrowRight, AlertCircle } from "lucide-react";

export interface GreenRoomJoinConfig {
  nickname: string;
  password?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

interface GreenRoomProps {
  roomId: string;
  roomTitle: string;
  isLocked: boolean;
  initialNickname?: string;
  /**
   * Deve resolver `true` quando o participante entrou de fato na sala.
   * Qualquer outro valor — inclusive `void`, como o pai retorna hoje — conta
   * como falha, e é o que destrava o botão. Sem esse sinal o lobby ficaria
   * travado em "Conectando..." para sempre depois de um 401 por senha errada.
   *
   * Mudança necessária no pai: `handleJoin` deve passar a devolver `Promise<boolean>`,
   * com `true` no caminho de sucesso e `false` no de erro.
   */
  onJoin: (config: GreenRoomJoinConfig) => Promise<boolean | void>;
}

// O texto acessível e o `aria-valuenow` só precisam de ~10 Hz; a barra é escrita
// direto no DOM a 60 Hz pelo requestAnimationFrame.
const METER_THROTTLE_MS = 100;
const MIC_LIVE_THRESHOLD = 5;

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
  // Trava contra duplo clique e feedback no botão enquanto o pai resolve o join.
  const [joining, setJoining] = useState(false);

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
  const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  // O efeito de preview só depende dos dispositivos: o estado de mute não pode
  // entrar nas dependências (senão cada toggle reabriria a câmera). Por isso o
  // valor corrente vive num ref, lido logo após cada `getUserMedia` para
  // reaplicar o mute nas tracks novas — elas nascem com `enabled = true`.
  const audioEnabledRef = useRef(audioEnabled);
  const videoEnabledRef = useRef(videoEnabled);

  // Impede `setState` depois que o lobby foi desmontado pelo sucesso do join.
  const mountedRef = useRef(true);

  // VU meter: DOM escrito no rAF + estado React limitado a 10 Hz
  const meterTrackRef = useRef<HTMLDivElement>(null);
  const meterBarRef = useRef<HTMLDivElement>(null);
  const micIconRef = useRef<SVGSVGElement | null>(null);
  const lastMeterPushRef = useRef(0);

  // Mic level meter
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // O AudioContext nasce "suspended" sem gesto do usuário (Autoplay Policy) e
  // nunca sairia assim: o `getByteFrequencyData` devolveria zeros para sempre.
  const resumeAudioContext = async (ctx: AudioContext) => {
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Continua bloqueado; o listener de primeiro gesto tenta de novo.
      }
    }
    return ctx.state === "running";
  };

  // Desconectar o AnalyserNode antes de fechar o contexto: senão cada entrada na
  // sala deixa um MediaStreamAudioSourceNode conectado.
  const teardownAudioGraph = () => {
    if (analyserSourceRef.current) {
      analyserSourceRef.current.disconnect();
      analyserSourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    const ctx = audioContextRef.current;
    if (ctx) {
      audioContextRef.current = null;
      if (ctx.state !== "closed") {
        void ctx.close().catch(() => {});
      }
    }
  };

  // Enumerate devices and request initial preview
  useEffect(() => {
    let active = true;

    async function setupPreview() {
      try {
        if (!mountedRef.current) return;
        setHasPermissionError(false);
        setPermissionErrorMessage(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Tracks novas nascem habilitadas: reaplicar o mute escolhido pelo
        // usuário, senão trocar de dispositivo religa o microfone/câmera
        // atrás da UI que continua dizendo "desligado".
        for (const track of stream.getAudioTracks()) {
          track.enabled = audioEnabledRef.current;
        }
        for (const track of stream.getVideoTracks()) {
          track.enabled = videoEnabledRef.current;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup Audio Analyser for VU Meter
        const AudioContextClass =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio API indisponível neste navegador.");
        }

        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        // O estado precisa ser refletido na hora: bloqueado, o resume() só
        // resolve depois do primeiro gesto.
        setAudioBlocked(audioCtx.state !== "running");
        // E não esperamos o resume aqui: ele travaria a enumeração de dispositivos.
        void resumeAudioContext(audioCtx).then((running) => {
          if (active && mountedRef.current) setAudioBlocked(!running);
        });

        const analyser = audioCtx.createAnalyser();
        // Com 64 o frequencyBinCount é 32 e a média cobre quase só os bins graves:
        // um microfone claro e baixo lia como mudo.
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const micTrack = stream.getAudioTracks()[0];
        if (micTrack) {
          const source = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
          source.connect(analyser);
          analyserSourceRef.current = source;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = (timestamp: number) => {
            if (!active) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const level = Math.min(100, average);

            // 60 Hz vai direto no DOM — nenhum setState por frame.
            if (meterBarRef.current) {
              meterBarRef.current.style.width = `${level}%`;
            }
            const isCapturing = level > MIC_LIVE_THRESHOLD;
            if (micIconRef.current) {
              micIconRef.current.classList.toggle("text-emerald-400", isCapturing);
              micIconRef.current.classList.toggle("text-gray-500", !isCapturing);
            }

            // 10 Hz para o estado React (texto "Captando"/"Silêncio" + leitura a11y).
            if (timestamp - lastMeterPushRef.current >= METER_THROTTLE_MS) {
              lastMeterPushRef.current = timestamp;
              const rounded = Math.round(level);
              if (meterTrackRef.current) {
                meterTrackRef.current.setAttribute("aria-valuenow", String(rounded));
              }
              setAudioLevel(rounded);
            }

            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          animFrameRef.current = requestAnimationFrame(checkVolume);

          // Re-garanta o resume no primeiro gesto: cobre o caso do efeito ter
          // rodado antes de qualquer interação.
          const handleFirstGesture = () => {
            window.removeEventListener("pointerdown", handleFirstGesture);
            window.removeEventListener("keydown", handleFirstGesture);
            const ctx = audioContextRef.current;
            if (!ctx) return;
            void resumeAudioContext(ctx).then((running) => {
              if (active && mountedRef.current) setAudioBlocked(!running);
            });
          };
          window.addEventListener("pointerdown", handleFirstGesture, { once: true });
          window.addEventListener("keydown", handleFirstGesture, { once: true });
          gestureCleanupRef.current = () => {
            window.removeEventListener("pointerdown", handleFirstGesture);
            window.removeEventListener("keydown", handleFirstGesture);
          };
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
      } catch (err: unknown) {
        const errorName =
          err && typeof err === "object" && "name" in err && typeof err.name === "string"
            ? err.name
            : "";
        console.warn("Permissão de mídia negada ou dispositivo indisponível:", err);
        if (!active || !mountedRef.current) return;
        setHasPermissionError(true);
        if (errorName === "NotReadableError") {
          setPermissionErrorMessage(
            "Câmera ou microfone em uso por outro aplicativo (ex: Discord, OBS ou outra aba). Feche-o ou entre na sala com a câmera desligada."
          );
        } else if (errorName === "NotAllowedError") {
          setPermissionErrorMessage(
            "Permissão de acesso à câmera/microfone negada no navegador. Permita o acesso nas configurações do site."
          );
        } else {
          setPermissionErrorMessage(
            "Não foi possível acessar a câmera ou microfone no momento."
          );
        }
      }
    }

    setupPreview();

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (gestureCleanupRef.current) {
        gestureCleanupRef.current();
        gestureCleanupRef.current = null;
      }
      teardownAudioGraph();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [selectedAudioId, selectedVideoId]);

  // Toggle audio track
  const toggleAudio = () => {
    const next = !audioEnabled;
    audioEnabledRef.current = next;
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
    }
    setAudioEnabled(next);
  };

  // Toggle video track
  const toggleVideo = () => {
    const next = !videoEnabled;
    videoEnabledRef.current = next;
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
    setVideoEnabled(next);
  };

  const handleJoinClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !nickname.trim()) return;

    setJoining(true);

    // O preview NÃO é destruído aqui: se o join falhar (senha errada, 401, rede)
    // o lobby continua montado e precisa de um preview vivo — sem ele os botões
    // de mute viram no-op e a UI passa a mentir sobre o hardware. O teardown
    // fica por conta do cleanup do efeito, que só roda no unmount (após o
    // sucesso do join) ou quando o usuário troca de dispositivo.
    try {
      const entered = (await onJoin({
        nickname: nickname.trim(),
        password: password.trim() || undefined,
        audioEnabled: hasPermissionError ? false : audioEnabled,
        videoEnabled: hasPermissionError ? false : videoEnabled,
        audioDeviceId: selectedAudioId,
        videoDeviceId: selectedVideoId,
      })) === true;

      // Só o sucesso mantém o lobby travado: ele será desmontado pelo pai.
      if (!entered && mountedRef.current) {
        setJoining(false);
      }
    } catch {
      if (mountedRef.current) setJoining(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
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
                disabled={joining}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all disabled:opacity-50 disabled:pointer-events-none ${
                  audioEnabled
                    ? "bg-secondary text-white hover:bg-secondary/80"
                    : "bg-red-600 text-white hover:bg-red-500"
                }`}
                aria-label={audioEnabled ? "Silenciar microfone" : "Ativar microfone"}
                aria-pressed={audioEnabled}
              >
                {audioEnabled ? <Mic className="h-5 w-5" aria-hidden="true" /> : <MicOff className="h-5 w-5" aria-hidden="true" />}
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                disabled={joining}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all disabled:opacity-50 disabled:pointer-events-none ${
                  videoEnabled
                    ? "bg-secondary text-white hover:bg-secondary/80"
                    : "bg-red-600 text-white hover:bg-red-500"
                }`}
                aria-label={videoEnabled ? "Desligar câmera" : "Ligar câmera"}
                aria-pressed={videoEnabled}
              >
                {videoEnabled ? <Video className="h-5 w-5" aria-hidden="true" /> : <VideoOff className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Device In Use / Permission Warning Banner */}
          {permissionErrorMessage && (
            <div className="mt-3 w-full rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{permissionErrorMessage}</span>
            </div>
          )}

          {/* VU Meter (Microphone Volume Bar) */}
          <div className="mt-4 w-full flex items-center gap-3 bg-[#11131c] px-4 py-2.5 rounded-xl border border-border/60">
            <Mic
              ref={micIconRef}
              className={`h-4 w-4 ${audioLevel > MIC_LIVE_THRESHOLD ? "text-emerald-400" : "text-gray-500"}`}
            />
            <div
              ref={meterTrackRef}
              role="meter"
              aria-label="Nível do microfone"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={audioLevel}
              aria-valuetext={audioLevel > MIC_LIVE_THRESHOLD ? "Captando áudio" : "Silêncio"}
              className="flex-1 bg-secondary h-2 rounded-full overflow-hidden"
            >
              <div
                ref={meterBarRef}
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-16 text-right">
              {audioLevel > MIC_LIVE_THRESHOLD ? "Captando" : "Silêncio"}
            </span>
          </div>

          {/* O navegador só libera a análise de áudio após um gesto */}
          {audioBlocked && !hasPermissionError && (
            <div className="mt-2 w-full flex items-center gap-2 text-[11px] text-amber-300/90">
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Clique ou pressione uma tecla para ativar a medição de áudio.</span>
            </div>
          )}

          {/* Device Selection dropdowns */}
          <div className="mt-3 grid grid-cols-2 gap-3 w-full">
            <div>
              <label
                htmlFor="greenroom-audio-device"
                className="block text-xs text-gray-300 mb-1"
              >
                Microfone
              </label>
              <select
                id="greenroom-audio-device"
                value={selectedAudioId}
                disabled={joining}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="w-full rounded-lg border border-border bg-[#11131c] px-3 py-1.5 text-xs text-gray-300 focus:outline-none disabled:opacity-50"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microfone ${d.deviceId.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="greenroom-video-device"
                className="block text-xs text-gray-300 mb-1"
              >
                Câmera
              </label>
              <select
                id="greenroom-video-device"
                value={selectedVideoId}
                disabled={joining}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full rounded-lg border border-border bg-[#11131c] px-3 py-1.5 text-xs text-gray-300 focus:outline-none disabled:opacity-50"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Câmera ${d.deviceId.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </div>
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

          <form onSubmit={handleJoinClick} className="space-y-4" aria-busy={joining}>
            <div>
              <label
                htmlFor="greenroom-nickname"
                className="text-xs font-medium text-gray-300 block mb-1.5"
              >
                Seu Nome ou Apelido *
              </label>
              <input
                id="greenroom-nickname"
                type="text"
                required
                autoComplete="nickname"
                placeholder="Ex: Henrique"
                value={nickname}
                disabled={joining}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#181b26] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>

            {isLocked && (
              <div>
                <label
                  htmlFor="greenroom-password"
                  className="text-xs font-medium text-gray-300 flex items-center gap-1.5 mb-1.5"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>Senha da Reunião *</span>
                </label>
                <input
                  id="greenroom-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Digite a senha da sala"
                  value={password}
                  disabled={joining}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-[#181b26] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!nickname.trim() || joining}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <span>{joining ? "Conectando..." : "Entrar na Reunião"}</span>
                <ArrowRight className={`h-4 w-4 ${joining ? "animate-pulse" : ""}`} aria-hidden="true" />
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
