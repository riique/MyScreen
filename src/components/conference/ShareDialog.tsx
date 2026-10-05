"use client";

import { MonitorUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CaptureRuler } from "@/components/site/CaptureRuler";
import type { CaptureSettings } from "@/components/site/capturePrefs";

/**
 * A pergunta certa na hora certa: resolução, taxa, tipo de conteúdo e áudio
 * só importam quando alguém vai compartilhar a tela. Por isso moram aqui, e não
 * na home nem no lobby, onde a maioria das pessoas só vai assistir.
 *
 * "Escolher tela" é o clique que abre o seletor do navegador. O
 * `getDisplayMedia` exige gesto do usuário, então o diálogo chama `onConfirm`
 * direto do clique, sem nada assíncrono no meio.
 */
export function ShareDialog({
  open,
  initial,
  onConfirm,
  onClose,
}: {
  open: boolean;
  initial: CaptureSettings;
  onConfirm: (settings: CaptureSettings) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<CaptureSettings>(initial);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cada abertura parte da última escolha confirmada.
  useEffect(() => {
    if (open) setSettings(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Foco preso no diálogo: Tab não pode cair na sala atrás do véu.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Sem portal: a sala pode estar em tela cheia, e um filho do <body> ficaria
  // fora do elemento em tela cheia, invisível.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-scrim sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-desc"
        className="max-h-[92dvh] w-full max-w-[52rem] overflow-y-auto border border-rule-2 bg-sheet shadow-overlay sm:[border-radius:var(--radius-sheet)]"
      >
        <div className="flex items-start justify-between gap-6 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="share-dialog-title"
              className="text-[1.125rem] font-semibold tracking-[-0.015em] text-ink"
            >
              Compartilhar tela
            </h2>
            <p
              id="share-dialog-desc"
              className="mt-1 max-w-[58ch] text-[0.875rem] leading-[1.5] text-ink-2"
            >
              Ajuste como a tela vai sair. Depois o navegador pergunta qual tela, janela ou
              aba você quer mostrar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancelar compartilhamento"
            className="shrink-0 p-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="border-y border-rule">
          <CaptureRuler
            settings={settings}
            onChange={(next) => setSettings((prev) => ({ ...prev, ...next }))}
          />
        </div>

        {settings.systemAudio ? (
          <p className="mx-5 mt-4 border border-signal-line bg-signal-wash px-3.5 py-2.5 text-[0.8125rem] leading-[1.5] text-ink-2 sm:mx-6 [border-radius:var(--radius-cell)]">
            No seletor, escolha <strong className="font-semibold text-ink">Tela inteira</strong>{" "}
            ou uma <strong className="font-semibold text-ink">Aba</strong> e marque{" "}
            <strong className="font-semibold text-ink">“Compartilhar áudio do sistema”</strong>.
            Janelas avulsas não levam áudio.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 px-5 py-5 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="border border-rule-2 bg-sheet px-4 py-2.5 text-[0.875rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band [border-radius:var(--radius-sheet)]"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(settings)}
            className="inline-flex items-center justify-center gap-2 border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 [border-radius:var(--radius-sheet)]"
          >
            <MonitorUp size={17} strokeWidth={1.75} aria-hidden />
            Escolher tela
          </button>
        </div>
      </div>
    </div>
  );
}
