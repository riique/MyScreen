"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supportsAudioOutputSelection } from "livekit-client";
import { X, Sliders, Monitor, Mic, Volume2 } from "lucide-react";

export interface MediaSettings {
  screenFps: number;
  screenResolution: "720p" | "1080p" | "4k";
  /**
   * "detail" = conteudo estatico (texto, IDE, planilhas, UI) — o encoder
   * preserva nitidez em vez de suavizar. "motion" = video/jogo.
   * O padrao correto para quem demonstra software e "detail".
   */
  screenContentType: "motion" | "detail";
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  audioInputId?: string;
  videoInputId?: string;
  audioOutputId?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MediaSettings;
  onUpdateSettings: (newSettings: Partial<MediaSettings>) => void;
  devices: {
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  };
  /**
   * FPS, resolução e tipo de conteudo so sao lidos no instante em que o
   * compartilhamento comeca. Alterar isso com a tela ja compartilhando nao
   * muda nada: o painel desabilita os controles e diz isso ao usuario.
   */
  isScreenSharing: boolean;
}

const TITLE_ID = "settings-modal-title";
const DESCRIPTION_ID = "settings-modal-desc";

/**
 * Rótulo de um dispositivo. A spec permite `label` e `deviceId` vazios quando
 * a permissão ainda não foi concedida — nesse caso o fallback antigo virava
 * "Microfone ()", deixando todas as opções idênticas e indistinguíveis.
 */
