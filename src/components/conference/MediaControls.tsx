"use client";

import { useState } from "react";
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
  LayoutGrid,
  Maximize2,
} from "lucide-react";
import { LocalRecorder } from "./LocalRecorder";

interface MediaControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isFocusLayout: boolean;
  participantCount: number;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleLayout: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  roomId: string;
}

export function MediaControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  isChatOpen,
  isParticipantsOpen,
  isFocusLayout,
  participantCount,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleLayout,
  onOpenSettings,
  onLeave,
  roomId,
}: MediaControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 max-w-[95vw] overflow-x-auto p-1.5 rounded-2xl bg-[#0e1017]/90 backdrop-blur-xl border border-border/80 shadow-2xl">
      {/* Audio Toggle */}
      <button
        type="button"
        onClick={onToggleMic}
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
          isMicOn
            ? "bg-[#181b26] text-white hover:bg-secondary border border-border/60"
            : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30"
        }`}
        title={isMicOn ? "Silenciar microfone" : "Ativar microfone"}
      >
        {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>

      {/* Video Toggle */}
      <button
        type="button"
        onClick={onToggleCam}
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
          isCamOn
            ? "bg-[#181b26] text-white hover:bg-secondary border border-border/60"
            : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30"
        }`}
        title={isCamOn ? "Desligar câmera" : "Ligar câmera"}
      >
        {isCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </button>

      {/* Screen Share Toggle (concomitant with camera) */}
      <button
        type="button"
        onClick={onToggleScreenShare}
        className={`flex h-12 items-center gap-2 px-4 rounded-xl transition-all ${
          isScreenSharing
            ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 font-semibold"
            : "bg-[#181b26] text-white hover:bg-secondary border border-border/60"
        }`}
        title={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela com áudio"}
      >
        {isScreenSharing ? (
          <>
            <MonitorOff className="h-5 w-5" />
            <span className="text-xs hidden sm:inline">Parar Tela</span>
          </>
        ) : (
          <>
            <Monitor className="h-5 w-5" />
            <span className="text-xs hidden sm:inline">Compartilhar Tela</span>
          </>
        )}
      </button>

      <div className="h-8 w-px bg-border/60 mx-1 hidden sm:block" />

      {/* Local Browser Screen & Audio Recorder */}
      <LocalRecorder />

      <div className="h-8 w-px bg-border/60 mx-1 hidden sm:block" />

      {/* Layout Toggle (Focus vs Grid) */}
      <button
        type="button"
        onClick={onToggleLayout}
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
          isFocusLayout
            ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
            : "bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/60"
        }`}
        title={isFocusLayout ? "Mudar para modo Grade" : "Mudar para modo Foco Apresentação"}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {/* Chat Toggle */}
      <button
        type="button"
        onClick={onToggleChat}
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
          isChatOpen
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
            : "bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/60"
        }`}
        title="Abrir bate-papo"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Participants Toggle */}
      <button
        type="button"
        onClick={onToggleParticipants}
        className={`flex h-12 items-center gap-1.5 px-3 rounded-xl transition-all ${
          isParticipantsOpen
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
            : "bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/60"
        }`}
        title="Lista de participantes"
      >
        <Users className="h-5 w-5" />
        <span className="text-xs font-semibold">{participantCount}</span>
      </button>

      {/* Copy Invite Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/60 transition-all"
        title="Copiar link de convite da reunião"
      >
        {copied ? (
          <Check className="h-5 w-5 text-emerald-400" />
        ) : (
          <Copy className="h-5 w-5" />
        )}
      </button>

      {/* Settings Modal Toggle */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/60 transition-all"
        title="Configurações de mídia e dispositivos"
      >
        <Settings className="h-5 w-5" />
      </button>

      <div className="h-8 w-px bg-border/60 mx-1" />

      {/* Leave Call */}
      <button
        type="button"
        onClick={onLeave}
        className="flex h-12 items-center gap-2 px-4 rounded-xl bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30 font-semibold transition-all cursor-pointer"
        title="Sair da reunião"
      >
        <PhoneOff className="h-5 w-5" />
        <span className="text-xs font-bold hidden sm:inline">Sair</span>
      </button>
    </div>
  );
}
