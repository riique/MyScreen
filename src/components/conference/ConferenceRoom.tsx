"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  isTrackReference,
  useChat,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import {
  AudioPresets,
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  LocalAudioTrack,
  ParticipantEvent,
  RemoteTrackPublication,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
  supportsAudioOutputSelection,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { MediaControls } from "./MediaControls";
import { ParticipantsList } from "./ParticipantsList";
import { SettingsModal, type MediaSettings } from "./SettingsModal";
import { TrackStatsDropdown } from "./TrackStatsDropdown";
import {
  readCapture,
  writeCapture,
  type CaptureSettings,
} from "@/components/site/capturePrefs";
import { ShareDialog } from "./ShareDialog";
import { openCompanionAudio, readCompanion, type CompanionAudio } from "./companionAudio";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  ExternalLink,
  Link2,
  Maximize2,
  MessageSquare,
  MicOff,
  MonitorUp,
  PictureInPicture2,
  Pin,
  PinOff,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

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

/**
 * Orçamento de bits da tela por resolução, em 30 FPS. A qualidade é a promessa
 * do produto: o encoder recebe banda para manter o quadro nítido, e 60 FPS ganha
 * 50% a mais porque são o dobro de quadros disputando o mesmo orçamento.
 */
const SCREEN_BITRATE: Record<MediaSettings["screenResolution"], number> = {
  "720p": 3_500_000,
  "1080p": 6_000_000,
  "4k": 14_000_000,
};

function screenBitrate(resolution: MediaSettings["screenResolution"], fps: number): number {
  const factor = fps >= 60 ? 1.5 : fps <= 15 ? 0.6 : 1;
  return Math.round(SCREEN_BITRATE[resolution] * factor);
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
          // Sem adaptiveStream: ele pede ao SFU a camada do tamanho do <video>
          // na tela, multiplicado pelo devicePixelRatio. Dar zoom, redimensionar
          // a janela ou encolher o quadro na faixa lateral trocava a resolução
          // recebida. Aqui a assinatura fica sempre na camada mais alta, e o
          // navegador só escala a imagem na hora de desenhar.
          adaptiveStream: false,
          dynacast: true,
          webAudioMix: true,
          stopLocalTrackOnUnpublish: true,
          videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
          publishDefaults: {
            videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30, priority: "high" },
            screenShareEncoding: {
              maxBitrate: SCREEN_BITRATE["1080p"],
              maxFramerate: 30,
              priority: "high",
            },
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
        <div role="alert" className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
          <div className="flex w-full max-w-[34rem] flex-wrap items-center justify-between gap-3 border border-alert-line bg-sheet px-4 py-3 shadow-overlay [border-radius:var(--radius-sheet)]">
            <p className="min-w-0 flex-1 text-[0.875rem] text-alert">{fatalError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="border border-rule-2 bg-sheet px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-band [border-radius:var(--radius-cell)]"
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
  const room = useRoomContext();
  const localParticipant = room.localParticipant;
  const connectionState = useConnectionState();

  // Os ajustes de captura partem da última escolha feita no diálogo de
  // compartilhar tela, e o diálogo os confirma a cada compartilhamento.
  const [settings, setSettings] = useState<MediaSettings>(() => {
    const prefs = readCapture();
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

  const [panel, setPanel] = useState<Panel | null>(null);

  // O chat vive aqui, e não no painel: o painel desmonta ao fechar, e com ele
  // iriam o histórico e o rascunho.
  const chat = useChat();
  const [chatDraft, setChatDraft] = useState("");
  const [chatSeen, setChatSeen] = useState(0);
  const chatCount = chat.chatMessages.length;
  useEffect(() => {
    if (panel === "chat") setChatSeen(chatCount);
  }, [panel, chatCount]);
  const chatUnread = panel === "chat" ? 0 : Math.max(0, chatCount - chatSeen);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  // Quadros fixados no destaque, na ordem em que entraram. Mais de um divide o
  // palco em partes iguais (ex.: a tela de alguém ao lado da câmera dele).
  const [pinned, setPinned] = useState<string[]>([]);
  const [dockHidden, setDockHidden] = useState(readDockHidden);
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

  // A câmera vem com placeholder: quem está com ela desligada continua tendo um
  // quadro, com as iniciais, e a sala nunca "esconde" uma pessoa presente.
  const screenShareRefs = tracks
    .filter(isTrackReference)
    .filter((t) => t.source === Track.Source.ScreenShare);
  const cameraTiles = tracks.filter((t) => t.source === Track.Source.Camera);
  const cameraRefs = cameraTiles.filter(isTrackReference);

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

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

  // Áudio vindo do app MyScreen Áudio, enquanto a tela está no ar.
  const companionRef = useRef<CompanionAudio | null>(null);
  const stopCompanion = useCallback(() => {
    if (!companionRef.current) return;
    companionRef.current.close();
    companionRef.current = null;
    const audio = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
    if (audio?.track) void localParticipant.unpublishTrack(audio.track);
  }, [localParticipant]);

  // A tela pode parar pela barra do Chrome ("Parar compartilhamento"), sem
  // passar pelo botão da sala: o áudio do app tem que parar junto.
  useEffect(() => {
    const onUnpublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) stopCompanion();
    };
    localParticipant.on(ParticipantEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      localParticipant.off(ParticipantEvent.LocalTrackUnpublished, onUnpublished);
      stopCompanion();
    };
  }, [localParticipant, stopCompanion]);

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
    // Toda trilha de vídeo recebida fica presa na camada mais alta. Sem
    // adaptiveStream é isto que decide o que o SFU manda, e nada aqui depende
    // do tamanho do quadro na tela nem do zoom do navegador.
    function pinHighQuality(publication: RemoteTrackPublication) {
      if (publication.kind === Track.Kind.Video) publication.setVideoQuality(VideoQuality.HIGH);
    }
    function onSubscribed(_track: unknown, publication: RemoteTrackPublication) {
      pinHighQuality(publication);
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        pinHighQuality(publication);
      }
    }

    room
      .on(RoomEvent.ConnectionQualityChanged, onQuality)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
      .on(RoomEvent.MediaDevicesChanged, onDevices)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackPublished, pinHighQuality);

    return () => {
      room
        .off(RoomEvent.ConnectionQualityChanged, onQuality)
        .off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
        .off(RoomEvent.MediaDevicesChanged, onDevices)
        .off(RoomEvent.TrackSubscribed, onSubscribed)
        .off(RoomEvent.TrackPublished, pinHighQuality);
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

  /**
   * Sem `capture`, só desliga um compartilhamento ativo. Com `capture` (vindo
   * do diálogo), grava a escolha e abre o seletor do navegador já com ela. A
   * escolha entra no `settingsRef` antes do `getDisplayMedia`: esperar o
   * `setState` assentar quebraria o gesto do usuário que o navegador exige.
   */
  const toggleScreenShare = useCallback(async (capture?: CaptureSettings) => {
    if (capture) {
      writeCapture(capture);
      const next: MediaSettings = {
        ...settingsRef.current,
        screenFps: Number(capture.frameRate),
        screenResolution: capture.resolution,
        screenContentType: capture.contentHint,
        systemAudio: capture.systemAudio,
      };
      settingsRef.current = next;
      setSettings(next);
    }
    const current = settingsRef.current;
    if (isScreenSharing || !capture) {
      stopCompanion();
      try {
        await localParticipant.setScreenShareEnabled(false);
      } catch (error) {
        console.error("Erro ao compartilhar tela:", error);
      }
      return;
    }

    // Com o app, o som do PC vem dele: o navegador captura só a imagem.
    const companion = current.systemAudio ? readCompanion() : null;
    const viaApp = companion?.enabled === true;
    const browserAudio = current.systemAudio && !viaApp;

    const { width, height } = RESOLUTION[current.screenResolution];
    const contentHint = current.screenContentType === "detail" ? "detail" : "motion";
    const publishOptions: TrackPublishOptions = {
      screenShareEncoding: {
        maxBitrate: screenBitrate(current.screenResolution, current.screenFps),
        maxFramerate: current.screenFps,
        priority: "high",
      },
      // Uma camada só: quem assiste recebe sempre a tela inteira, sem versão
      // reduzida que o SFU pudesse escolher no lugar dela.
      simulcast: false,
      // Quando a rede aperta, o encoder sacrifica uma coisa para salvar a
      // outra. Texto precisa de nitidez (cai a taxa); vídeo e jogo precisam
      // de fluidez (cai a resolução). É o que o "Conteúdo" da régua decide.
      degradationPreference:
        current.screenContentType === "detail" ? "maintain-resolution" : "maintain-framerate",
    };

    const captureOptions: ScreenShareCaptureOptions = {
      // Áudio do sistema CRU. Com `audio: true` o navegador pode ligar o
      // processamento de voz na faixa capturada — e o cancelamento de eco trata
      // o próprio som do PC como eco do alto-falante e o apaga. Música, vídeo e
      // jogo não são voz: nada de AEC, supressão de ruído ou ganho automático.
      audio: browserAudio
        ? {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        : false,
      // Pede ao Chrome para oferecer a caixa "Compartilhar áudio do sistema"
      // na tela inteira, e para não silenciar o som local durante a captura.
      systemAudio: browserAudio ? "include" : "exclude",
      suppressLocalAudioPlayback: false,
      contentHint,
      resolution: { width, height, frameRate: current.screenFps },
    };

    try {
      await localParticipant.setScreenShareEnabled(true, captureOptions, publishOptions);
      setScreenShareError(null);

      if (viaApp && companion) {
        try {
          const audio = await openCompanionAudio(companion.code, () => {
            companionRef.current = null;
            const pub = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
            if (pub?.track) void localParticipant.unpublishTrack(pub.track);
            setScreenShareError(
              "O app MyScreen Áudio desconectou. A tela continua no ar, mas sem o som do PC.",
            );
          });
          companionRef.current = audio;
          await localParticipant.publishTrack(audio.track, {
            source: Track.Source.ScreenShareAudio,
            name: "screen_share_audio",
            audioPreset: AudioPresets.musicHighQualityStereo,
            forceStereo: true,
            dtx: false,
            red: false,
          });
        } catch (error) {
          console.error("Erro ao conectar ao MyScreen Áudio:", error);
          stopCompanion();
          setScreenShareError(
            "Não conectou ao app MyScreen Áudio. Confira se ele está aberto e se o código é o mesmo que aparece nele. A tela está no ar sem o som do PC.",
          );
        }
        return;
      }

      // O navegador não dá erro quando entrega a tela sem som: só não inclui a
      // faixa. Acontece quando a caixa de áudio fica desmarcada, quando se
      // escolhe uma janela avulsa, ou no Firefox/Safari, que não capturam o
      // áudio do sistema. A pessoa precisa saber disso agora, não pelo colega.
      if (
        browserAudio &&
        !localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)
      ) {
        setScreenShareError(
          "A tela foi compartilhada sem áudio. No seletor do navegador, escolha a tela inteira ou uma aba e marque “Compartilhar áudio do sistema” (ou “da aba”). Janelas avulsas não levam áudio, e o Firefox e o Safari não capturam o som do sistema.",
        );
      }
    } catch (error) {
      const name = getErrorName(error) ?? (error instanceof Error ? error.name : "Erro");
      const message = getErrorMessage(error);
      console.error("Erro ao compartilhar tela com áudio:", error);

      // A pessoa fechou o seletor: não é falha, não abre outro seletor. O
      // bloqueio do sistema operacional ("Permission denied by system") é
      // outra coisa e segue para a mensagem.
      if (name === "AbortError" || (name === "NotAllowedError" && !/system/i.test(message))) {
        return;
      }

      // O navegador recusou a faixa de áudio, mas a tela ainda pode ir. Perder
      // a transmissão inteira por causa do som seria caro demais.
      if (
        browserAudio &&
        (name === "NotReadableError" || /audio/i.test(message))
      ) {
        try {
          await localParticipant.setScreenShareEnabled(
            true,
            { ...captureOptions, audio: false, systemAudio: "exclude" },
            publishOptions,
          );
          setScreenShareError(
            `O navegador recusou o áudio do sistema (${name}: ${message}). A tela está indo só com vídeo. No Windows, isso costuma acontecer com fone em 7.1/surround. Para levar o som do PC mesmo assim, use o app MyScreen Áudio (opção no diálogo de compartilhar).`,
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
      setScreenShareError(`Não foi possível compartilhar a tela (${name}): ${message}`);
    }
  }, [localParticipant, isScreenSharing, stopCompanion]);

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

  /* --- Tela cheia ---------------------------------------------------------
     Duas escalas: a chamada inteira (botão da doca, com os controles junto) e
     um quadro só (botão no próprio quadro, ou duplo clique). */
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreenEl, setFullscreenEl] = useState<Element | null>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () => setFullscreenEl(document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback((element: Element | null) => {
    if (!element) return;
    if (document.fullscreenElement === element) {
      void document.exitFullscreen();
      return;
    }
    void element.requestFullscreen().catch((error: unknown) => {
      console.error("Tela cheia recusada:", error);
    });
  }, []);

  /** Um erro de microfone/câmera vira aviso na régua, nunca promessa rejeitada solta. */
  const guard = useCallback(
    (action: () => Promise<void>) => () => {
      action().catch((error: unknown) => setControlError(getErrorMessage(error)));
    },
    [],
  );

  /* --- Composição do palco -----------------------------------------------
     Um quadro em destaque quando há o que destacar: o fixado pela pessoa, ou
     então a primeira tela compartilhada. Sem destaque, as câmeras dividem o
     palco numa grade que se recalcula com o espaço. */
  const allTiles: TrackReferenceOrPlaceholder[] = [...screenShareRefs, ...cameraTiles];
  const pinnedTiles = pinned
    .map((key) => allTiles.find((t) => tileKey(t) === key))
    .filter((t): t is TrackReferenceOrPlaceholder => t !== undefined);
  const focusTiles =
    pinnedTiles.length > 0 ? pinnedTiles : screenShareRefs[0] ? [screenShareRefs[0]] : [];
  const focusKeys = focusTiles.map(tileKey);
  const focus = focusTiles[0];
  const strip = focus ? allTiles.filter((t) => !focusKeys.includes(tileKey(t))) : [];

  /** Fixar troca o destaque por este quadro; num quadro já fixado, solta. */
  const togglePin = useCallback((key: string) => {
    setPinned((current) => (current.includes(key) ? current.filter((k) => k !== key) : [key]));
  }, []);

  /** Lado a lado: soma o quadro ao que já está em destaque, em tamanho igual. */
  const focusKeysJoined = focusKeys.join("|");
  const addSideBySide = useCallback(
    (key: string) => {
      const base = focusKeysJoined ? focusKeysJoined.split("|") : [];
      setPinned(base.includes(key) ? base : [...base, key]);
    },
    [focusKeysJoined],
  );

  /* --- Janelas separadas --------------------------------------------------
     Um quadro pode ir para uma janela própria (para arrastar a outro monitor).
     A janela é `about:blank` da mesma origem: o vídeo dela usa a MESMA trilha
     já recebida aqui, sem nova assinatura no SFU. Ela segue a trilha se ela
     for trocada e fecha quando o quadro some (a pessoa parou a tela ou saiu). */
  const popouts = useRef(new Map<string, Popout>());

  const openPopout = useCallback((trackRef: TrackReferenceOrPlaceholder, label: string) => {
    const key = tileKey(trackRef);
    const existing = popouts.current.get(key);
    if (existing && !existing.win.closed) {
      existing.win.focus();
      return;
    }
    const track = trackRef.publication?.track?.mediaStreamTrack;
    if (!track) {
      setControlError("Este quadro ainda não tem vídeo para abrir em outra janela.");
      return;
    }
    const isScreen = trackRef.source === Track.Source.ScreenShare;
    const win = window.open(
      "",
      `myscreen-${key.replace(/[^a-z0-9]/gi, "-")}`,
      isScreen ? "popup,width=1280,height=720" : "popup,width=640,height=360",
    );
    if (!win) {
      setControlError("O navegador bloqueou a nova janela. Libere pop-ups para este site e tente de novo.");
      return;
    }
    const video = mountPopout(win, label, trackRef.participant.isLocal && !isScreen);
    video.srcObject = new MediaStream([track]);
    popouts.current.set(key, { win, video, track });
  }, []);

  useEffect(() => {
    for (const [key, popout] of popouts.current) {
      const tile = allTiles.find((t) => tileKey(t) === key);
      const track = tile?.publication?.track?.mediaStreamTrack;
      if (popout.win.closed || !tile) {
        if (!popout.win.closed) popout.win.close();
        popouts.current.delete(key);
      } else if (track && track !== popout.track) {
        popout.video.srcObject = new MediaStream([track]);
        popout.track = track;
      }
    }
  });

  useEffect(() => {
    const map = popouts.current;
    const closeAll = () => {
      for (const { win } of map.values()) if (!win.closed) win.close();
      map.clear();
    };
    window.addEventListener("pagehide", closeAll);
    return () => {
      window.removeEventListener("pagehide", closeAll);
      closeAll();
    };
  }, []);

  const toggleDock = useCallback(() => {
    setDockHidden((hidden) => {
      writeDockHidden(!hidden);
      return !hidden;
    });
  }, []);

  const participantCount = useParticipants().length;
  // `room.name` só chega depois do join; o id da rota existe desde o primeiro quadro.
  const params = useParams<{ id?: string }>();
  const roomLabel = room.name || params?.id || "";

  const reconnecting =
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting;

  const statsTrack = (focus && isTrackReference(focus) ? focus : undefined) ?? screenShareRefs[0] ?? cameraRefs[0];

  const notices = [
    screenShareError
      ? { key: "screen", text: screenShareError, dismiss: () => setScreenShareError(null) }
      : null,
    controlError
      ? { key: "control", text: controlError, dismiss: () => setControlError(null) }
      : null,
    mediaError ? { key: "media", text: mediaError, dismiss: onDismissMediaError } : null,
    unstableConnection
      ? {
          key: "net",
          text: "Conexão instável: a qualidade da sua rede caiu.",
          dismiss: () => setUnstableConnection(false),
        }
      : null,
  ].filter((n): n is { key: string; text: string; dismiss: () => void } => n !== null);

  const shareInitial = useMemo<CaptureSettings>(
    () => ({
      resolution: settings.screenResolution,
      frameRate: String(settings.screenFps) as CaptureSettings["frameRate"],
      contentHint: settings.screenContentType,
      systemAudio: settings.systemAudio,
    }),
    [settings.screenResolution, settings.screenFps, settings.screenContentType, settings.systemAudio],
  );
  const closeShareDialog = useCallback(() => setIsShareDialogOpen(false), []);

  const tileProps = {
    pinnedKeys: pinned,
    canSideBySide: focus !== undefined,
    onSideBySide: addSideBySide,
    onPopout: openPopout,
    fullscreenEl,
    onTogglePin: togglePin,
    onToggleFullscreen: toggleFullscreen,
  };

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-50 flex flex-col overscroll-none bg-paper text-ink"
    >
      {/* --- Barra superior --------------------------------------------- */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-rule bg-sheet/80 px-3 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden text-[0.9375rem] font-semibold tracking-[-0.02em] sm:inline">
            My<span className="text-signal">Screen</span>
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-rule-2 sm:block" />
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                reconnecting ? "animate-pulse bg-warn-dot" : "bg-signal",
              )}
            />
            <span className="truncate font-mono text-[0.8125rem] text-ink-2">{roomLabel}</span>
          </span>
          {reconnecting ? (
            <span className="hidden text-[0.75rem] text-warn sm:inline">
              {connectionState === ConnectionState.SignalReconnecting
                ? "Reconectando a sinalização..."
                : "Reconectando..."}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <CopyLinkButton />
          <span aria-hidden className="mx-1 h-4 w-px bg-rule-2" />
          <BarToggle
            label="Pessoas"
            open={panel === "people"}
            onClick={() => setPanel((p) => (p === "people" ? null : "people"))}
            badge={participantCount}
          >
            <Users size={17} strokeWidth={1.75} aria-hidden />
          </BarToggle>
          <BarToggle
            label="Chat"
            open={panel === "chat"}
            onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}
            badge={chatUnread > 0 ? chatUnread : undefined}
            badgeTone="signal"
          >
            <MessageSquare size={17} strokeWidth={1.75} aria-hidden />
          </BarToggle>
          <BarToggle
            label="Estatísticas"
            open={panel === "stats"}
            onClick={() => setPanel((p) => (p === "stats" ? null : "stats"))}
          >
            <Activity size={17} strokeWidth={1.75} aria-hidden />
          </BarToggle>
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-rule-2 sm:block" />
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
        </div>
      </header>

      {/* --- Avisos ------------------------------------------------------ */}
      {notices.length > 0 || audioBlocked ? (
        <div className="shrink-0 border-b border-rule bg-band">
          {notices.map((n) => (
            <Notice key={n.key} text={n.text} onDismiss={n.dismiss} />
          ))}
          {audioBlocked ? (
            <Notice
              text="O navegador bloqueou a reprodução de áudio."
              onDismiss={() => setAudioBlocked(false)}
              action={
                <button
                  type="button"
                  onClick={resumeAudioPlayback}
                  className="border border-rule-2 bg-sheet px-2.5 py-1 text-[0.75rem] font-semibold text-ink transition-colors hover:border-rule-3 [border-radius:var(--radius-cell)]"
                >
                  Retomar áudio
                </button>
              }
            />
          ) : null}
        </div>
      ) : null}

      {/* --- Palco + painel --------------------------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
          {focusTiles.length > 1 ? (
            // Divisão: só os quadros escolhidos, sem faixa lateral, cada um com
            // a maior fatia possível do palco.
            <SplitStage tiles={focusTiles} tileProps={tileProps} onExit={() => setPinned([])} />
          ) : focus ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1">
                <Tile trackRef={focus} variant="stage" {...tileProps} />
              </div>
              {strip.length > 0 ? (
                <div className="flex h-[7.5rem] shrink-0 gap-3 overflow-x-auto sm:h-[9rem] lg:h-auto lg:w-[15rem] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto xl:w-[17rem]">
                  {strip.map((t) => (
                    <div
                      key={tileKey(t)}
                      className="aspect-video h-full shrink-0 lg:h-auto lg:w-full"
                    >
                      <Tile trackRef={t} variant="strip" {...tileProps} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : cameraTiles.length > 0 ? (
            <CameraGrid tiles={cameraTiles} tileProps={tileProps} />
          ) : (
            <EmptyStage onShare={() => setIsShareDialogOpen(true)} />
          )}
        </main>

        {panel ? (
          <div className="absolute inset-0 z-10 flex min-h-0 flex-col border-l border-rule bg-sheet sm:static sm:w-[22rem] sm:shrink-0">
            {panel === "chat" ? (
              <ChatSidebar
                isOpen
                onClose={() => setPanel(null)}
                chatMessages={chat.chatMessages}
                send={chat.send}
                isSending={chat.isSending}
                draft={chatDraft}
                onDraftChange={setChatDraft}
              />
            ) : panel === "people" ? (
              <ParticipantsList isOpen onClose={() => setPanel(null)} />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <TrackStatsDropdown trackRef={statsTrack} open onClose={() => setPanel(null)} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* --- Doca --------------------------------------------------------
         Recolhível: escondida, sobra só uma alça no rodapé e o palco ganha a
         altura inteira. A escolha fica no navegador. */}
      {dockHidden ? (
        <button
          type="button"
          onClick={toggleDock}
          aria-label="Mostrar controles"
          title="Mostrar controles"
          className={cn(DOCK_HANDLE, "bottom-0 z-20")}
        >
          <ChevronUp size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <footer
        hidden={dockHidden}
        className="relative shrink-0 border-t border-rule bg-sheet/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={toggleDock}
          aria-label="Esconder controles"
          title="Esconder controles"
          className={cn(DOCK_HANDLE, "-top-6")}
        >
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </button>
        <MediaControls
          isMicOn={isMicOn}
          isCamOn={isCamOn}
          isScreenSharing={isScreenSharing}
          isFullscreen={fullscreenEl === shellRef.current && fullscreenEl !== null}
          canFullscreen={canFullscreen}
          onToggleMic={guard(toggleMic)}
          onToggleCam={guard(toggleCam)}
          onToggleScreenShare={() =>
            isScreenSharing ? void toggleScreenShare() : setIsShareDialogOpen(true)
          }
          onToggleFullscreen={() => toggleFullscreen(shellRef.current)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLeave={handleLeave}
        />
      </footer>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onApply={applyMediaSettings}
        devices={devices}
      />

      <ShareDialog
        open={isShareDialogOpen}
        initial={shareInitial}
        onClose={closeShareDialog}
        onConfirm={(capture) => {
          setIsShareDialogOpen(false);
          void toggleScreenShare(capture);
        }}
      />
    </div>
  );
}

type Panel = "chat" | "people" | "stats";

type Popout = { win: Window; video: HTMLVideoElement; track: MediaStreamTrack };

/**
 * Monta a página da janela separada: só o vídeo, em fundo preto. Duplo clique
 * alterna a tela cheia, e o cursor some depois de um tempo parado.
 */
function mountPopout(win: Window, title: string, mirror: boolean): HTMLVideoElement {
  const doc = win.document;
  doc.title = `${title} · MyScreen`;
  doc.body.replaceChildren();
  doc.body.style.cssText = "margin:0;background:#000;overflow:hidden;height:100vh";

  const video = doc.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = `display:block;width:100vw;height:100vh;object-fit:contain${
    mirror ? ";transform:scaleX(-1)" : ""
  }`;
  doc.body.append(video);

  video.addEventListener("dblclick", () => {
    if (doc.fullscreenElement) void doc.exitFullscreen();
    else void doc.documentElement.requestFullscreen().catch(() => {});
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const wake = () => {
    doc.body.style.cursor = "";
    clearTimeout(timer);
    timer = setTimeout(() => {
      doc.body.style.cursor = "none";
    }, FULLSCREEN_IDLE_MS);
  };
  doc.addEventListener("pointermove", wake);
  wake();

  return video;
}

const DOCK_HANDLE =
  "absolute left-1/2 flex h-6 w-16 -translate-x-1/2 items-center justify-center border border-b-0 border-rule-2 bg-sheet/85 text-ink-2 backdrop-blur-md transition-colors hover:bg-band hover:text-ink [border-radius:var(--radius-cell)_var(--radius-cell)_0_0]";

const DOCK_HIDDEN_KEY = "myscreen:dock-hidden";

function readDockHidden(): boolean {
  try {
    return localStorage.getItem(DOCK_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDockHidden(hidden: boolean) {
  try {
    localStorage.setItem(DOCK_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // Sem storage, a escolha vale só para esta sessão.
  }
}

function tileKey(t: TrackReferenceOrPlaceholder): string {
  return `${t.participant.identity}:${t.source}`;
}

type TileShared = {
  pinnedKeys: string[];
  canSideBySide: boolean;
  onSideBySide: (key: string) => void;
  onPopout: (trackRef: TrackReferenceOrPlaceholder, label: string) => void;
  fullscreenEl: Element | null;
  onTogglePin: (key: string) => void;
  onToggleFullscreen: (element: Element | null) => void;
};

/* ---------------------------------------------------------------------------
   Grade de câmeras

   Mede o palco e escolhe o número de colunas que dá o MAIOR quadro 16:9
   possível. Um, dois ou nove participantes: o palco é sempre preenchido, e
   redimensionar a janela recalcula na hora.
   ------------------------------------------------------------------------ */
const GRID_GAP = 12;
const ASPECT = 16 / 9;

/* ---------------------------------------------------------------------------
   Palco dividido

   Os quadros fixados lado a lado repartem o palco inteiro em células iguais.
   Diferente da grade de câmeras, a célula não é um 16:9 encolhido: ela ocupa
   toda a fatia, e o vídeo (contain) cresce até onde o formato dele deixa. O
   número de colunas é o que dá a maior imagem 16:9 visível em cada célula, então
   num monitor largo duas telas ficam lado a lado, e num estreito, empilhadas.
   ------------------------------------------------------------------------ */
function SplitStage({
  tiles,
  tileProps,
  onExit,
}: {
  tiles: TrackReferenceOrPlaceholder[];
  tileProps: TileShared;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = tiles.length;
  let bestCols = 1;
  let bestW = -1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (box.w - GRID_GAP * (cols - 1)) / cols;
    const cellH = (box.h - GRID_GAP * (rows - 1)) / rows;
    const visible = Math.min(cellW, cellH * ASPECT);
    if (visible > bestW) {
      bestW = visible;
      bestCols = cols;
    }
  }
  const rows = Math.ceil(n / bestCols);

  return (
    <div className="group/split relative flex min-h-0 flex-1">
      <div
        ref={ref}
        className="grid min-h-0 min-w-0 flex-1"
        style={{
          gap: GRID_GAP,
          gridTemplateColumns: `repeat(${bestCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((t) => (
          <div key={tileKey(t)} className="flex min-h-0 min-w-0">
            <Tile trackRef={t} variant="stage" {...tileProps} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1.5 text-[0.75rem] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/split:opacity-100 hover:bg-black/75 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <X size={13} strokeWidth={2} aria-hidden />
        Desfazer divisão
      </button>
    </div>
  );
}

function CameraGrid({
  tiles,
  tileProps,
}: {
  tiles: TrackReferenceOrPlaceholder[];
  tileProps: TileShared;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = tiles.length;
  let best = { w: 0, h: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const maxW = (box.w - GRID_GAP * (cols - 1)) / cols;
    const maxH = (box.h - GRID_GAP * (rows - 1)) / rows;
    const w = Math.max(0, Math.min(maxW, maxH * ASPECT));
    if (w > best.w) best = { w, h: w / ASPECT };
  }

  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center"
      style={{ gap: GRID_GAP }}
    >
      {box.w > 0
        ? tiles.map((t) => (
            <div
              key={tileKey(t)}
              className="transition-[width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: Math.floor(best.w), height: Math.floor(best.h) }}
            >
              <Tile trackRef={t} variant="grid" {...tileProps} />
            </div>
          ))
        : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Quadro

   O vídeo fica sobre o fundo do monitor, escuro nos dois temas: é contra preto
   que se avalia imagem. Tela compartilhada nunca é cortada (contain); câmera
   preenche o quadro na grade e na faixa, e aparece inteira no destaque.
   ------------------------------------------------------------------------ */
function Tile({
  trackRef,
  variant,
  pinnedKeys,
  canSideBySide,
  onSideBySide,
  onPopout,
  fullscreenEl,
  onTogglePin,
  onToggleFullscreen,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  variant: "stage" | "grid" | "strip";
} & TileShared) {
  const ref = useRef<HTMLDivElement>(null);
  const participant = trackRef.participant;
  const key = tileKey(trackRef);
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const isPinned = pinnedKeys.includes(key);
  const isFullscreen = fullscreenEl !== null && fullscreenEl === ref.current;

  const speaking = useIsSpeaking(participant);
  const micMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
    publication: participant.getTrackPublication(Track.Source.Microphone),
  });
  const videoMuted = useIsMuted(trackRef);
  const hasVideo = isTrackReference(trackRef) && !videoMuted;

  const name = participant.name || participant.identity || (participant.isLocal ? "Você" : "Participante");
  const label = isScreen
    ? participant.isLocal
      ? "Sua tela"
      : `Tela de ${name}`
    : participant.isLocal && name !== "Você"
      ? `${name} (você)`
      : name;
  const small = variant === "strip";

  // Em tela cheia, nome e ações só aparecem quando o mouse mexe, e somem (com
  // o cursor) depois de um tempo parado: o quadro é para ser assistido.
  const [chromeAwake, setChromeAwake] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!isFullscreen || !el) {
      setChromeAwake(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setChromeAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setChromeAwake(false), FULLSCREEN_IDLE_MS);
    };
    wake();
    el.addEventListener("pointermove", wake);
    el.addEventListener("pointerdown", wake);
    el.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("pointermove", wake);
      el.removeEventListener("pointerdown", wake);
      el.removeEventListener("keydown", wake);
    };
  }, [isFullscreen]);
  const chromeHidden = isFullscreen && !chromeAwake;

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [canPip, setCanPip] = useState(false);
  useEffect(() => {
    setCanPip(Boolean(document.pictureInPictureEnabled));
  }, []);

  const openPip = () => {
    const video = ref.current?.querySelector("video");
    if (!video) return;
    void video.requestPictureInPicture().catch((error: unknown) => {
      console.error("Janela flutuante recusada:", error);
    });
  };

  return (
    <div
      ref={ref}
      onDoubleClick={() => onToggleFullscreen(ref.current)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
      className={cn(
        "group relative flex h-full w-full items-center justify-center overflow-hidden bg-monitor ring-1 ring-rule [border-radius:var(--radius-sheet)]",
        "outline outline-2 -outline-offset-2 transition-[outline-color] duration-200",
        speaking && !isScreen ? "outline-signal" : "outline-transparent",
        isFullscreen && "[border-radius:0]",
        chromeHidden && "cursor-none",
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "h-full w-full",
            isScreen || variant === "stage" || isFullscreen ? "object-contain" : "object-cover",
            participant.isLocal && !isScreen && "-scale-x-100",
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-full bg-white/10 font-semibold text-white/85",
            small ? "size-10 text-[0.875rem]" : "size-16 text-[1.375rem] sm:size-20 sm:text-[1.75rem]",
          )}
        >
          {initials(name)}
        </span>
      )}

      {/* Identificação: sempre legível sobre qualquer imagem. */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[0.75rem] font-medium text-white backdrop-blur-sm transition-opacity duration-300",
          chromeHidden && "opacity-0",
        )}
      >
        {isScreen ? (
          <MonitorUp size={12} strokeWidth={2} aria-hidden className="shrink-0" />
        ) : micMuted ? (
          <MicOff size={12} strokeWidth={2} aria-hidden className="shrink-0 text-[#ff9b8a]" />
        ) : null}
        <span className="truncate">{label}</span>
        {!isScreen && micMuted ? <span className="sr-only">, microfone mudo</span> : null}
      </div>

      {/* Ações do quadro: aparecem no hover e no foco; no toque, sempre. Em
          tela cheia, só enquanto o mouse se mexe. */}
      <div
        className={cn(
          "absolute top-2 right-2 flex gap-1 transition-opacity duration-150",
          isFullscreen
            ? chromeHidden
              ? "pointer-events-none opacity-0 duration-300"
              : "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {isScreen && !participant.isLocal ? (
          <ScreenVolume participant={participant as RemoteParticipant} />
        ) : null}
        {variant === "strip" && canSideBySide ? (
          <TileAction
            label={`Pôr ${label} lado a lado no destaque`}
            onClick={() => onSideBySide(key)}
          >
            <Columns2 size={14} strokeWidth={1.75} aria-hidden />
          </TileAction>
        ) : null}
        <TileAction
          label={isPinned ? `Soltar ${label}` : `Fixar ${label} em destaque`}
          onClick={() => onTogglePin(key)}
        >
          {isPinned ? (
            <PinOff size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Pin size={14} strokeWidth={1.75} aria-hidden />
          )}
        </TileAction>
        <TileAction
          label={isFullscreen ? "Sair da tela cheia" : `Tela cheia: ${label}`}
          onClick={() => onToggleFullscreen(ref.current)}
        >
          <Maximize2 size={14} strokeWidth={1.75} aria-hidden />
        </TileAction>
      </div>

      {menu ? (
        <TileMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Abrir em nova janela",
              icon: <ExternalLink size={14} strokeWidth={1.75} aria-hidden />,
              disabled: !hasVideo,
              onSelect: () => onPopout(trackRef, label),
            },
            canPip
              ? {
                  label: "Janela flutuante",
                  icon: <PictureInPicture2 size={14} strokeWidth={1.75} aria-hidden />,
                  disabled: !hasVideo,
                  onSelect: openPip,
                }
              : null,
            variant === "strip" && canSideBySide
              ? {
                  label: "Pôr lado a lado no destaque",
                  icon: <Columns2 size={14} strokeWidth={1.75} aria-hidden />,
                  onSelect: () => onSideBySide(key),
                }
              : null,
            {
              label: isPinned ? "Soltar do destaque" : "Fixar em destaque",
              icon: isPinned ? (
                <PinOff size={14} strokeWidth={1.75} aria-hidden />
              ) : (
                <Pin size={14} strokeWidth={1.75} aria-hidden />
              ),
              onSelect: () => onTogglePin(key),
            },
            {
              label: isFullscreen ? "Sair da tela cheia" : "Tela cheia",
              icon: <Maximize2 size={14} strokeWidth={1.75} aria-hidden />,
              onSelect: () => onToggleFullscreen(ref.current),
            },
          ]}
        />
      ) : null}
    </div>
  );
}

const SCREEN_VOLUME_KEY = "myscreen:screen-volume";

function readScreenVolume(): number {
  try {
    const raw = localStorage.getItem(SCREEN_VOLUME_KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

/**
 * Volume do som da tela compartilhada, só para quem assiste. Não mexe na voz
 * de ninguém: só na faixa de áudio da tela. A escolha vale para as próximas
 * telas também (fica no navegador).
 */
function ScreenVolume({ participant }: { participant: RemoteParticipant }) {
  const [volume, setVolume] = useState(readScreenVolume);
  const lastAudible = useRef(volume > 0 ? volume : 1);

  useEffect(() => {
    participant.setVolume(volume, Track.Source.ScreenShareAudio);
  }, [participant, volume]);

  const apply = (v: number) => {
    setVolume(v);
    if (v > 0) lastAudible.current = v;
    try {
      localStorage.setItem(SCREEN_VOLUME_KEY, String(v));
    } catch {
      // Sem storage, o volume vale só para esta sessão.
    }
  };

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const percent = Math.round(volume * 100);

  return (
    <div
      className="flex items-center rounded-md bg-black/55 text-white backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={volume === 0 ? "Ativar som da tela" : "Silenciar som da tela"}
        title={volume === 0 ? "Ativar som da tela" : "Silenciar som da tela"}
        onClick={() => apply(volume === 0 ? lastAudible.current : 0)}
        className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-black/40"
      >
        <Icon size={14} strokeWidth={1.75} aria-hidden />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => apply(Number(event.target.value) / 100)}
        aria-label="Volume do som da tela"
        aria-valuetext={`${percent}%`}
        title={`Som da tela: ${percent}%`}
        className="mr-2.5 h-1 w-20 cursor-pointer accent-white"
      />
    </div>
  );
}

const FULLSCREEN_IDLE_MS = 2500;

type TileMenuItem = {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * Menu do botão direito num quadro. Fica dentro do próprio quadro (com
 * `position: fixed`) para continuar visível quando o quadro está em tela cheia.
 */
function TileMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: (TileMenuItem | null)[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Encosta o menu para dentro da janela quando o clique foi perto da borda.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={(event) => event.stopPropagation()}
      className="fixed z-[70] min-w-[13rem] border border-rule-2 bg-sheet py-1 text-ink shadow-overlay [border-radius:var(--radius-sheet)]"
      style={pos}
    >
      {items
        .filter((item): item is TileMenuItem => item !== null)
        .map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
              item.onSelect();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-band focus:bg-band focus:outline-none disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="shrink-0 text-ink-2">{item.icon}</span>
            {item.label}
          </button>
        ))}
    </div>
  );
}

function TileAction({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="flex size-8 items-center justify-center rounded-md bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function EmptyStage({ onShare }: { onShare: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 border border-dashed border-rule-2 px-6 text-center [border-radius:var(--radius-sheet)]">
      <div>
        <p className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
          Ninguém está transmitindo ainda
        </p>
        <p className="mt-1.5 max-w-[40ch] text-[0.875rem] leading-[1.55] text-ink-2">
          Compartilhe a tela, uma janela ou uma aba. O áudio do sistema vai junto se você
          deixar marcado no seletor do navegador.
        </p>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="inline-flex items-center gap-2 border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 [border-radius:var(--radius-sheet)]"
      >
        <MonitorUp size={17} strokeWidth={1.75} aria-hidden />
        Compartilhar tela
      </button>
    </div>
  );
}

function BarToggle({
  children,
  label,
  open,
  onClick,
  badge,
  badgeTone = "plain",
}: {
  children: React.ReactNode;
  label: string;
  open: boolean;
  onClick: () => void;
  badge?: number;
  badgeTone?: "plain" | "signal";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      aria-label={badge !== undefined ? `${label} (${badge})` : label}
      title={label}
      className={cn(
        "flex h-9 items-center gap-1.5 border px-2.5 text-[0.8125rem] transition-colors [border-radius:var(--radius-cell)]",
        open
          ? "border-signal-line bg-signal-wash text-signal"
          : "border-transparent text-ink-2 hover:border-rule hover:bg-band hover:text-ink",
      )}
    >
      {children}
      {badge !== undefined ? (
        <span
          className={cn(
            "font-mono text-[0.75rem] [font-variant-numeric:tabular-nums]",
            badgeTone === "signal" &&
              "min-w-4 rounded-full bg-signal px-1 text-center text-[0.6875rem] font-semibold text-on-signal",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

type CopyState = "idle" | "copied" | "error";

function CopyLinkButton() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("área de transferência indisponível");
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("error");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        title="Copiar link de convite"
        className={cn(
          "flex h-9 items-center gap-1.5 border px-2.5 text-[0.8125rem] font-medium transition-colors [border-radius:var(--radius-cell)]",
          state === "copied"
            ? "border-signal-line bg-signal-wash text-signal"
            : state === "error"
              ? "border-alert-line bg-alert-wash text-alert"
              : "border-rule-2 bg-sheet text-ink hover:border-rule-3 hover:bg-band",
        )}
      >
        {state === "copied" ? (
          <Check size={16} strokeWidth={2} aria-hidden />
        ) : (
          <Link2 size={16} strokeWidth={1.75} aria-hidden />
        )}
        <span className="hidden sm:inline">
          {state === "copied" ? "Copiado" : state === "error" ? "Falhou" : "Convidar"}
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Link de convite copiado."
          : state === "error"
            ? "Não foi possível copiar. Copie o endereço da página manualmente."
            : ""}
      </span>
    </>
  );
}

function Notice({
  text,
  action,
  onDismiss,
}: {
  text: string;
  action?: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-rule px-4 py-2 last:border-b-0 sm:px-5"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warn-dot" />
      <p className="min-w-0 flex-1 text-[0.8125rem] text-ink-2">{text}</p>
      {action}
      <button
        type="button"
        aria-label="Dispensar aviso"
        onClick={onDismiss}
        className="shrink-0 p-1 text-ink-3 transition-colors hover:text-ink"
      >
        <X size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
