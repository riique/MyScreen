"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@livekit/components-react";
import { Send, X, MessageSquare, AlertCircle } from "lucide-react";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

const SEND_ERROR_MESSAGE =
  "Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const { chatMessages, send, isSending } = useChat();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    setSendError(null);
    try {
      await send(text);
      // Só limpamos depois da confirmação: enquanto o envio está em voo o
      // texto permanece visível, e o `messageSubject` do SDK só emite eco local
      // depois que o `sendText` conclui.
      setDraft("");
    } catch (err) {
      console.error("Falha ao enviar mensagem:", err);
      setSendError(SEND_ERROR_MESSAGE);
      // Devolve o texto ao campo, sem apagar o que o usuário tiver digitado
      // durante a espera.
      setDraft((current) => (current.trim() ? current : text));
      inputRef.current?.focus();
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (sendError) setSendError(null);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-l border-border/80 bg-[#0d0f17] text-white shadow-2xl animate-in slide-in-from-right duration-200 sm:w-80 md:w-96">
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
          type="button"
          onClick={onClose}
          aria-label="Fechar bate-papo"
          className={`rounded-lg p-1 text-gray-400 transition-colors hover:bg-secondary hover:text-white ${FOCUS_RING}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-400">
            <MessageSquare className="mb-2 h-10 w-10 opacity-60" />
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="mt-1 text-xs text-gray-400">
              Envie a primeira mensagem para a sala!
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            // Autoridade do SDK: `isLocal` distingue o remetente real.
            // Comparar `name`/`identity` rotula mensagens de outras pessoas
            // como suas sempre que o apelido coincidir como prefixo.
            const isMe = msg.from?.isLocal === true;

            return (
              <div
                key={msg.id || msg.timestamp}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="mb-1 flex items-baseline gap-2 px-1">
                  <span className="text-xs font-semibold text-gray-300">
                    {isMe ? "Você" : msg.from?.name || "Participante"}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isMe
                      ? "rounded-br-none bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "rounded-bl-none border border-border/60 bg-[#181c28] text-gray-100"
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
        {sendError && (
          <p
            role="alert"
            className="mb-2 flex items-start gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-300"
          >
            <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-red-400" />
            {sendError}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-[#181c28] px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
          <label htmlFor="chat-message-input" className="sr-only">
            Mensagem
          </label>
          <input
            id="chat-message-input"
            ref={inputRef}
            name="message"
            type="text"
            autoComplete="off"
            placeholder="Digite uma mensagem..."
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            className={`flex-1 rounded-md bg-transparent text-sm text-white placeholder-gray-400 ${FOCUS_RING}`}
          />
          <button
            type="submit"
            aria-label="Enviar mensagem"
            disabled={!draft.trim() || isSending}
            className={`flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 ${FOCUS_RING}`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
