"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
  MessageSquare,
  Users,
  Copy,
  Check,
  AlertCircle,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LocalRecorder } from "./LocalRecorder";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1017]";

type CopyState = "idle" | "copied" | "error";

type BarPosition = "viewport" | "arena";

const POSITION_CLASS: Record<BarPosition, string> = {
  viewport: "fixed inset-x-0",
  arena: "absolute inset-x-0",
};

interface MediaControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isFocusLayout: boolean;
  /** Deve incluir o participante local (total exibido na sala, não apenas os remotos). */
  participantCount: number;
  /**
   * `viewport` ancora a barra na janela (padrão). `arena` posiciona a barra dentro do
   * container relativo da arena, para não sobrepor as sidebars irmãs de chat e participantes.
   */
  position?: BarPosition;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleLayout: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
}

export function MediaControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  isChatOpen,
  isParticipantsOpen,
  isFocusLayout,
  participantCount,
  position = "viewport",
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleLayout,
  onOpenSettings,
  onLeave,
}: MediaControlsProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isHidden, setIsHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Impede setState depois que a barra é desmontada (troca de sala, saída da reunião).
  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = null;
    };
  }, []);

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const scheduleCopyReset = () => {
    if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(() => {
      copyResetTimer.current = null;
      setCopyState("idle");
    }, 2500);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("área de transferência indisponível");
      }
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    scheduleCopyReset();
  };

  const copyLabel =
    copyState === "copied"
      ? "Link de convite copiado"
      : copyState === "error"
        ? "Não foi possível copiar o link de convite. Copie o endereço da página manualmente."
        : "Copiar link de convite da reunião";

  if (isHidden) {
    return (
      <div
        className={`pointer-events-none ${POSITION_CLASS[position]} bottom-4 z-40 flex justify-center px-3`}
      >
        <button
          type="button"
          onClick={() => setIsHidden(false)}
          className={`group pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-border/80 bg-[#0e1017]/95 px-4 py-2 text-xs font-semibold text-gray-300 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 hover:bg-[#181b26] hover:text-white ${FOCUS_RING}`}
        >
          <ChevronUp className="h-4 w-4 text-indigo-400 transition-transform group-hover:-translate-y-0.5" />
          <span>Mostrar Controles</span>
        </button>
      </div>
    );
  }

  return (
    // O wrapper só posiciona: pointer-events-none evita que a faixa invisível bloqueie
    // o compositor do chat e o rodapé da lista de participantes.
    <div
      className={`pointer-events-none ${POSITION_CLASS[position]} bottom-6 z-40 flex justify-center px-3`}
    >
      <div className="pointer-events-auto flex w-full max-w-full items-center gap-2 rounded-2xl border border-border/80 bg-[#0e1017]/90 p-1.5 shadow-2xl backdrop-blur-xl">
        {/* Controles roláveis em telas estreitas */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {/* Audio Toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            aria-pressed={isMicOn}
            aria-label="Microfone"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${FOCUS_RING} ${
              isMicOn
                ? "border border-border/60 bg-[#181b26] text-white hover:bg-secondary"
                : "bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-500"
            }`}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={onToggleCam}
            aria-pressed={isCamOn}
            aria-label="Câmera"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${FOCUS_RING} ${
              isCamOn
                ? "border border-border/60 bg-[#181b26] text-white hover:bg-secondary"
                : "bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-500"
            }`}
          >
            {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share Toggle (concomitant with camera) */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            aria-pressed={isScreenSharing}
            className={`flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 transition-all ${FOCUS_RING} ${
              isScreenSharing
                ? "bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
                : "border border-border/60 bg-[#181b26] text-white hover:bg-secondary"
            }`}
          >
            {isScreenSharing ? (
              <>
                <MonitorOff className="h-5 w-5" />
                <span className="text-xs sr-only sm:not-sr-only">Parar Tela</span>
              </>
            ) : (
              <>
                <Monitor className="h-5 w-5" />
                <span className="text-xs sr-only sm:not-sr-only">Compartilhar Tela</span>
              </>
            )}
          </button>

          <div className="mx-1 hidden h-8 w-px shrink-0 bg-border/60 sm:block" />

          {/* Local Browser Screen & Audio Recorder */}
          <LocalRecorder />

          <div className="mx-1 hidden h-8 w-px shrink-0 bg-border/60 sm:block" />

          {/* Layout Toggle (Focus vs Grid) */}
          <button
            type="button"
            onClick={onToggleLayout}
            aria-pressed={isFocusLayout}
            aria-label="Modo Foco Apresentação"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${FOCUS_RING} ${
              isFocusLayout
                ? "border border-indigo-500/40 bg-indigo-600/30 text-indigo-300"
                : "border border-border/60 bg-[#181b26] text-gray-300 hover:bg-secondary"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          {/* Chat Toggle */}
          <button
            type="button"
            onClick={onToggleChat}
            aria-pressed={isChatOpen}
            aria-label="Bate-papo"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${FOCUS_RING} ${
              isChatOpen
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "border border-border/60 bg-[#181b26] text-gray-300 hover:bg-secondary"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Participants Toggle */}
          <button
            type="button"
            onClick={onToggleParticipants}
            aria-pressed={isParticipantsOpen}
            aria-label={`Lista de participantes (${participantCount})`}
            className={`flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 transition-all ${FOCUS_RING} ${
              isParticipantsOpen
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "border border-border/60 bg-[#181b26] text-gray-300 hover:bg-secondary"
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-semibold">{participantCount}</span>
          </button>

          {/* Copy Invite Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            aria-label={copyLabel}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 transition-all ${FOCUS_RING} ${
              copyState === "error"
                ? "border-red-500/60 bg-red-500/15 text-red-400 hover:bg-red-500/25"
                : "bg-[#181b26] text-gray-300 hover:bg-secondary"
            }`}
          >
            {copyState === "copied" ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : copyState === "error" ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>

          {/* Settings Modal Toggle */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Abrir configurações de mídia e dispositivos"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-[#181b26] text-gray-300 transition-all hover:bg-secondary ${FOCUS_RING}`}
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Fullscreen Meeting Toggle */}
          <button
            type="button"
            onClick={toggleAppFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia da reunião" : "Entrar em tela cheia da reunião"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-[#181b26] text-gray-300 transition-all hover:bg-secondary ${FOCUS_RING}`}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {/* Hide Controls Bar */}
          <button
            type="button"
            onClick={() => setIsHidden(true)}
            aria-label="Ocultar barra de controles"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-[#181b26] text-gray-400 transition-all hover:bg-secondary hover:text-white ${FOCUS_RING}`}
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-1 h-8 w-px shrink-0 bg-border/60" />

        {/* Leave Call — fora da área rolável, sempre visível e tocável */}
        <button
          type="button"
          onClick={onLeave}
          className={`flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 ${FOCUS_RING}`}
        >
          <PhoneOff className="h-5 w-5" />
          <span className="text-xs font-bold sr-only sm:not-sr-only">Sair</span>
        </button>

        <span role="status" aria-live="polite" className="sr-only">
          {copyState === "copied"
            ? "Link de convite copiado para a área de transferência."
            : copyState === "error"
              ? "Falha ao copiar o link de convite. Copie o endereço da página manualmente."
              : ""}
        </span>
      </div>
    </div>
  );
}
