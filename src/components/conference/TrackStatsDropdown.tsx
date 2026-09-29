"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Gauge,
  Wifi,
  Film,
  Layers,
  ArrowDownUp,
  X,
} from "lucide-react";
import { TrackReferenceOrPlaceholder, isTrackReference } from "@livekit/components-react";
import {
  isLocalTrack,
  type AudioReceiverStats,
  type AudioSenderStats,
  type Track,
  type VideoReceiverStats,
  type VideoSenderStats,
} from "livekit-client";

interface TrackStatsDropdownProps {
  trackRef: TrackReferenceOrPlaceholder;
  size?: "sm" | "md";
  className?: string;
}

/**
 * O enum `ConnectionQuality` do SDK tem cinco valores: além de `excellent`,
 * `good` e `poor`, ele traz `lost` (conexão com o SFU interrompida) e
 * `unknown`, que é o valor inicial de `Participant._connectionQuality` — um
 * participante recem-conectado ainda não tem medição, e dizer "Excelente"
 * seria afirmar saúde onde nada foi medido.
 */
type QualityTone = "excellent" | "good" | "poor" | "lost" | "unknown";

interface StatsData {
  /** `null` = ainda não medido (primeira amostra, contador reiniciado, faixa pausada). */
  fps: number | null;
  resolution: string;
  bitrate: string;
  latencyMs: number | null;
  packetsLost: number;
  jitterMs: number | null;
  codec: string;
  quality: string;
  qualityTone: QualityTone;
  framesDropped: number;
  framesReceived: number;
  pliCount: number;
  nackCount: number;
  firCount: number;
  decoder: string;
}

const INITIAL_STATS: StatsData = {
  fps: null,
  resolution: "--",
  bitrate: "--",
  latencyMs: null,
  packetsLost: 0,
  jitterMs: null,
  codec: "--",
  quality: "n/d",
  qualityTone: "unknown",
  framesDropped: 0,
  framesReceived: 0,
  pliCount: 0,
  nackCount: 0,
  firCount: 0,
  decoder: "--",
};

const QUALITY_TEXT: Record<QualityTone, string> = {
  excellent: "Excelente",
  good: "Boa",
  poor: "Instável",
  lost: "Conexão perdida",
  unknown: "n/d",
};

const QUALITY_TEXT_CLASS: Record<QualityTone, string> = {
  excellent: "text-emerald-400",
  good: "text-emerald-400",
  poor: "text-amber-400",
  lost: "text-red-400",
  unknown: "text-gray-400",
};

/** Só a bolinha pulsante verde pressupõe uma medição favorável em curso. */
const QUALITY_DOT_CLASS: Record<QualityTone, string> = {
  excellent: "bg-emerald-400 animate-pulse",
  good: "bg-emerald-400",
  poor: "bg-amber-400",
  lost: "bg-red-400",
  unknown: "bg-gray-500",
};

function toQualityTone(quality: string): QualityTone {
  switch (quality) {
    case "excellent":
    case "good":
    case "poor":
    case "lost":
      return quality;
    default:
      return "unknown";
  }
}

/** `ReceiverStats`/`SenderStats` são privados no SDK; as variantes públicas são. */
type AnyReceiverStats = AudioReceiverStats | VideoReceiverStats;
type AnySenderStats = AudioSenderStats | VideoSenderStats;

/**
 * `getReceiverStats()` só existe em `RemoteVideoTrack`/`RemoteAudioTrack` e
 * `getSenderStats()` só em `LocalVideoTrack`/`LocalAudioTrack`. Nenhum dos dois
 * está na classe base `Track`, então declaramos aqui a forma mínima observada.
 */
function hasReceiverStats(
  track: Track
): track is Track & { getReceiverStats(): Promise<AnyReceiverStats | undefined> } {
  return "getReceiverStats" in track && typeof track.getReceiverStats === "function";
}

function hasSenderStats(
  track: Track
): track is Track & { getSenderStats(): Promise<AnySenderStats | AnySenderStats[] | undefined> } {
  return "getSenderStats" in track && typeof track.getSenderStats === "function";
}

