"use client";

import { X, Sliders, Monitor, Mic, Volume2, ShieldCheck } from "lucide-react";

export interface MediaSettings {
  screenFps: number;
  screenResolution: "720p" | "1080p" | "4k";
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
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  devices,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-[#11131a] p-6 shadow-2xl text-foreground">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Configurações de Mídia</h2>
              <p className="text-xs text-muted-foreground">Ajuste de transmissão, áudio e dispositivos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-secondary hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Compartilhamento de Tela */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
              <Monitor className="h-4 w-4" />
              <span>Transmissão de Tela (Alta Fidelidade)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1.5">Taxa de Quadros (FPS)</label>
                <select
                  value={settings.screenFps}
                  onChange={(e) => onUpdateSettings({ screenFps: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-[#181b26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={60}>60 FPS (Ultra Fluído - Jogos & Vídeos)</option>
                  <option value={30}>30 FPS (Padrão Recomendado)</option>
                  <option value={15}>15 FPS (Economia de Banda)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1.5">Resolução de Tela</label>
                <select
                  value={settings.screenResolution}
                  onChange={(e) => onUpdateSettings({ screenResolution: e.target.value as any })}
                  className="w-full rounded-lg border border-border bg-[#181b26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                  <option value="4k">4K Ultra HD (se suportado)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Otimização de Áudio */}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
              <Mic className="h-4 w-4" />
              <span>Aprimoramentos de Microfone</span>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-[#161922] p-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <div>
                  <span className="text-sm font-medium text-white block">Cancelamento de Eco</span>
                  <span className="text-xs text-muted-foreground">Evita retorno de áudio dos alto-falantes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.echoCancellation}
                  onChange={(e) => onUpdateSettings({ echoCancellation: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-[#161922] p-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <div>
                  <span className="text-sm font-medium text-white block">Supressão de Ruído de Fundo</span>
                  <span className="text-xs text-muted-foreground">Filtra digitação no teclado e barulhos ambientes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.noiseSuppression}
                  onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-[#161922] p-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <div>
                  <span className="text-sm font-medium text-white block">Ganho Automático (AGC)</span>
                  <span className="text-xs text-muted-foreground">Nivela o volume da sua voz automaticamente</span>
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
              <Volume2 className="h-4 w-4" />
              <span>Dispositivos Conectados</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Microfone</label>
                <select
                  value={settings.audioInputId || ""}
                  onChange={(e) => onUpdateSettings({ audioInputId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-[#181b26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {devices.audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microfone (${d.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Câmera</label>
                <select
                  value={settings.videoInputId || ""}
                  onChange={(e) => onUpdateSettings({ videoInputId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-[#181b26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {devices.videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Câmera (${d.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>

              {devices.audioOutputs.length > 0 && (
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">Saída de Áudio (Alto-falante)</label>
                  <select
                    value={settings.audioOutputId || ""}
                    onChange={(e) => onUpdateSettings({ audioOutputId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-[#181b26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {devices.audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Alto-falante (${d.deviceId.slice(0, 5)})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-border/60 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
