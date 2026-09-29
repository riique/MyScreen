"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@livekit/components-react";
import { Send, X, MessageSquare, Smile } from "lucide-react";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  localParticipantName: string;
}

export function ChatSidebar({ isOpen, onClose, localParticipantName }: ChatSidebarProps) {
  const { chatMessages, send, isSending } = useChat();
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSending) return;

    const text = draft.trim();
    setDraft("");
    try {
      await send(text);
    } catch (err) {
      console.error("Falha ao enviar mensagem:", err);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full w-80 md:w-96 flex-col border-l border-border/80 bg-[#0d0f17] text-white shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5 bg-[#11131c]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          <h3 className="font-semibold text-sm">Bate-papo da Reunião</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-gray-400">
            {chatMessages.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-secondary hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-12">
            <MessageSquare className="h-10 w-10 text-gray-600 mb-2 opacity-60" />
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="text-xs text-gray-600 mt-1">Envie a primeira mensagem para a sala!</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.from?.name === localParticipantName || msg.from?.identity.startsWith(localParticipantName);

            return (
              <div
                key={msg.id || msg.timestamp}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className="text-xs font-semibold text-gray-300">
                    {isMe ? "Você" : msg.from?.name || "Participante"}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed max-w-[85%] break-words ${
                    isMe
                      ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20"
                      : "bg-[#181c28] text-gray-100 border border-border/60 rounded-bl-none"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="border-t border-border/60 p-3 bg-[#11131c]">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-[#181c28] px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
