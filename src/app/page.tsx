"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Disc, LayoutDashboard, Monitor, Plus, Tv, Video, Volume2, Zap } from "lucide-react";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * "Iniciar Agora" falhava em silencio: o POST pode falhar por rate limit,
   * erro de rede ou permissao, e o botao apenas voltava de "Criando sala..."
   * para "Iniciar Agora". Na landing, onde conversao e o unico objetivo, um
   * botao clicado sem efeito e indistinguivel de um site quebrado.
   */
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateInstant = async () => {
    setCreateError(null);
    try {
      setLoading(true);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reunião Instantânea" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao criar a sala.");
      }

      router.push(`/room/${data.room.id}`);
    } catch (error) {
      console.error("Erro ao criar sala instantânea:", error);
      setCreateError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível criar a sala. Verifique sua conexão e tente novamente."
      );
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
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Glow gradient background */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b from-indigo-500/15 via-violet-500/5 to-transparent blur-3xl" />

      {/* Hero Section */}
      <section className="container relative mx-auto max-w-5xl px-4 pb-20 pt-16 text-center sm:px-6">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400 backdrop-blur-md">
          <Zap className="h-3.5 w-3.5" />
          <span>LiveKit SFU em Servidor Próprio • Baixíssima Latência</span>
        </div>

        {/* O texto fica em branco sólido sobre o fundo #090a0f; o gradiente foi para
            uma barra decorativa, evitando o recorte de texto ilegível. */}
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Transmira sua{" "}
          <span className="relative inline-block">
            Tela e Câmera
            <span
              aria-hidden="true"
              className="absolute inset-x-0 -bottom-1 h-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 sm:-bottom-1.5 sm:h-2"
            />
          </span>{" "}
          com Áudio Perfeito
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-gray-400 sm:mt-5 sm:text-xl">
          Compartilhe sua tela em até 60 FPS com áudio cristalino do sistema enquanto sua webcam
          transmite simultaneamente. Qualquer pessoa assiste e interage em tempo real.
        </p>

        {/* Action Cards Grid */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-5 text-left md:grid-cols-2 lg:grid-cols-3">
          {/* Instant Meeting Card */}
          <div className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl transition-all hover:border-indigo-500/50">
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 transition-transform group-hover:scale-110">
                <Plus className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Criar Nova Reunião</h2>
              <p className="mt-1 text-sm text-gray-400">
                Gere uma sala instantânea com link direto para convidar seus amigos ou equipe.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateInstant}
              disabled={loading}
              className={`mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
            >
              <Video className="h-4 w-4 shrink-0" />
              <span>{loading ? "Criando sala..." : "Iniciar Agora"}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>

            {createError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-xs text-red-300"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{createError}</span>
              </p>
            )}
          </div>

          {/* Join by Code Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl transition-all hover:border-indigo-500/50">
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                <Tv className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Entrar em uma Sala</h2>
              <p className="mt-1 text-sm text-gray-400">
                Insira o código da reunião ou cole o link compartilhado.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="mt-6 flex flex-col gap-2.5">
              <label htmlFor="room-code" className="sr-only">
                Código ou link da reunião
              </label>
              <input
                id="room-code"
                name="roomCode"
                type="text"
                autoComplete="off"
                placeholder="Código ou link (ex: abc-def-ghi)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className={`w-full rounded-xl border border-border bg-[#181b26] px-3.5 py-3 text-sm text-white placeholder-gray-400 transition-colors focus:border-indigo-500 focus:outline-none ${FOCUS_RING}`}
              />
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                Entrar
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </form>
          </div>

          {/* Painel Card — caminho visível para /dashboard também no mobile */}
          <Link
            href="/dashboard"
            className={`group flex flex-col justify-between rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl transition-all hover:border-indigo-500/50 ${FOCUS_RING}`}
          >
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 transition-transform group-hover:scale-110">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Meu Painel</h2>
              <p className="mt-1 text-sm text-gray-400">
                Acompanhe suas salas, compartilhe links e retome reuniões em um só lugar.
              </p>
            </div>

            <span
              aria-hidden="true"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-white transition-colors group-hover:bg-secondary/80"
            >
              Abrir painel
              <ArrowRight className="h-4 w-4 shrink-0" />
            </span>
          </Link>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="container mx-auto max-w-6xl border-t border-border/60 px-4 py-16 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Engenharia de Mídia Feita para Alta Fidelidade
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Projetado para transmissão contínua sem comprometer a qualidade do áudio ou vídeo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <Monitor className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Tela e Câmera Concomitantes</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Transmita sua tela inteira, janela ou aba do navegador ao mesmo tempo em que sua
              webcam permanece ativa em Picture-in-Picture ou grade.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
              <Volume2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Áudio Estéreo do Sistema</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Compartilhe o som de vídeos, jogos e aplicações com mixagem em tempo real e filtros de
              cancelamento de eco e supressão de ruído.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[#10121a] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20 text-red-400">
              <Disc className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Gravação Local com 1 Clique</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Grave a apresentação e o áudio diretamente no seu próprio navegador via
              MediaRecorder, sem sobrecarregar a CPU do seu servidor VPS.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