export function TrackStatsDropdown({ trackRef, size = "md", className = "" }: TrackStatsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<StatsData>(INITIAL_STATS);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevBytesRef = useRef<{ bytes: number; timestamp: number } | null>(null);
  const prevFramesRef = useRef<{ frames: number; timestamp: number } | null>(null);

  useEffect(() => setMounted(true), []);

  // Close on click outside / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // O painel vive num portal fora do tile, então precisa ser testado à parte.
      if (dropdownRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Fetch real-time WebRTC stats every second when open
  useEffect(() => {
    if (!isOpen || !isTrackReference(trackRef)) return;

    const track = trackRef.publication?.track;
    if (!track) return;

    // Amostras da abertura anterior não podem alimentar o primeiro tick da nova:
    // senão o delta de bytes/quadros vira um bitrate/FPS espúrio.
    prevBytesRef.current = null;
    prevFramesRef.current = null;

    let isSubscribed = true;
    let isFetching = false;

    const updateStats = async () => {
      // A consulta do tick anterior ainda não resolveu: não empilhar chamadas.
      if (isFetching) return;
      isFetching = true;
      try {
        const dimensions = isLocalTrack(track) ? track.dimensions : undefined;
        let fps: number | null = null;
        let width = dimensions?.width || 0;
        let height = dimensions?.height || 0;
        let latency: number | null = null;
        let jitter: number | null = null;
        let packetsLost = 0;
        let totalBytes: number | null = null;
        let codec = "--";
        let framesDropped = 0;
        let framesReceived = 0;
        let pliCount = 0;
        let nackCount = 0;
        let firCount = 0;
        let decoder = "--";
        // Relógio do próprio relatório RTCStats (ms). Taxas derivadas dele são
        // reprodutíveis; com `Date.now()` acumulariam o jitter do polling.
        let statTimestamp: number | null = null;

        // Query track stats if available
        if (hasReceiverStats(track)) {
          const rStats = await track.getReceiverStats();
          // O tile pode ter fechado/desmontado enquanto a consulta resolvia.
          if (!isSubscribed) return;
          if (rStats) {
            statTimestamp = rStats.timestamp;
            if (rStats.packetsLost !== undefined) packetsLost = rStats.packetsLost;
            if (rStats.jitter !== undefined) jitter = Math.round(rStats.jitter * 1000);
            if (rStats.bytesReceived !== undefined) totalBytes = rStats.bytesReceived;

            // Só `VideoReceiverStats` descreve dimensões e integridade do decode.
            if (rStats.type === "video") {
              if (rStats.frameWidth) width = rStats.frameWidth;
              if (rStats.frameHeight) height = rStats.frameHeight;
              if (rStats.mimeType) codec = rStats.mimeType.replace(/^video\//i, "").toUpperCase();
              framesDropped = rStats.framesDropped ?? 0;
              framesReceived = rStats.framesReceived ?? 0;
              pliCount = rStats.pliCount ?? 0;
              nackCount = rStats.nackCount ?? 0;
              firCount = rStats.firCount ?? 0;
              decoder = rStats.decoderImplementation ?? "--";

              // FPS = delta de `framesDecoded` sobre o delta de tempo do próprio
              // stat. Sem amostra anterior, ou com contador que voltou atrás
              // (troca de camada simulcast / republicação), não há taxa: `null`.
              const currentFrames = rStats.framesDecoded;
              const sampleTs = rStats.timestamp;
              if (typeof currentFrames === "number" && typeof sampleTs === "number" && sampleTs > 0) {
                const prev = prevFramesRef.current;
                if (prev && currentFrames >= prev.frames && sampleTs > prev.timestamp) {
                  const dFrames = currentFrames - prev.frames;
                  const dTime = (sampleTs - prev.timestamp) / 1000;
                  fps = dTime > 0 ? Math.max(0, Math.round(dFrames / dTime)) : null;
                }
                prevFramesRef.current = { frames: currentFrames, timestamp: sampleTs };
              }
            }
          }
        } else if (hasSenderStats(track)) {
          const sStats = await track.getSenderStats();
          if (!isSubscribed) return;
          const stat = Array.isArray(sStats) ? sStats[0] : sStats;
          if (stat) {
            statTimestamp = stat.timestamp;
            if (stat.jitter !== undefined) jitter = Math.round(stat.jitter * 1000);
            if (stat.packetsLost !== undefined) packetsLost = stat.packetsLost;
            if (stat.bytesSent !== undefined) totalBytes = stat.bytesSent;
            // `roundTripTime` só existe no ramo de envio: numa track remota a
            // latência é genuinamente desconhecida e precisa ficar nula (n/d).
            if (stat.roundTripTime !== undefined) {
              latency = Math.round(stat.roundTripTime * 1000);
            }
            if (stat.type === "video") {
              if (stat.frameWidth) width = stat.frameWidth;
              if (stat.frameHeight) height = stat.frameHeight;
              // Safari e Firefox não publicam `framesPerSecond` no `outbound-rtp`;
              // valor ausente precisa virar `null`, nunca um número inventado.
              if (typeof stat.framesPerSecond === "number" && stat.framesPerSecond > 0) {
                fps = Math.round(stat.framesPerSecond);
              }
            }
          }
        }

        if (!isSubscribed) return;

        // Calculate bitrate from the byte counter delta
        let bitrateStr = "--";
        if (totalBytes !== null && statTimestamp !== null) {
          const prev = prevBytesRef.current;
          if (prev && statTimestamp > prev.timestamp) {
            const dBytes = totalBytes - prev.bytes;
            const dTime = (statTimestamp - prev.timestamp) / 1000;
            if (dTime > 0 && dBytes >= 0) {
              const bps = (dBytes * 8) / dTime;
              bitrateStr =
                bps > 1_000_000
                  ? `${(bps / 1_000_000).toFixed(1)} Mbps`
                  : `${Math.round(bps / 1000)} kbps`;
            }
          }
          prevBytesRef.current = { bytes: totalBytes, timestamp: statTimestamp };
        }

        // Connection Quality — `unknown`/`lost` não autorizam um rótulo de saúde.
        const qualityTone = toQualityTone(trackRef.participant.connectionQuality);

        setStats({
          fps,
          resolution: width && height ? `${width} × ${height}` : "--",
          bitrate:
            bitrateStr !== "--"
              ? bitrateStr
              : track.currentBitrate
                ? `${Math.round(track.currentBitrate / 1000)} kbps`
                : "--",
          latencyMs: latency,
          packetsLost,
          jitterMs: jitter,
          codec: codec,
          quality: QUALITY_TEXT[qualityTone],
          qualityTone,
          framesDropped,
          framesReceived,
          pliCount,
          nackCount,
          firCount,
          decoder,
        });
      } catch (err) {
        if (err instanceof Error && "code" in err) {
          console.debug(`Falha ao coletar estatísticas do track (${err.code}):`, err.message);
        } else {
          console.debug("Erro ao coletar estatísticas do track:", err);
        }
      } finally {
        isFetching = false;
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isOpen, trackRef]);

  // O painel precisa existir antes de medir a si mesmo para se posicionar.
  const positionPanel = useCallback(() => {
    const trigger = dropdownRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const margin = 8;
    const gap = 8;

    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      const above = rect.top - height - gap;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - height - margin);
    }

    let left = rect.right - width;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin));

    setPanelPos((prev) =>
      prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
        ? prev
        : { top, left }
    );
  }, []);

  // O tile do vídeo tem `overflow-hidden` e cria stacking context: um painel
  // absoluto ali dentro seria cortado. Por isso ele é posicionado em `fixed` fora
  // do tile, com as coordenadas medidas antes do primeiro paint. Dentro de um
  // tile em tela cheia só os descendentes dele pintam, então o destino do portal
  // passa a ser o próprio elemento em tela cheia.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelPos(null);
      setPortalRoot(null);
      return;
    }
    // `document.fullscreenElement` e `Element`, nao `HTMLElement`; o React exige
    // o tipo mais estreito no state.
    const syncRoot = () =>
      setPortalRoot((document.fullscreenElement as HTMLElement | null) ?? document.body);
    syncRoot();
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    document.addEventListener("fullscreenchange", syncRoot);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      document.removeEventListener("fullscreenchange", syncRoot);
    };
  }, [isOpen, positionPanel]);

  const buttonSizeClass =
    size === "sm"
      ? "h-7 w-7 rounded-lg text-xs"
      : "h-8 w-8 rounded-xl text-sm";

  const panel =
    isOpen && mounted && portalRoot
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Estatísticas do fluxo"
            onClick={(e) => e.stopPropagation()}
            style={
              panelPos
                ? { top: panelPos.top, left: panelPos.left }
                : { top: 0, left: 0, visibility: "hidden" }
            }
            className="fixed z-[100] w-64 rounded-2xl border border-white/15 bg-[#0b0d14]/95 p-4 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span className="text-xs font-bold text-gray-200">Estatísticas do Fluxo</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar estatísticas"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="space-y-2.5 text-xs">
              {/* FPS */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Gauge className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                  Taxa de Quadros
                </span>
                <span
                  className={`font-mono font-bold ${
                    stats.fps === null ? "text-gray-500" : "text-emerald-400"
                  }`}
                >
                  {stats.fps !== null ? `${stats.fps} FPS` : "--"}
                </span>
              </div>

              {/* Resolution */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Layers className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  Resolução
                </span>
                <span className="font-mono font-semibold text-gray-200">
                  {stats.resolution}
                </span>
              </div>

              {/* Bitrate */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <ArrowDownUp className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  Taxa de Bits
                </span>
                <span className="font-mono font-semibold text-gray-200">
                  {stats.bitrate}
                </span>
              </div>

              {/* Latency / Ping — só o ramo de envio reporta RTT */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Wifi className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
                  Latência (RTT)
                </span>
                <span className="font-mono font-semibold text-gray-200">
                  {stats.latencyMs !== null ? `${stats.latencyMs} ms` : "n/d"}
                </span>
              </div>

              {/* Jitter */}
              {stats.jitterMs !== null && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <Activity className="h-3.5 w-3.5 text-pink-400" aria-hidden="true" />
                    Jitter
                  </span>
                  <span className="font-mono font-semibold text-gray-200">
                    {stats.jitterMs} ms
                  </span>
                </div>
              )}

              {/* Codec */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Film className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                  Codec
                </span>
                <span className="font-mono font-semibold text-gray-200">
                  {stats.codec}
                </span>
              </div>

              {/* Packet Loss */}
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-gray-400">Perda de Pacotes</span>
                <span className={`font-mono font-semibold ${stats.packetsLost > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {stats.packetsLost} pacotes
                </span>
              </div>

              {/* Quality Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Qualidade de Conexão</span>
                <span
                  className={`flex items-center gap-1 font-semibold ${QUALITY_TEXT_CLASS[stats.qualityTone]}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${QUALITY_DOT_CLASS[stats.qualityTone]}`}
                    aria-hidden="true"
                  />
                  {stats.quality}
                </span>
              </div>

              {/* Integridade do decodificado — o que explica vídeo ruim numa track remota */}
              <div className="space-y-2.5 border-t border-white/10 pt-2 text-[11px] text-gray-400">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Quadros descartados</span>
                  <span className={`font-mono font-semibold ${stats.framesDropped > 0 ? "text-amber-400" : "text-gray-200"}`}>
                    {stats.framesReceived > 0 ? `${stats.framesDropped} / ${stats.framesReceived}` : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400">PLI / NACK / FIR</span>
                  <span className="font-mono font-semibold text-gray-200">
                    {stats.framesReceived > 0
                      ? `${stats.pliCount} / ${stats.nackCount} / ${stats.firCount}`
                      : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Decoder</span>
                  <span
                    className="truncate font-mono font-semibold text-gray-200"
                    title={stats.decoder !== "--" ? stats.decoder : undefined}
                  >
                    {stats.decoder}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          portalRoot
        )
      : null;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center bg-black/65 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white transition-all shadow-md hover:scale-105 ${buttonSizeClass} ${
          isOpen ? "bg-indigo-600 text-white border-indigo-400" : ""
        }`}
        title="Ver estatísticas de transmissão (FPS, latência, resolução)"
        aria-label="Ver estatísticas de transmissão"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Activity className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      </button>

      {panel}
    </div>
  );
}
