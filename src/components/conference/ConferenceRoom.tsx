"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useParticipants,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  LocalAudioTrack,
  RoomEvent,
  Track,
  supportsAudioOutputSelection,
  type Participant,
  type TrackPublishOptions,
} from "livekit-client";
import { useRouter } from "next/navigation";
import { MediaControls } from "./MediaControls";
import { ChatSidebar } from "./ChatSidebar";
import { ParticipantsList } from "./ParticipantsList";
import { SettingsModal, MediaSettings } from "./SettingsModal";
import { TrackStatsDropdown } from "./TrackStatsDropdown";
import { AlertCircle, Maximize2, Mic, MicOff, Monitor, X } from "lucide-react";

interface ConferenceRoomProps {
  token: string;
  serverUrl: string;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
}

/** Lê `name` de um erro desconhecido sem recorrer a `any`. */
function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name?: unknown };
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const MEDIA_ERROR_NAMES = new Set([
  "NotReadableError",
  "NotAllowedError",
  "NotFoundError",
  "OverconstrainedError",
  "NotSupportedError",
  "AbortError",
]);

export function ConferenceRoom({
  token,
  serverUrl,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  initialAudioDeviceId,
  initialVideoDeviceId,
}: ConferenceRoomProps) {
  const router = useRouter();
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const userInitiatedLeave = useRef(false);

  // `onError` do <LiveKitRoom> NÃO é só de conexão: o handler interno de
  // `RoomEvent.SignalConnected` faz `Promise.all([setMicrophoneEnabled,
  // setCameraEnabled, setScreenShareEnabled])` e manda o `.catch` para o mesmo
  // `onError`. Um `NotReadableError` de microfone (comum quando outro app está
  // com o device aberto) abria o modal full-screen "Conexão Interrompida" e
  // travava a chamada inteira, sem caminho para "entrar mudo".
  const handleOnError = useCallback((e: Error) => {
    // Erros de captura de mídia chegam no MESMO `onError`: o handler interno de
    // `RoomEvent.SignalConnected` roda `Promise.all([setMicrophoneEnabled,
    // setCameraEnabled, setScreenShareEnabled])` e manda o `.catch` para cá
    // (@livekit/components-react/dist/room-Bfb4OWAI.mjs:3876-3882). Eles não
    // derrubam a conexão e não podem virar modal full-screen — um microfone em
    // uso por outro app matava a chamada inteira, sem caminho para "entrar mudo".
    if (MEDIA_ERROR_NAMES.has(e.name)) {
      setMediaError(
        `Não foi possível abrir um dispositivo (${e.name}). Você entrou sem ele — ` +
          `pode tentar de novo em Configurações de mídia.`
      );
      return;
    }
    setFatalError(e.message);
  }, []);

  const handleOnConnected = useCallback(() => {
    setFatalError(null);
    setMediaError(null);
  }, []);

  const handleOnDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      console.warn("LiveKit Room disconnected:", reason);
      if (userInitiatedLeave.current) {
        router.push("/");
      } else {
        setFatalError("A conexão com a conferência foi interrompida.");
      }
    },
    [router]
  );

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={
        initialAudioEnabled
          ? {
              deviceId: initialAudioDeviceId,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false
      }
      video={initialVideoEnabled ? { deviceId: initialVideoDeviceId } : false}
      options={{
        // pixelDensity 1: o default do SDK é 2 em telas densas, o que faz cada
        // tile pequeno pedir a camada simulcast "top" e anula o ganho do adaptive stream.
        adaptiveStream: { pixelDensity: 1, pauseVideoInBackground: true },
        dynacast: true,
        // Um único AudioContext para todos os áudios remotos: resolve o autoplay
        // block do iOS e é o que habilita switchActiveDevice("audiooutput", ...).
        webAudioMix: true,
        stopLocalTrackOnUnpublish: true,
        publishDefaults: {
          screenShareEncoding: { maxBitrate: 2_500_000, maxFramerate: 30, priority: "high" },
          degradationPreference: "maintain-resolution",
        },
      }}
      onError={handleOnError}
      onConnected={handleOnConnected}
      onDisconnected={handleOnDisconnected}
      className="relative flex h-[calc(100dvh-4rem)] w-full overflow-hidden bg-[#07080c] select-none"
    >
      {fatalError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-[#0f111a] p-6 text-center shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Conexão Interrompida</h3>
            <p className="text-sm text-gray-400">{fatalError}</p>
            <div className="flex w-full gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Reconectar
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Início
              </button>
            </div>
          </div>
        </div>
      )}
      <ConferenceStage
        token={token}
        mediaError={mediaError}
        onDismissMediaError={() => setMediaError(null)}
        initialAudioDeviceId={initialAudioDeviceId}
        initialVideoDeviceId={initialVideoDeviceId}
        onLeave={() => {
          userInitiatedLeave.current = true;
        }}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function ConferenceStage({
  token,
  mediaError,
  onDismissMediaError,
  initialAudioDeviceId,
  initialVideoDeviceId,
  onLeave,
}: {
  token: string;
  mediaError: string | null;
  onDismissMediaError: () => void;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
  onLeave?: () => void;
}) {
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const room = useRoomContext();

  // Panels state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusLayout, setIsFocusLayout] = useState(true);

  // Banners / avisos
  const [unstableConnection, setUnstableConnection] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // Advanced media settings state
  const [settings, setSettings] = useState<MediaSettings>({
    screenFps: 60,
    screenResolution: "1080p",
    screenContentType: "detail",
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    audioInputId: initialAudioDeviceId,
    videoInputId: initialVideoDeviceId,
  });

  // Espelho síncrono de `settings` para o callback de atualização (evita stale closure)
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Devices list
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });

  const loadDevices = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devs.filter((d) => d.kind === "audioinput");
      const videoInputs = devs.filter((d) => d.kind === "videoinput");
      setDevices({
        audioInputs,
        videoInputs,
        audioOutputs: devs.filter((d) => d.kind === "audiooutput"),
      });

      // Hot-unplug: o SDK volta a track viva para `default` sozinho, mas nosso
      // estado ficaria com um deviceId morto — e `toggleMic` o passaria por
      // cima do default em `createTracks`, fazendo o `getUserMedia` lancar
      // NotFoundError e o microfone morrer para o resto da sessao.
      const current = settingsRef.current;
      const stale: Partial<MediaSettings> = {};
      if (current.audioInputId && !audioInputs.some((d) => d.deviceId === current.audioInputId)) {
        stale.audioInputId = undefined;
      }
      if (current.videoInputId && !videoInputs.some((d) => d.deviceId === current.videoInputId)) {
        stale.videoInputId = undefined;
      }
      if (Object.keys(stale).length > 0) {
        const reconciled = { ...current, ...stale };
        settingsRef.current = reconciled;
        setSettings(reconciled);
      }
    } catch (e) {
      console.warn("Could not enumerate devices:", e);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  // Refresh de token: o prop `token` sozinho NÃO renova nada.
  // O efeito de conexão do <LiveKitRoom> tem `token` nas deps e chama
  // `room.connect()`, mas `Room.connect` faz early-return quando a sala já
  // está conectada (livekit-client.esm.mjs:33682-33686) — o token novo é
  // jogado no lixo e o motor continua usando o do join original, que expira
  // em 6h e derruba a call na primeira queda real de rede.
  //
  // O SDK 2.9 não expõe setter público de token no `Room` (o único
  // `updateToken` é de `RegionUrlProvider`, outra classe). `RTCEngine.token` é
  // o valor lido em cada `resumeConnection`/`restartConnection`, e é `private`
  // no .d.ts — daí o cast estreito. Se o SDK passar a expor isso, trocar aqui.
  useEffect(() => {
    if (room.state !== ConnectionState.Connected) return;
    (room as unknown as { engine: { token: string } }).engine.token = token;
  }, [room, token]);

  // Não há listener para o `EngineEvent.TokenRefreshed`: o próprio motor já
  // escreve o token novo em `this.token` antes de emitir o evento
  // (livekit-client.esm.mjs:24520-24523), e esse é o valor lido no rejoin.

  // Assinaturas do Room — on/off pareados no cleanup
  useEffect(() => {
    const handleConnectionQualityChanged = (
      quality: ConnectionQuality,
      participant: Participant
    ) => {
      if (participant.isLocal) {
        setUnstableConnection(quality === ConnectionQuality.Poor);
      }
    };

    const handleAudioPlaybackStatusChanged = (playing: boolean) => {
      // O evento só dispara com `false` quando o navegador bloqueou a reprodução.
      setAudioBlocked(!playing);
    };

    const handleMediaDevicesChanged = () => {
      // Hot-unplug de headset/headset USB
      void loadDevices();
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.on(RoomEvent.AudioPlaybackStatusChanged, handleAudioPlaybackStatusChanged);
    room.on(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);

    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.off(RoomEvent.AudioPlaybackStatusChanged, handleAudioPlaybackStatusChanged);
      room.off(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);
    };
  }, [room, loadDevices]);

  // Fetch all video and screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Screen share tracks across participants
  const screenShareTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track
  );

  // Camera tracks across participants
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicOn, {
        deviceId: settings.audioInputId,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
      });
    } catch (err) {
      console.error("Erro ao alternar microfone:", err);
    }
  }, [localParticipant, isMicOn, settings]);

  const toggleCam = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCamOn, {
        deviceId: settings.videoInputId,
      });
    } catch (err) {
      console.error("Erro ao alternar câmera:", err);
    }
  }, [localParticipant, isCamOn, settings.videoInputId]);

  const toggleScreenShare = useCallback(async () => {
    setScreenShareError(null);
    try {
      const nextState = !isScreenSharing;
      if (nextState) {
        const is4k = settings.screenResolution === "4k";
        const resolution = is4k
          ? { width: 3840, height: 2160, frameRate: settings.screenFps }
          : settings.screenResolution === "720p"
          ? { width: 1280, height: 720, frameRate: settings.screenFps }
          : { width: 1920, height: 1080, frameRate: settings.screenFps };

        // "detail" preserva nitidez (texto/IDE/UI); "motion" preserva fluidez
        // (vídeo/jogo). O default correto para quem demonstra software é "detail".
        const contentHint = settings.screenContentType === "detail" ? "detail" : "motion";

        // Sem este 3º argumento o SDK usa ScreenSharePresets.h1080fps15.encoding
        // (2,5 Mbps / 15 fps) e a tela vira ilegível em 4K.
        const publishOptions: TrackPublishOptions = {
          screenShareEncoding: {
            maxBitrate: is4k ? 5_000_000 : 2_500_000,
            maxFramerate: settings.screenFps,
            priority: "high",
          },
          simulcast: is4k,
          degradationPreference: "maintain-resolution",
        };

        try {
          // Publish Screen Share WITH Audio and chosen FPS / Resolution
          await localParticipant.setScreenShareEnabled(
            true,
            { audio: true, contentHint, resolution },
            publishOptions
          );
        } catch (audioErr: unknown) {
          if (
            getErrorName(audioErr) === "NotReadableError" ||
            getErrorMessage(audioErr).toLowerCase().includes("audio")
          ) {
            console.warn(
              "Áudio do sistema não pôde ser capturado (modo exclusivo do Windows). Compartilhando apenas o vídeo...",
              audioErr
            );
            // O fallback precisa das MESMAS publishOptions — sem elas o bug volta
            // silenciosamente.
            await localParticipant.setScreenShareEnabled(
              true,
              { audio: false, contentHint, resolution },
              publishOptions
            );
          } else {
            throw audioErr;
          }
        }
      } else {
        await localParticipant.setScreenShareEnabled(false);
      }
    } catch (err: unknown) {
      // NotAllowedError = o usuário cancelou o seletor de tela. Qualquer outro
      // erro é real e precisa aparecer na UI.
      if (getErrorName(err) === "NotAllowedError") return;
      console.error("Erro ao compartilhar tela:", err);
      setScreenShareError(`Não foi possível compartilhar a tela: ${getErrorMessage(err)}`);
    }
  }, [localParticipant, isScreenSharing, settings]);

  const resumeAudioPlayback = useCallback(async () => {
    try {
      await room.startAudio();
      setAudioBlocked(false);
    } catch (err) {
      console.error("Não foi possível retomar o áudio:", err);
    }
  }, [room]);

  const applyMediaSettings = useCallback(
    async (patch: Partial<MediaSettings>) => {
      const previous = settingsRef.current;
      const next: MediaSettings = { ...previous, ...patch };
      settingsRef.current = next;
      setSettings(next);

      // Reverte a UI para o valor anterior. Sem isto, uma falha deixava o
      // `<select>`/checkbox mostrando uma escolha que nao esta em vigor — e,
      // como a guarda e `next.X !== previous.X`, re-escolher o mesmo valor nao
      // disparava nada: o usuario ficava preso ate sair da chamada.
      const rollback = () => {
        settingsRef.current = previous;
        setSettings(previous);
      };

      const processors = {
        echoCancellation: next.echoCancellation,
        noiseSuppression: next.noiseSuppression,
        autoGainControl: next.autoGainControl,
      };
      const processorsChanged =
        previous.echoCancellation !== next.echoCancellation ||
        previous.noiseSuppression !== next.noiseSuppression ||
        previous.autoGainControl !== next.autoGainControl;

      // `applyConstraints` e NAO `restartTrack`. `restartTrack()` passa por
      // `constraintsForOptions({audio: options})`, que injeta
      // `deviceId: {ideal: 'default'}` sempre que o objeto nao traz deviceId
      // (livekit-client.esm.mjs:13494-13500) e depois grava o resultado em
      // `this._constraints` (:22601) — a selecao de microfone seria perdida de
      // forma permanente e todo mute/unmute voltaria ao microfone integrado.
      // `applyConstraints` faz merge em `_constraints` preservando o deviceId
      // (:23013-23014) e a assinatura casa 1:1 com `processors`.
      if (processorsChanged) {
        const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone)
          ?.track;
        if (micTrack instanceof LocalAudioTrack) {
          try {
            await micTrack.applyConstraints(processors);
          } catch (err) {
            console.error("Erro ao aplicar aprimoramentos de microfone:", err);
            rollback();
          }
        }
      }

      // `setMicrophoneEnabled(enabled, { deviceId })` NAO troca o dispositivo:
      // com a track ja publicada o SDK faz apenas `track.unmute()` e ignora
      // `options` (livekit-client.esm.mjs:31631-31634). `switchActiveDevice` e
      // que percorre as publicacoes e chama `LocalAudioTrack.setDeviceId()`.
      if (next.audioInputId && next.audioInputId !== previous.audioInputId) {
        try {
          const switched = await room.switchActiveDevice("audioinput", next.audioInputId);
          if (!switched) {
            throw new Error("O navegador recusou o microfone selecionado.");
          }
        } catch (err) {
          console.error("Erro ao trocar o microfone:", err);
          rollback();
        }
      }

      if (next.videoInputId && next.videoInputId !== previous.videoInputId) {
        try {
          const switched = await room.switchActiveDevice("videoinput", next.videoInputId);
          if (!switched) {
            throw new Error("O navegador recusou a câmera selecionada.");
          }
        } catch (err) {
          console.error("Erro ao trocar a câmera:", err);
          rollback();
        }
      }

      // Com `webAudioMix: true` o SDK exige `setSinkId` no AudioContext, que e
      // uma capacidade separada de `HTMLMediaElement.setSinkId` — o helper
      // `supportsAudioOutputSelection()` so mede a segunda.
      const audioContextSupportsSink =
        typeof window !== "undefined" &&
        typeof window.AudioContext !== "undefined" &&
        "setSinkId" in window.AudioContext.prototype;

      if (
        next.audioOutputId &&
        next.audioOutputId !== previous.audioOutputId &&
        (supportsAudioOutputSelection() || audioContextSupportsSink)
      ) {
        try {
          await room.switchActiveDevice("audiooutput", next.audioOutputId);
        } catch (err) {
          console.error("Erro ao trocar a saída de áudio:", err);
          rollback();
        }
      }
    },
    [localParticipant, room]
  );

  const handleLeave = () => {
    onLeave?.();
    room.disconnect();
    router.push("/");
  };

  const toggleTileFullscreen = (element: HTMLElement | null) => {
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      element.requestFullscreen().catch(() => {});
    }
  };

  const hasActiveScreenShare = screenShareTracks.length > 0;

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {mediaError && (
        <div
          role="status"
          className="absolute bottom-28 left-1/2 z-50 flex max-w-md items-center gap-3 rounded-xl bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40 backdrop-blur-md"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">{mediaError}</span>
          <button
            type="button"
            onClick={onDismissMediaError}
            className="shrink-0 rounded-lg p-0.5 text-amber-200 transition-colors hover:bg-amber-500/20"
            aria-label="Dispensar aviso de mídia"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {connectionState === ConnectionState.Reconnecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500 text-black px-4 py-2 text-xs font-bold shadow-2xl animate-pulse">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <span>Reconectando à reunião...</span>
        </div>
      )}

      {connectionState === ConnectionState.SignalReconnecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500 text-black px-4 py-2 text-xs font-bold shadow-2xl animate-pulse">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <span>Reconectando a sinalização...</span>
        </div>
      )}

      {unstableConnection && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 px-4 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Conexão instável — a qualidade da sua rede caiu.</span>
        </div>
      )}

      {audioBlocked && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xl">
          <span>O navegador bloqueou a reprodução de áudio.</span>
          <button
            type="button"
            onClick={resumeAudioPlayback}
            className="rounded-lg bg-white/20 px-2.5 py-1 font-bold hover:bg-white/30 transition-colors"
          >
            Retomar áudio
          </button>
        </div>
      )}

      {screenShareError && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 flex max-w-md items-center gap-3 rounded-xl bg-red-500/15 text-red-300 ring-1 ring-red-500/40 px-4 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{screenShareError}</span>
          <button
            type="button"
            onClick={() => setScreenShareError(null)}
            className="shrink-0 rounded-lg p-0.5 text-red-300 hover:bg-red-500/20 transition-colors"
            title="Dispensar"
            aria-label="Dispensar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Video Arena */}
      <div className="relative flex flex-1 flex-col p-4 pb-24 overflow-hidden">
        {hasActiveScreenShare && isFocusLayout ? (
          // Presentation Layout: Large Screen Share + Webcam strip / PiP
          <div className="relative flex flex-1 flex-col lg:flex-row gap-4 h-full w-full overflow-hidden">
            {/* Primary Screen Share Display */}
            <div
              data-fullscreen-tile="true"
              className="group relative flex-1 rounded-2xl overflow-hidden bg-[#0c0e15] border border-border/80 shadow-2xl flex items-center justify-center [&:fullscreen]:bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
            >
              {isTrackReference(screenShareTracks[0]) && screenShareTracks[0].publication?.track && (
                <VideoTrack
                  trackRef={screenShareTracks[0]}
                  className="h-full w-full object-contain"
                />
              )}
              {/* Controls Overlay: Stats + Fullscreen for Screen Share */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <TrackStatsDropdown trackRef={screenShareTracks[0]} size="md" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTileFullscreen(e.currentTarget.closest('[data-fullscreen-tile]') as HTMLElement);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white shadow-lg transition-all hover:scale-105"
                  title="Tela cheia do compartilhamento"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Side / Bottom Webcam Column */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-72 shrink-0">
              {cameraTracks.map((trackRef) => {
                const p = trackRef.participant;
                // Uma track pode chegar sem participante durante reconexão rápida.
                if (!p) return null;
                const hasCam = isTrackReference(trackRef) && trackRef.publication?.track && !trackRef.publication.isMuted;
                const isSpeaking = p.isSpeaking;

                return (
                  <div
                    key={`${p.identity}-cam`}
                    data-fullscreen-tile="true"
                    className={`group relative aspect-video rounded-xl overflow-hidden bg-[#11131c] border transition-all shrink-0 w-48 lg:w-full [&:fullscreen]:bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${
                      isSpeaking
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-border/70"
                    }`}
                  >
                    {hasCam && isTrackReference(trackRef) ? (
                      <VideoTrack
                        trackRef={trackRef}
                        className="h-full w-full object-cover -scale-x-100 [&:fullscreen]:object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#131622] text-gray-400">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-gray-300 font-bold text-base">
                          {(p.name || p.identity).charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    {/* Controls Overlay: Stats + Fullscreen for Webcam */}
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {hasCam && <TrackStatsDropdown trackRef={trackRef} size="sm" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTileFullscreen(e.currentTarget.closest('[data-fullscreen-tile]') as HTMLElement);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white shadow-md hover:scale-105 transition-all"
                        title={`Tela cheia de ${p.name || p.identity}`}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Participant Badge */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/70 backdrop-blur-md px-2 py-1 text-[11px] text-white font-medium border border-white/10">
                      <span>{p.name || p.identity}</span>
                      {p.isLocal && <span className="text-[9px] text-indigo-400">(Você)</span>}
                      {p.isMicrophoneEnabled ? (
                        <Mic className="h-3 w-3 text-emerald-400 ml-1" />
                      ) : (
                        <MicOff className="h-3 w-3 text-red-400 ml-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Grid Layout: Adaptive Grid of Participants
          <div
            className={`grid flex-1 gap-4 h-full w-full overflow-y-auto p-1 ${
              tracks.length <= 1
                ? "grid-cols-1"
                : tracks.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : tracks.length <= 4
                ? "grid-cols-2"
                : "grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {tracks.map((trackRef) => {
              const p = trackRef.participant;
              // Uma track pode chegar sem participante durante reconexão rápida.
              if (!p) return null;
              const isScreen = trackRef.source === Track.Source.ScreenShare;
              const hasVideo = isTrackReference(trackRef) && trackRef.publication?.track && !trackRef.publication.isMuted;
              const isSpeaking = p.isSpeaking;

              return (
                <div
                  key={`${p.identity}-${trackRef.source}`}
                  data-fullscreen-tile="true"
                  className={`group relative rounded-2xl overflow-hidden bg-[#11131c] border flex items-center justify-center transition-all [&:fullscreen]:bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${
                    isSpeaking
                      ? "border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30"
                      : "border-border/80"
                  }`}
                >
                  {hasVideo && isTrackReference(trackRef) ? (
                    <VideoTrack
                      trackRef={trackRef}
                      className={`h-full w-full ${isScreen ? "object-contain" : "object-cover -scale-x-100 [&:fullscreen]:object-contain"}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/80 text-gray-300 font-bold text-2xl border border-border/80 mb-2">
                        {(p.name || p.identity).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {p.name || p.identity}
                      </span>
                    </div>
                  )}

                  {/* Controls Overlay: Stats + Fullscreen for Tile */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    {hasVideo && <TrackStatsDropdown trackRef={trackRef} size="md" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTileFullscreen(e.currentTarget.closest('[data-fullscreen-tile]') as HTMLElement);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white shadow-md hover:scale-105 transition-all"
                      title={`Tela cheia de ${isScreen ? "compartilhamento" : (p.name || p.identity)}`}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs text-white font-medium border border-white/10">
                    {isScreen && <Monitor className="h-3.5 w-3.5 text-emerald-400" />}
                    <span>{isScreen ? `Tela de ${p.name || p.identity}` : p.name || p.identity}</span>
                    {p.isLocal && <span className="text-[10px] text-indigo-400 font-bold">(Você)</span>}
                    {p.isMicrophoneEnabled ? (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Barra ancorada na arena: `absolute inset-x-0` dentro do container relativo
           em vez de `fixed` na viewport. Era ela que cobria o compositor do chat
           e o rodape da lista de participantes. */}
        <MediaControls
          isMicOn={isMicOn}
          isCamOn={isCamOn}
          isScreenSharing={isScreenSharing}
          isChatOpen={isChatOpen}
          isParticipantsOpen={isParticipantsOpen}
          isFocusLayout={isFocusLayout}
          participantCount={participants.length + 1}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleScreenShare={toggleScreenShare}
          onToggleChat={() => {
            setIsChatOpen(!isChatOpen);
            if (isParticipantsOpen) setIsParticipantsOpen(false);
          }}
          onToggleParticipants={() => {
            setIsParticipantsOpen(!isParticipantsOpen);
            if (isChatOpen) setIsChatOpen(false);
          }}
          onToggleLayout={() => setIsFocusLayout(!isFocusLayout)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLeave={handleLeave}

        />

      </div>

      {/* Sidebars */}
      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <ParticipantsList
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
      />


      {/* Advanced Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        isScreenSharing={isScreenSharing}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          void applyMediaSettings(newSettings);
        }}
        devices={devices}
      />
    </div>
  );
}
