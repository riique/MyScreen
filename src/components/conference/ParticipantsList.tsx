"use client";

import { useMemo } from "react";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { Video, VideoOff, X, Users, Monitor, MicOff, Mic } from "lucide-react";
import { Participant, Track } from "livekit-client";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ParticipantsList({ isOpen, onClose }: ParticipantsListProps) {
  const remoteParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // `useParticipants()` devolve apenas `room.remoteParticipants`; o
  // participante local precisa ser composto à mão, senão a lista nunca mostra
  // quem está lendo e o contador fica defasado em um.
  const participants = useMemo(
    () => (localParticipant ? [localParticipant, ...remoteParticipants] : remoteParticipants),
    [localParticipant, remoteParticipants]
  );

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
    <div className="flex h-full w-full shrink-0 flex-col border-l border-border/80 bg-[#0d0f17] text-white shadow-2xl animate-in slide-in-from-right duration-200 sm:w-80 md:w-96">
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
          type="button"
          onClick={onClose}
          aria-label="Fechar lista de participantes"
          className={`rounded-lg p-1 text-gray-400 transition-colors hover:bg-secondary hover:text-white ${FOCUS_RING}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Participants list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {participants.map((p) => {
          const isLocal = p.isLocal === true;
          const micMuted = isTrackMuted(p, Track.Source.Microphone);
          const camMuted = isTrackMuted(p, Track.Source.Camera);
          const sharingScreen = hasScreenShare(p);

          return (
            <div
              key={p.identity}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-[#141724] p-3 transition-colors hover:border-indigo-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-600/20 text-sm font-bold text-indigo-300">
                  {(p.name || p.identity).charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-200">
                      {p.name || p.identity}
                    </span>
                    {isLocal && (
                      <span className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
                        Você
                      </span>
                    )}
                  </div>
                  {p.isSpeaking && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Falando...
                    </span>
                  )}
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-gray-400">
                {sharingScreen && (
                  <div
                    className="rounded border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-400"
                    title="Compartilhando tela"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </div>
                )}
                {camMuted ? (
                  <div className="p-1 text-red-400" title="Câmera desligada">
                    <VideoOff className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="p-1 text-gray-300" title="Câmera ligada">
                    <Video className="h-3.5 w-3.5" />
                  </div>
                )}
                {micMuted ? (
                  <div className="p-1 text-red-400" title="Microfone mudo">
                    <MicOff className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="p-1 text-emerald-400" title="Microfone ativo">
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
