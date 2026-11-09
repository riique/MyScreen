
import {
  Circle,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Settings2,
  Video,
  VideoOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A doca da chamada: uma fila só, centrada, com o que a pessoa toca de olho no
 * vídeo. Microfone e câmera desligados ficam marcados em alerta — é o estado
 * que mais causa "você está mudo" numa chamada, então ele precisa ser visto de
 * relance. Compartilhar a tela é ir "no ar": a tecla ganha o vermelho cheio da
 * marca, a única vez que ele ocupa uma superfície inteira.
 *
 * O estado nunca é só cor: o ícone troca (mic riscado, câmera riscada) e o
 * rótulo acessível diz o que o clique faz.
 */
export interface MediaControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  /** Quantas fontes estão gravando agora (0 = nenhuma). */
  recordingCount: number;
  onRecord: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  /** Controles extras depois do gravar (áudios, som do PC quando no ar). */
  extra?: ReactNode;
}

export function MediaControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  isFullscreen,
  canFullscreen,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  recordingCount,
  onRecord,
  onToggleFullscreen,
  onOpenSettings,
  onLeave,
  extra,
}: MediaControlsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
      <DockButton
        tone={isMicOn ? "idle" : "off"}
        onClick={onToggleMic}
        pressed={isMicOn}
        label={isMicOn ? "Silenciar microfone" : "Ativar microfone"}
      >
        {isMicOn ? <Mic {...ICON} /> : <MicOff {...ICON} />}
      </DockButton>

      <DockButton
        tone={isCamOn ? "idle" : "off"}
        onClick={onToggleCam}
        pressed={isCamOn}
        label={isCamOn ? "Desligar câmera" : "Ligar câmera"}
      >
        {isCamOn ? <Video {...ICON} /> : <VideoOff {...ICON} />}
      </DockButton>

      <DockButton
        tone={isScreenSharing ? "live" : "idle"}
        onClick={onToggleScreenShare}
        pressed={isScreenSharing}
        label={isScreenSharing ? "Parar de compartilhar a tela" : "Compartilhar tela"}
        wide
      >
        {isScreenSharing ? <MonitorX {...ICON} /> : <MonitorUp {...ICON} />}
        <span className="hidden sm:inline">{isScreenSharing ? "No ar · Parar" : "Compartilhar"}</span>
      </DockButton>

      <DockButton
        tone={recordingCount > 0 ? "rec" : "idle"}
        onClick={onRecord}
        pressed={recordingCount > 0}
        label={recordingCount > 0 ? "Gravações em andamento" : "Gravar câmera e tela"}
        wide
      >
        <Circle
          {...ICON}
          size={14}
          strokeWidth={0}
          fill="currentColor"
          className="text-live"
          style={recordingCount > 0 ? { animation: "live-breathe 1.8s ease-in-out infinite" } : undefined}
        />
        <span className="hidden sm:inline">
          {recordingCount > 0 ? `Gravando${recordingCount > 1 ? ` ${recordingCount}` : ""}` : "Gravar"}
        </span>
      </DockButton>

      {extra}

      <span aria-hidden className="mx-1 hidden h-6 w-px bg-rule sm:block" />

      {canFullscreen ? (
        <DockButton
          tone="idle"
          onClick={onToggleFullscreen}
          label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize {...ICON} /> : <Maximize {...ICON} />}
        </DockButton>
      ) : null}

      <DockButton tone="idle" onClick={onOpenSettings} label="Configurações de mídia">
        <Settings2 {...ICON} />
      </DockButton>

      <button
        type="button"
        onClick={onLeave}
        aria-label="Sair da reunião"
        title="Sair da reunião"
        className="flex h-11 items-center gap-2 rounded-full bg-alert px-4 text-[0.8125rem] font-medium text-sheet transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] sm:ml-1 sm:px-5"
      >
        <PhoneOff {...ICON} />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </div>
  );
}

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

function DockButton({
  children,
  tone,
  onClick,
  label,
  pressed,
  wide = false,
}: {
  children: ReactNode;
  tone: "idle" | "off" | "live" | "rec";
  onClick: () => void;
  label: string;
  pressed?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-full text-[0.8125rem] font-medium transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.96]",
        wide ? "min-w-11 px-3.5 sm:px-4" : "w-11",
        tone === "idle" && "bg-band-2 text-ink hover:bg-signal-wash-2",
        tone === "off" &&
          "bg-alert-wash text-alert shadow-[inset_0_0_0_1px_var(--color-alert-line)] hover:bg-alert-wash-2",
        tone === "live" && "bg-live text-on-live hover:bg-live-2",
        tone === "rec" && "bg-live-wash text-live shadow-[inset_0_0_0_1px_var(--color-live-line)]",
      )}
    >
      {children}
    </button>
  );
}