function deviceLabel(device: MediaDeviceInfo, fallback: string): string {
  const label = device.label?.trim() ?? "";
  if (label) return label;
  const deviceId = device.deviceId?.trim() ?? "";
  if (deviceId) return `${fallback} (${deviceId.slice(0, 5)})`;
  return `${fallback} (permissão não concedida)`;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function DeviceSelect({
  id,
  label,
  devices,
  fallback,
  selectedId,
  onSelect,
  emptyMessage,
}: {
  id: string;
  label: string;
  devices: MediaDeviceInfo[];
  fallback: string;
  selectedId?: string;
  onSelect: (deviceId: string | undefined) => void;
  emptyMessage: string;
}) {
  // Só dispositivos com `deviceId` podem ser escolhidos de fato. Os demais
  // aparecem como entrada informativa, sem virar uma opção "Padrão do
  // sistema" duplicada e indistinguível.
  const selectable = devices.filter((d) => Boolean(d.deviceId?.trim()));
  const blocked = devices.length - selectable.length;
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-300">
        {label}
      </label>
      <select
        id={id}
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || undefined)}
        aria-describedby={devices.length === 0 ? hintId : undefined}
        className={SELECT_CLASS}
      >
        <option value="">Padrão do sistema</option>
        {selectable.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {deviceLabel(d, fallback)}
          </option>
        ))}
        {blocked > 0 && (
          <option value="" disabled>
            {blocked === 1
              ? `${fallback} (permissão não concedida)`
              : `${blocked} dispositivos sem permissão concedida`}
          </option>
        )}
      </select>
      {devices.length === 0 && (
        <p id={hintId} className="mt-1.5 text-[11px] text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  devices,
  isScreenSharing,
}: SettingsModalProps) {
  // `setSinkId` nao existe em todo navegador. Sem este gate o seletor de
  // saida aparecia, o usuario escolhia, e nada acontecia: um controle que
  // mente e pior que a ausencia dele.
  const [canSelectAudioOutput, setCanSelectAudioOutput] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // `onClose` chega como arrow nova a cada render do pai. Mantê-lo em ref deixa
  // o listener e o efeito de foco estáveis: com `onClose` na lista de
  // dependências o focus trap era religado a cada re-render e devolvia o foco
  // ao painel no meio da interação.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setCanSelectAudioOutput(supportsAudioOutputSelection());
  }, []);

  // Foco, Escape, focus trap e conteúdo de fundo inerte. Sem isso o Tab escapava
  // para os controles da sala por baixo do overlay e não havia como fechar pelo
  // teclado. Foco, Escape e `inert` vivem no mesmo efeito porque a limpeza
  // precisa devolver o foco só depois de remover `inert` — elemento dentro
  // de uma subárvore inerte não aceita foco.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const overlay = overlayRef.current;
    const siblings =
      overlay && overlay.parentElement
        ? Array.from(overlay.parentElement.children).filter(
            (el) => el !== overlay && !el.contains(overlay),
          )
        : [];
    const previousInert = siblings.map((el) => [el, el.getAttribute("inert")] as const);
    siblings.forEach((el) => el.setAttribute("inert", ""));

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (active === panel || !active || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey ? active === first : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousInert.forEach(([el, had]) => {
        if (had === null) el.removeAttribute("inert");
        else el.setAttribute("inert", had);
      });
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESCRIPTION_ID}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl text-foreground outline-none"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <Sliders className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={TITLE_ID} className="text-lg font-semibold text-white">
                Configurações de Mídia
              </h2>
              <p id={DESCRIPTION_ID} className="text-xs text-muted-foreground">
                Ajuste de transmissão, áudio e dispositivos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações de mídia"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-secondary hover:text-white transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {/* Compartilhamento de Tela */}
          <fieldset
            disabled={isScreenSharing}
            className={`space-y-3 rounded-xl border border-border/50 p-3 transition-opacity ${
              isScreenSharing ? "opacity-60" : ""
            }`}
          >
            <legend className="px-1 text-sm font-semibold text-indigo-400">
              <Monitor className="mr-1.5 inline h-4 w-4 align-middle" aria-hidden="true" />
              Transmissão de Tela (Alta Fidelidade)
            </legend>

            {isScreenSharing ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                Você está compartilhando sua tela agora. Estas opções só valem a
                partir do próximo compartilhamento.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Estas opções valem a partir do próximo compartilhamento de tela.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="set-fps"
                  className="mb-1.5 block text-xs font-medium text-gray-300"
                >
                  Taxa de Quadros (FPS)
                </label>
                <select
                  id="set-fps"
                  value={settings.screenFps}
                  onChange={(e) => onUpdateSettings({ screenFps: Number(e.target.value) })}
                  className={SELECT_CLASS}
                >
                  <option value={60}>60 FPS (Ultra Fluído - Jogos & Vídeos)</option>
                  <option value={30}>30 FPS (Padrão Recomendado)</option>
                  <option value={15}>15 FPS (Economia de Banda)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="set-res"
                  className="mb-1.5 block text-xs font-medium text-gray-300"
                >
                  Resolução de Tela
                </label>
                <select
                  id="set-res"
                  value={settings.screenResolution}
                  onChange={(e) =>
                    onUpdateSettings({
                      screenResolution: e.target.value as MediaSettings["screenResolution"],
                    })
                  }
                  className={SELECT_CLASS}
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                  <option value="4k">4K Ultra HD (se suportado)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="set-content"
                className="mb-1.5 block text-xs font-medium text-gray-300"
              >
                Tipo de conteúdo da tela
              </label>
              <select
                id="set-content"
                value={settings.screenContentType}
                onChange={(e) =>
                  onUpdateSettings({
                    screenContentType: e.target.value as MediaSettings["screenContentType"],
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="detail">Telas e texto (código, planilhas, UI) — mais nítido</option>
                <option value="motion">Vídeo e jogos — mais fluido</option>
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Conteúdo estático gasta o orçamento de bitrate com quadro a quadro; escolher
                a opção errada deixa o texto ilegível.
              </p>
            </div>
          </fieldset>

          {/* Otimização de Áudio */}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span>Aprimoramentos de Microfone</span>
            </div>

            <div className="space-y-2.5">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-muted/60 p-3 transition-colors hover:border-indigo-500/50">
                <div>
                  <span className="block text-sm font-medium text-white">Cancelamento de Eco</span>
                  <span className="text-xs text-muted-foreground">
                    Evita retorno de áudio dos alto-falantes
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.echoCancellation}
                  onChange={(e) => onUpdateSettings({ echoCancellation: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-muted/60 p-3 transition-colors hover:border-indigo-500/50">
                <div>
                  <span className="block text-sm font-medium text-white">
                    Supressão de Ruído de Fundo
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Filtra digitação no teclado e barulhos ambientais
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.noiseSuppression}
                  onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-muted/60 p-3 transition-colors hover:border-indigo-500/50">
                <div>
                  <span className="block text-sm font-medium text-white">Ganho Automático (AGC)</span>
                  <span className="text-xs text-muted-foreground">
                    Nivela o volume da sua voz automaticamente
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoGainControl}
                  onChange={(e) => onUpdateSettings({ autoGainControl: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Seleção de Dispositivos */}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              <span>Dispositivos Conectados</span>
            </div>

            <div className="space-y-3">
              <DeviceSelect
                id="set-mic"
                label="Microfone"
                devices={devices.audioInputs}
                fallback="Microfone"
                selectedId={settings.audioInputId}
                onSelect={(audioInputId) => onUpdateSettings({ audioInputId })}
                emptyMessage="Nenhum microfone listado. Autorize o acesso ao microfone nas permissões do navegador para ver os dispositivos conectados."
              />

              <DeviceSelect
                id="set-cam"
                label="Câmera"
                devices={devices.videoInputs}
                fallback="Câmera"
                selectedId={settings.videoInputId}
                onSelect={(videoInputId) => onUpdateSettings({ videoInputId })}
                emptyMessage="Nenhuma câmera listada. Autorize o acesso à câmera nas permissões do navegador para ver os dispositivos conectados."
              />

              {canSelectAudioOutput && (
                <DeviceSelect
                  id="set-out"
                  label="Saída de Áudio (Alto-falante)"
                  devices={devices.audioOutputs}
                  fallback="Alto-falante"
                  selectedId={settings.audioOutputId}
                  onSelect={(audioOutputId) => onUpdateSettings({ audioOutputId })}
                  emptyMessage="Nenhum alto-falante listado. Verifique as permissões de áudio do navegador."
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );

  // Portal no body: garante que o overlay escape de qualquer contexto de
  // empilhamento do layout da sala e permite inertizar todo o resto do body.
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
