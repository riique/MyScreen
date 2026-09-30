"use client";

import {
  Check,
  Copy,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LocalRecorder } from "./LocalRecorder";

/**
 * A régua de comando: um botão marcado por função, empilhado na coluna ao lado
 * do monitor. O estado de cada tecla é escrito embaixo do ícone — ligado é
 * preenchido e escrito "ligado", desligado é vazio e escrito "desligado". O
 * estado nunca depende só da cor, porque cor sozinha não sobrevive a quem não
 * distingue verde de vermelho.
 */

type CopyState = "idle" | "copied" | "error";

const COPY_RESET_MS = 2500;

export interface MediaControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

export function MediaControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onLeave,
}: MediaControlsProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(copyResetTimer.current);
    },
    [],
  );

  async function handleCopyLink() {
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
    clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), COPY_RESET_MS);
  }

  const copyLabel =
    copyState === "copied"
      ? "Link de convite copiado"
      : copyState === "error"
        ? "Não foi possível copiar o link de convite. Copie o endereço da página manualmente."
        : "Copiar link de convite da reunião";

  return (
    <div>
      <div className="grid grid-cols-3 gap-px border border-rule bg-rule lg:grid-cols-1 [border-radius:var(--radius-sheet)]">
        <ControlCell
          on={isMicOn}
          onClick={onToggleMic}
          pressedLabel="Silenciar microfone"
          unpressedLabel="Ativar microfone"
          onLabel="Microfone ligado"
          offLabel="Microfone mudo"
          icon={isMicOn ? <Mic size={15} strokeWidth={1.5} /> : <MicOff size={15} strokeWidth={1.5} />}
        />
        <ControlCell
          on={isCamOn}
          onClick={onToggleCam}
          pressedLabel="Desligar câmera"
          unpressedLabel="Ligar câmera"
          onLabel="Câmera ligada"
          offLabel="Câmera desligada"
          icon={isCamOn ? <Video size={15} strokeWidth={1.5} /> : <VideoOff size={15} strokeWidth={1.5} />}
        />
        <ControlCell
          on={isScreenSharing}
          onClick={onToggleScreenShare}
          pressedLabel="Parar Tela"
          unpressedLabel="Compartilhar Tela"
          onLabel="Compartilhando"
          offLabel="Tela"
          icon={
            isScreenSharing ? (
              <MonitorOff size={15} strokeWidth={1.5} />
            ) : (
              <Monitor size={15} strokeWidth={1.5} />
            )
          }
        />
      </div>

      {/* A gravação é local, por MediaRecorder, e o estado dela é dela. */}
      <div className="mt-2">
        <LocalRecorder />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-px border border-rule bg-rule [border-radius:var(--radius-sheet)]">
        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={copyLabel}
          className="flex flex-col items-center gap-1.5 bg-sheet px-2 py-2.5 text-[0.6875rem] leading-none text-ink-2 transition-colors hover:bg-band hover:text-ink"
        >
          {copyState === "copied" ? (
            <Check size={15} strokeWidth={1.5} aria-hidden className="text-signal" />
          ) : copyState === "error" ? (
            <Copy size={15} strokeWidth={1.5} aria-hidden />
          ) : (
            <Copy size={15} strokeWidth={1.5} aria-hidden />
          )}
          <span>{copyState === "copied" ? "Copiado" : "Copiar link"}</span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className="flex flex-col items-center gap-1.5 bg-sheet px-2 py-2.5 text-[0.6875rem] leading-none text-ink-2 transition-colors hover:bg-alert-wash hover:text-alert"
        >
          <PhoneOff size={15} strokeWidth={1.5} aria-hidden />
          <span>Sair</span>
        </button>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? "Link de convite copiado para a área de transferência."
          : copyState === "error"
            ? "Falha ao copiar o link de convite. Copie o endereço da página manualmente."
            : ""}
      </span>
    </div>
  );
}

function ControlCell({
  on,
  onClick,
  icon,
  onLabel,
  offLabel,
  pressedLabel,
  unpressedLabel,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  onLabel: string;
  offLabel: string;
  pressedLabel: string;
  unpressedLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? pressedLabel : unpressedLabel}
      title={on ? pressedLabel : unpressedLabel}
      className={`flex flex-col items-center gap-1.5 px-2 py-3 text-[0.6875rem] leading-none transition-colors ${
        on ? "bg-signal-wash text-signal" : "bg-sheet text-ink-2 hover:bg-band hover:text-ink"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{on ? onLabel : offLabel}</span>
    </button>
  );
}
