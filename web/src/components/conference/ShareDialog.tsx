"use client";

import { MonitorUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Choice } from "@/components/sheet";
import { CaptureRuler } from "@/components/site/CaptureRuler";
import type { CaptureSettings } from "@/components/site/capturePrefs";
import { readCompanion, writeCompanion, type CompanionPrefs } from "./companionAudio";

type AudioMode = "browser" | "app" | "off";

/** Sempre a versão mais recente publicada nas Releases do GitHub. */
const APP_DOWNLOAD_URL =
  "https://github.com/riique/MyScreen/releases/latest/download/MyScreenAudio-Setup.exe";

const AUDIO_MODES: { value: AudioMode; label: string; hint: string }[] = [
  { value: "browser", label: "Navegador", hint: "Tela inteira ou aba" },
  { value: "app", label: "App", hint: "MyScreen Áudio, Windows" },
  { value: "off", label: "Sem som", hint: "Só o microfone" },
];

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
  const [companion, setCompanion] = useState<CompanionPrefs>({ enabled: false, code: "" });
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cada abertura parte da última escolha confirmada.
  useEffect(() => {
    if (!open) return;
    setSettings(initial);
    setCompanion(readCompanion());
  }, [open, initial]);

  const audioMode: AudioMode = !settings.systemAudio
    ? "off"
    : companion.enabled
      ? "app"
      : "browser";
  const setAudioMode = (mode: AudioMode) => {
    setSettings((prev) => ({ ...prev, systemAudio: mode !== "off" }));
    setCompanion((c) => ({ ...c, enabled: mode === "app" }));
  };
  const useCompanion = audioMode === "app";
  const codeOk = companion.code.replace(/[^a-z0-9]/gi, "").length === 8;

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
              Depois o navegador pergunta qual tela, janela ou aba mostrar.
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

        {/* De onde vem o som do PC. Uma escolha só, com três saídas: o
            navegador (Chrome, tela inteira ou aba), o app do Windows (para
            quando o navegador não consegue, como com fone 7.1) ou nenhum. */}
        <div className="border-b border-rule">
          <div className="px-4 pt-3 pb-2">
            <span className="label-col">Som do PC</span>
          </div>
          <div className="grid grid-cols-3 border-t border-rule">
            {AUDIO_MODES.map((o) => (
              <Choice
                key={o.value}
                name="share-audio"
                value={o.value}
                checked={audioMode === o.value}
                onChange={() => setAudioMode(o.value)}
                label={o.label}
                hint={o.hint}
              />
            ))}
          </div>
        </div>

        {audioMode === "app" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4 sm:px-6">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Código do app (XXXX-XXXX)"
              aria-label="Código de pareamento do app MyScreen Áudio"
              value={companion.code}
              onChange={(e) => setCompanion((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
              className="w-full max-w-[14rem] border border-rule-2 bg-sheet px-3 py-2 font-mono text-[0.9375rem] tracking-[0.08em] text-ink outline-none focus:border-signal [border-radius:var(--radius-cell)]"
            />
            <p className="text-[0.8125rem] leading-[1.5] text-ink-3">
              Deixe o app aberto. Qualquer tela ou janela serve. Não tem o app?{" "}
              <a
                href={APP_DOWNLOAD_URL}
                className="font-semibold text-signal underline underline-offset-2 hover:text-signal-2"
              >
                Baixar para Windows
              </a>
            </p>
          </div>
        ) : audioMode === "browser" ? (
          <p className="px-5 pt-4 text-[0.8125rem] leading-[1.5] text-ink-3 sm:px-6">
            No seletor, escolha <strong className="font-semibold text-ink-2">Tela inteira</strong> ou
            uma <strong className="font-semibold text-ink-2">Aba</strong> e deixe o áudio marcado.
            Janelas avulsas não levam som.
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
            disabled={useCompanion && !codeOk}
            onClick={() => {
              writeCompanion(companion);
              onConfirm(settings);
            }}
            className="inline-flex items-center justify-center gap-2 border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 disabled:cursor-not-allowed disabled:opacity-50 [border-radius:var(--radius-sheet)]"
          >
            <MonitorUp size={17} strokeWidth={1.75} aria-hidden />
            Escolher tela
          </button>
        </div>
      </div>
    </div>
  );
}
