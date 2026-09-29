"use client";

import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, Monitor, X, Users, Crown } from "lucide-react";
import { Participant, Track } from "livekit-client";

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
  localIdentity: string;
}

export function ParticipantsList({ isOpen, onClose, localIdentity }: ParticipantsListProps) {
  const participants = useParticipants();

  if (!isOpen) return null;

  const isTrackMuted = (p: Participant, source: Track.Source) => {
    const pub = p.getTrackPublication(source);
    return !pub || pub.isMuted;
  };

  const hasScreenShare = (p: Participant) => {
    const pub = p.getTrackPublication(Track.Source.ScreenShare);
    return Boolean(pub && !pub.isMuted);
  };

  return (
    <div className="flex h-full w-80 md:w-96 flex-col border-l border-border/80 bg-[#0d0f17] text-white shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5 bg-[#11131c]">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-400" />
          <h3 className="font-semibold text-sm">Participantes</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-gray-400">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-secondary hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {participants.map((p) => {
          const isLocal = p.identity === localIdentity || p.isLocal;
          const micMuted = isTrackMuted(p, Track.Source.Microphone);
          const camMuted = isTrackMuted(p, Track.Source.Camera);
          const sharingScreen = hasScreenShare(p);

          return (
            <div
              key={p.identity}
              className="flex items-center justify-between rounded-xl bg-[#141724] border border-border/50 p-3 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300 font-bold text-sm border border-indigo-500/20">
                  {(p.name || p.identity).charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-200">
                      {p.name || p.identity}
                    </span>
                    {isLocal && (
                      <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        Você
                      </span>
                    )}
                  </div>
                  {p.isSpeaking && (
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Falando...
                    </span>
                  )}
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-gray-400">
                {sharingScreen && (
                  <div className="text-emerald-400 bg-emerald-500/10 p-1 rounded border border-emerald-500/20" title="Compartilhando tela">
                    <Monitor className="h-3.5 w-3.5" />
                  </div>
                )}
                {camMuted ? (
                  <div className="text-red-400 p-1" title="Câmera desligada">
                    <VideoOff className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="text-gray-300 p-1" title="Câmera ligada">
                    <Video className="h-3.5 w-3.5" />
                  </div>
                )}
                {micMuted ? (
                  <div className="text-red-400 p-1" title="Microfone mudo">
                    <MicOff className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="text-emerald-400 p-1" title="Microfone ativo">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
