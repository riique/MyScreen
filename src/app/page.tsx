"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Video,
  Volume2,
  ShieldCheck,
  Disc,
  Zap,
  ArrowRight,
  Plus,
  Tv,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateInstant = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.room?.id) {
        router.push(`/room/${data.room.id}`);
      }
    } catch (error) {
      console.error("Erro ao criar sala instantânea:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    // Support full URL or just room ID
    let cleanCode = roomCode.trim();
    if (cleanCode.includes("/room/")) {
      cleanCode = cleanCode.split("/room/")[1].split("?")[0];
    }
    router.push(`/room/${cleanCode}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Glow gradient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/15 via-violet-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 sm:px-6 pt-16 pb-20 text-center max-w-5xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400 mb-6 backdrop-blur-md">
          <Zap className="h-3.5 w-3.5" />
          <span>LiveKit SFU em Servidor Próprio • Baixíssima Latência</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Transmita sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">Tela e Câmera</span> com Áudio Perfeito
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Compartilhe sua tela em até 60 FPS com áudio cristalino do sistema enquanto sua webcam transmite simultaneamente. Qualquer pessoa assiste e interage em tempo real.
        </p>

        {/* Action Cards Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto text-left">
          {/* Instant Meeting Card */}
          <div className="rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl flex flex-col justify-between hover:border-indigo-500/50 transition-all group">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Plus className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Criar Nova Reunião</h2>
              <p className="text-sm text-gray-400 mt-1">
                Gere uma sala instantânea com link direto para convidar seus amigos ou equipe.
              </p>
            </div>

            <button
              onClick={handleCreateInstant}
              disabled={loading}
              className="mt-6 flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-all cursor-pointer"
            >
              <Video className="h-4 w-4" />
              <span>{loading ? "Criando sala..." : "Iniciar Agora"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Join by Code Card */}
          <div className="rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl flex flex-col justify-between hover:border-indigo-500/50 transition-all">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 mb-4">
                <Tv className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Entrar em uma Sala</h2>
              <p className="text-sm text-gray-400 mt-1">
                Insira o código da reunião ou cole o link compartilhado.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="mt-6 flex items-center gap-2">
              <input
                type="text"
                placeholder="Código ou link (ex: abc-def-ghi)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-[#181b26] px-3.5 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-white hover:bg-secondary/80 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="container mx-auto px-4 sm:px-6 py-16 border-t border-border/60 max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Engenharia de Mídia Feita para Alta Fidelidade
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            Projetado para transmissão contínua sem comprometer a qualidade do áudio ou vídeo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 mb-4">
              <Monitor className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Tela e Câmera Concomitantes</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Transmita sua tela inteira, janela ou aba do navegador ao mesmo tempo em que sua webcam permanece ativa em Picture-in-Picture ou grade.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400 mb-4">
              <Volume2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Áudio Estéreo do Sistema</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Compartilhe o som de vídeos, jogos e aplicações com mixagem em tempo real e filtros de cancelamento de eco e supressão de ruído.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20 text-red-400 mb-4">
              <Disc className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Gravação Local com 1 Clique</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Grave a apresentação e o áudio diretamente no seu próprio navegador via MediaRecorder, sem sobrecarregar a CPU do seu servidor VPS.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
