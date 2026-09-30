"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  isTrackReference,
  useConnectionState,
  useRoomContext,
  useTracks,
  VideoTrack,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { MediaControls } from "./MediaControls";
import { ParticipantsList } from "./ParticipantsList";
import { SettingsModal, type MediaSettings } from "./SettingsModal";
import { TrackStatsDropdown } from "./TrackStatsDropdown";
import { consumeCapture } from "@/components/site/capturePrefs";
import { Stamp } from "@/components/sheet";
import { ChevronLeft, LogOut, Maximize2, MessageSquare, Users } from "lucide-react";

/** Nomes de erro de mídia que valem uma explicação, e não um "erro desconhecido". */
const MEDIA_ERROR_NAMES = new Set([
  "NotReadableError",
  "NotAllowedError",
  "NotFoundError",
  "OverconstrainedError",
  "NotSupportedError",
  "AbortError",
]);

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error && MEDIA_ERROR_NAMES.has(error.name) ? error.name : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const RESOLUTION: Record<MediaSettings["screenResolution"], { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
};

export interface ConferenceRoomProps {
  token: string;
  serverUrl: string;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
}

/**
 * A sala é uma folha com um instrumento montado nela.
 *
 * O papel é branco e pautado; o monitor é escuro, e isso não é uma concessão ao
 * tema antigo. É a mesma lógica de quem julga imagem: a face de um scope é
 * escura de propósito, porque é contra um fundo neutro que se avalia o que está
 * sendo mostrado. Ao redor do monitor, tudo é régua.
 */
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
  // Uma saída pedida pelo usuário não é queda de conexão: sem isto, o botão
  // Sair dispararia o banner de erro logo depois de funcionar.
  const userInitiatedLeave = useRef(false);

  function handleOnError(error: Error) {
    console.error("LiveKit Room disconnected:", error);
    if (userInitiatedLeave.current) return;
    const name = getErrorName(error);
    setFatalError(
      name
        ? `Não foi possível abrir um dispositivo (${name}). Você entrou sem ele — pode tentar de novo em Configurações de mídia.`
        : "A conexão com a conferência foi interrompida.",
    );
  }

  function handleOnDisconnected(reason?: DisconnectReason) {
    // O motivo é a única pista de por que a sala caiu: participante removido,
    // token expirado ou SFU reiniciado dão consertos completamente diferentes.
    console.info("LiveKit encerrado. Motivo:", reason ?? "desconhecido");
    if (userInitiatedLeave.current) return;
    setFatalError("A conexão com a conferência foi interrompida.");
  }

  return (
    <>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
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
        onError={handleOnError}
        onConnected={() => setFatalError(null)}
        onDisconnected={handleOnDisconnected}
        options={{
          adaptiveStream: { pixelDensity: 1, pauseVideoInBackground: true },
          dynacast: true,
          webAudioMix: true,
          stopLocalTrackOnUnpublish: true,
          publishDefaults: {
            screenShareEncoding: { maxBitrate: 2_500_000, maxFramerate: 30, priority: "high" },
            degradationPreference: "maintain-resolution",
          },
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <RoomAudioRenderer />
        <ConferenceStage
          token={token}
          mediaError={mediaError}
          onDismissMediaError={() => setMediaError(null)}
          onLeave={() => {
            userInitiatedLeave.current = true;
            router.push("/");
          }}
        />
      </LiveKitRoom>

      {fatalError ? (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-sheet px-4 py-3 sm:px-6"
        >
          <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-3">
            <p className="text-[0.875rem] text-alert">{fatalError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="border border-rule-2 bg-sheet px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-band [border-radius:var(--radius-sheet)]"
              >
                Reconectar
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="border border-transparent px-3 py-1.5 text-[0.8125rem] text-ink-2 transition-colors hover:text-ink [border-radius:var(--radius-sheet)]"
              >
                Início
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConferenceStage({
  token,
  mediaError,
  onDismissMediaError,
  onLeave,
}: {
  token: string;
  mediaError: string | null;
  onDismissMediaError: () => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const room = useRoomContext();
  const localParticipant = room.localParticipant;
  const connectionState = useConnectionState();

  // A régua chega do lobby já posicionada: quem mexeu na banda da home entra
  // com a mesma escolha, e a folha não repete a pergunta.
  const [settings, setSettings] = useState<MediaSettings>(() => {
    const prefs = consumeCapture();
    return {
      screenFps: Number(prefs.frameRate),
      screenResolution: prefs.resolution,
      screenContentType: prefs.contentHint,
      systemAudio: prefs.systemAudio,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  });
  // `applyMediaSettings` é async e lê a régua no momento da aplicação; sem um
  // espelho síncrono, dois ajustes seguidos partiriam do mesmo estado velho.
  const settingsRef = useRef<MediaSettings>(settings);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [unstableConnection, setUnstableConnection] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [devices, setDevices] = useState({
    audioInputs: [] as MediaDeviceInfo[],
    videoInputs: [] as MediaDeviceInfo[],
    audioOutputs: [] as MediaDeviceInfo[],
  });

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // `useTracks` devolve placeholders para câmera ainda não prevista. O
  // `<VideoTrack>` e o painel de estatísticas só querem tracks de verdade, e
  // passar o guard direto ao `filter` é o que estreita o tipo do elemento.
  const subscribed = tracks.filter(isTrackReference);
  const screenShareRefs = subscribed.filter((t) => t.source === Track.Source.ScreenShare);
  const cameraRefs = subscribed.filter((t) => t.source === Track.Source.Camera);

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;
  const hasActiveScreenShare = screenShareRefs.length > 0;

  const loadDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: list.filter((d) => d.kind === "audioinput"),
        videoInputs: list.filter((d) => d.kind === "videoinput"),
        audioOutputs: list.filter((d) => d.kind === "audiooutput"),
      });
    } catch (error) {
      console.error("Could not enumerate devices:", error);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // O token do LiveKit expira; sem trocar o token da engine, o SFU derruba a
  // sala na renewal seguinte mesmo com tudo saudável.
  useEffect(() => {
    (room as unknown as { engine: { token: string } }).engine.token = token;
  }, [room, token]);

  useEffect(() => {
    function onQuality(quality: ConnectionQuality, participant: Participant) {
      if (participant.isLocal && quality === ConnectionQuality.Poor) setUnstableConnection(true);
    }
    function onAudioPlayback(playing: boolean) {
      setAudioBlocked(!playing);
    }
    function onDevices() {
      void loadDevices();
    }

    room
      .on(RoomEvent.ConnectionQualityChanged, onQuality)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
      .on(RoomEvent.MediaDevicesChanged, onDevices);

    return () => {
      room
        .off(RoomEvent.ConnectionQualityChanged, onQuality)
        .off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
        .off(RoomEvent.MediaDevicesChanged, onDevices);
    };
  }, [room, loadDevices]);

  const toggleMic = useCallback(async () => {
    const current = settingsRef.current;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicOn, {
        deviceId: current.audioInputId,
        echoCancellation: current.echoCancellation,
        noiseSuppression: current.noiseSuppression,
        autoGainControl: current.autoGainControl,
      });
    } catch (error) {
      console.error("Erro ao alternar microfone:", error);
      throw new Error("O navegador recusou o microfone selecionado.");
    }
  }, [localParticipant, isMicOn]);

  const toggleCam = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCamOn, {
        deviceId: settingsRef.current.videoInputId,
      });
    } catch (error) {
      console.error("Erro ao alternar câmera:", error);
      throw new Error("O navegador recusou a câmera selecionada.");
    }
  }, [localParticipant, isCamOn]);

  const toggleScreenShare = useCallback(async () => {
    const current = settingsRef.current;
    if (isScreenSharing) {
      try {
        await localParticipant.setScreenShareEnabled(false);
      } catch (error) {
        console.error("Erro ao compartilhar tela:", error);
      }
      return;
    }

    const is4k = current.screenResolution === "4k";
    const { width, height } = RESOLUTION[current.screenResolution];
    const contentHint = current.screenContentType === "detail" ? "detail" : "motion";
    const publishOptions: TrackPublishOptions = {
      screenShareEncoding: {
        maxBitrate: is4k ? 5_000_000 : 2_500_000,
        maxFramerate: current.screenFps,
        priority: "high",
      },
      simulcast: is4k,
      degradationPreference: "maintain-resolution",
    };

    try {
      await localParticipant.setScreenShareEnabled(
        true,
        {
          audio: current.systemAudio,
          contentHint,
          resolution: { width, height, frameRate: current.screenFps },
        },
        publishOptions,
      );
      setScreenShareError(null);
    } catch (error) {
      const message = getErrorMessage(error);
      // O Windows em modo exclusivo recusa a faixa de áudio do sistema, mas a
      // tela ainda pode ir. Perder a chamada inteira por causa do som seria
      // cobrar caro demais por um recurso opcional.
      if (
        current.systemAudio &&
        (getErrorName(error) === "NotReadableError" || /audio/i.test(message))
      ) {
        try {
          await localParticipant.setScreenShareEnabled(
            true,
            {
              audio: false,
              contentHint,
              resolution: { width, height, frameRate: current.screenFps },
            },
            publishOptions,
          );
          setScreenShareError(
            "Áudio do sistema não pôde ser capturado (modo exclusivo do Windows). Compartilhando apenas o vídeo...",
          );
          return;
        } catch (fallbackError) {
          console.error("Erro ao compartilhar tela:", fallbackError);
          setScreenShareError(
            `Não foi possível compartilhar a tela: ${getErrorMessage(fallbackError)}`,
          );
          return;
        }
      }
      console.error("Erro ao compartilhar tela:", error);
      setScreenShareError(`Não foi possível compartilhar a tela: ${message}`);
    }
  }, [localParticipant, isScreenSharing]);

  const resumeAudioPlayback = useCallback(async () => {
    try {
      await room.startAudio();
      setAudioBlocked(false);
    } catch (error) {
      console.error("Não foi possível retomar o áudio:", error);
    }
  }, [room]);

  /**
   * Aplica um patch na régua, ou não aplica nada.
   *
   * Cada grupo volta atrás sozinho se o navegador recusar. A faixa de tela é
   * mais limitada que a do lobby, e um ajuste de microfone que não pegou não
   * pode deixar a folha mentindo sobre o que está valendo.
   */
  const applyMediaSettings = useCallback(
    async (patch: Partial<MediaSettings>) => {
      const previous = settingsRef.current;
      const next = { ...previous, ...patch };
      const rollback = () => {
        settingsRef.current = previous;
        setSettings(previous);
      };

      const touchesProcessors =
        patch.echoCancellation !== undefined ||
        patch.noiseSuppression !== undefined ||
        patch.autoGainControl !== undefined;

      // `applyConstraints` e NÃO `restartTrack`: o restart reconstrói as
      // constraints a partir das opções do room e perde o `deviceId` escolhido.
      if (touchesProcessors) {
        const track = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        if (track instanceof LocalAudioTrack) {
          try {
            await track.applyConstraints({
              echoCancellation: next.echoCancellation,
              noiseSuppression: next.noiseSuppression,
              autoGainControl: next.autoGainControl,
            });
          } catch (error) {
            console.error("Erro ao aplicar aprimoramentos de microfone:", error);
            rollback();
            return;
          }
        }
      }

      // `switchActiveDevice` e não `setMicrophoneEnabled(true, { deviceId })`:
      // com a track já publicada, aquele overload só faz `unmute()` e ignora as
      // opções. `"default"` é o que o item vazio do `select` significa.
      if (patch.audioInputId !== undefined) {
        try {
          const switched = await room.switchActiveDevice(
            "audioinput",
            patch.audioInputId ?? "default",
          );
          if (!switched) throw new Error("O navegador recusou o microfone selecionado.");
        } catch (error) {
          console.error("Erro ao trocar o microfone:", error);
          rollback();
          return;
        }
      }
      if (patch.videoInputId !== undefined) {
        try {
          const switched = await room.switchActiveDevice(
            "videoinput",
            patch.videoInputId ?? "default",
          );
          if (!switched) throw new Error("O navegador recusou a câmera selecionada.");
        } catch (error) {
          console.error("Erro ao trocar a câmera:", error);
          rollback();
          return;
        }
      }
      if (patch.audioOutputId !== undefined) {
        const sinkSupported =
          supportsAudioOutputSelection() ||
          (typeof window !== "undefined" &&
            typeof window.AudioContext !== "undefined" &&
            "setSinkId" in window.AudioContext.prototype);
        if (sinkSupported) {
          try {
            await room.switchActiveDevice("audiooutput", patch.audioOutputId ?? "default");
          } catch (error) {
            console.error("Erro ao trocar a saída de áudio:", error);
            rollback();
            return;
          }
        }
      }

      settingsRef.current = next;
      setSettings(next);
    },
    [localParticipant, room],
  );

  const handleLeave = useCallback(() => {
    void room.disconnect();
    onLeave();
  }, [room, onLeave]);

  const toggleTileFullscreen = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void element.requestFullscreen();
  }, []);

  const reconnecting =
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting;

  const statsTrack = screenShareRefs[0] ?? cameraRefs[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      {/* Avisos: régua, não toast. */}
      {(screenShareError || mediaError || unstableConnection || audioBlocked) && (
        <div className="border-b border-rule bg-band">
          {screenShareError ? (
            <WarnRow text={screenShareError} onDismiss={() => setScreenShareError(null)} />
          ) : null}
          {mediaError ? (
            <WarnRow
              text={mediaError}
              label="Dispensar aviso de mídia"
              onDismiss={onDismissMediaError}
            />
          ) : null}
          {unstableConnection ? (
            <WarnRow
              text="Conexão instável — a qualidade da sua rede caiu."
              onDismiss={() => setUnstableConnection(false)}
            />
          ) : null}
          {audioBlocked ? (
            <WarnRow
              text="O navegador bloqueou a reprodução de áudio."
              action={
                <button
                  type="button"
                  onClick={resumeAudioPlayback}
                  className="border border-rule-2 bg-sheet px-2.5 py-1 text-[0.75rem] font-semibold text-ink transition-colors hover:border-rule-3 [border-radius:var(--radius-cell)]"
                >
                  Retomar áudio
                </button>
              }
              onDismiss={() => setAudioBlocked(false)}
            />
          ) : null}
        </div>
      )}

      {reconnecting ? (
        <div className="border-b border-rule bg-signal-wash px-4 py-2 sm:px-6">
          <p className="font-mono text-[0.75rem] text-signal">
            {connectionState === ConnectionState.SignalReconnecting
              ? "Reconectando a sinalização..."
              : "Reconectando à reunião..."}
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {/* O monitor. Escuro de propósito: é contra um fundo neutro que se
              avalia o que está sendo mostrado. */}
          <div className="flex min-h-[45vh] min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Stamp state={hasActiveScreenShare ? "ativo" : "pendente"}>
                {hasActiveScreenShare ? "Compartilhando tela" : "Tela"}
              </Stamp>
              {screenShareRefs[0] ? (
                <button
                  type="button"
                  title="Tela cheia do compartilhamento"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTileFullscreen(event.currentTarget.closest("[data-fullscreen-tile]"));
                  }}
                  className="border border-rule-2 bg-sheet px-2 py-1 text-ink transition-colors hover:bg-band [border-radius:var(--radius-cell)]"
                >
                  <Maximize2 size={14} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Tela cheia do compartilhamento</span>
                </button>
              ) : null}
            </div>

            <div
              data-fullscreen-tile="true"
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden border border-rule-2 bg-monitor"
            >
              {screenShareRefs.length > 0 ? (
                screenShareRefs.map((trackRef) => (
                  <VideoTrack
                    key={`${trackRef.participant.identity}-${trackRef.source}`}
                    trackRef={trackRef}
                    className="h-full w-full object-contain"
                  />
                ))
              ) : (
                <p className="px-6 text-center text-[0.875rem] leading-[1.6] text-monitor-ink">
                  {cameraRefs.length > 0
                    ? "Ninguém está compartilhando a tela."
                    : "Compartilhe sua tela para começar."}
                </p>
              )}
            </div>
          </div>

          {/* A coluna de comando: um botão marcado por função, com o estado
              escrito embaixo. O estado nunca é só cor. */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-[17.5rem]">
            <MediaControls
              isMicOn={isMicOn}
              isCamOn={isCamOn}
              isScreenSharing={isScreenSharing}
              onToggleMic={toggleMic}
              onToggleCam={toggleCam}
              onToggleScreenShare={toggleScreenShare}
              onLeave={handleLeave}
            />

            <div className="grid grid-cols-3 gap-px border border-rule bg-rule lg:grid-cols-1 [border-radius:var(--radius-sheet)]">
              <PanelToggle
                open={isStatsOpen}
                onClick={() => setIsStatsOpen((v) => !v)}
                icon={<ActivityGlyph />}
                label="Estatísticas"
              />
              <PanelToggle
                open={isParticipantsOpen}
                onClick={() => setIsParticipantsOpen((v) => !v)}
                icon={<Users size={14} strokeWidth={1.5} aria-hidden />}
                label="Pessoas"
              />
              <PanelToggle
                open={isChatOpen}
                onClick={() => setIsChatOpen((v) => !v)}
                icon={<MessageSquare size={14} strokeWidth={1.5} aria-hidden />}
                label="Chat"
              />
            </div>

            {isStatsOpen ? (
              <TrackStatsDropdown
                trackRef={statsTrack}
                open={isStatsOpen}
                onClose={() => setIsStatsOpen(false)}
              />
            ) : null}
          </div>
        </div>

        {/* As câmeras: fiadas pequenas abaixo do monitor, como contact sheets. */}
        {cameraRefs.length > 0 ? (
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cameraRefs.map((trackRef) => {
              const p = trackRef.participant;
              return (
                <div
                  key={`${p.identity}-cam`}
                  data-fullscreen-tile="true"
                  className="overflow-hidden border border-rule-2"
                >
                  <div className="aspect-video bg-monitor">
                    <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-rule bg-sheet px-2.5 py-1.5">
                    <span className="truncate text-[0.75rem] text-ink-2">
                      {p.name || p.identity}
                      {p.isLocal ? " (Você)" : ""}
                    </span>
                    <button
                      type="button"
                      title={`Tela cheia de ${p.name || p.identity}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTileFullscreen(event.currentTarget.closest("[data-fullscreen-tile]"));
                      }}
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    >
                      <Maximize2 size={13} strokeWidth={1.5} aria-hidden />
                      <span className="sr-only">{`Tela de ${p.name || p.identity}`}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* A régua de saída: uma linha de células, largura toda, na margem. */}
      <div className="border-t border-rule bg-sheet">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
          >
            <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
            Início
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-2 border border-rule-2 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-alert-line hover:bg-alert-wash hover:text-alert [border-radius:var(--radius-sheet)]"
          >
            <LogOut size={14} strokeWidth={1.5} aria-hidden />
            Sair
          </button>
        </div>
      </div>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onApply={applyMediaSettings}
        devices={devices}
        isScreenSharing={isScreenSharing}
      />
      <ParticipantsList isOpen={isParticipantsOpen} onClose={() => setIsParticipantsOpen(false)} />
      <ChatSidebar isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

function WarnRow({
  text,
  action,
  onDismiss,
  label = "Dispensar",
}: {
  text: string;
  action?: React.ReactNode;
  onDismiss: () => void;
  label?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-rule px-4 py-2 last:border-b-0 sm:px-6"
    >
      <p className="min-w-0 flex-1 text-[0.8125rem] text-ink-2">{text}</p>
      {action}
      <button
        type="button"
        aria-label={label}
        onClick={onDismiss}
        className="shrink-0 border border-transparent px-1.5 py-0.5 text-[0.75rem] text-ink-3 transition-colors hover:text-ink"
      >
        Dispensar
      </button>
    </div>
  );
}

function PanelToggle({
  open,
  onClick,
  icon,
  label,
}: {
  open: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[0.6875rem] transition-colors ${
        open ? "bg-signal-wash text-signal" : "bg-sheet text-ink-2 hover:bg-band hover:text-ink"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Glifo desenhado na mesma espessura das teclas de biblioteca. */
function ActivityGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden
    >
      <path d="M1 11h2.5l2-6 2.5 9 2.5-12 2 9H15" />
    </svg>
  );
}
