"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Video,
  Lock,
  Globe,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Shield,
  LayoutDashboard,
} from "lucide-react";

interface RoomItem {
  id: string;
  title: string;
  isLocked: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [customId, setCustomId] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error("Erro ao carregar salas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setCreating(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          customId: customId.trim() || undefined,
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Erro ao criar sala.");
        return;
      }

      setIsModalOpen(false);
      setTitle("");
      setCustomId("");
      setPassword("");
      fetchRooms();
    } catch {
      setFormError("Erro de comunicação ao criar sala.");
    } finally {
      setCreating(false);
    }
  };

  const copyRoomLink = (roomId: string) => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <LayoutDashboard className="h-4 w-4" />
            <span>Painel de Controle</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Suas Salas de Reunião</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie salas permanentes e acesse o link de transmissão a qualquer momento.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Criar Nova Sala</span>
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-[#11131c]/60 p-12 text-center max-w-lg mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 mx-auto mb-3">
              <Video className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhuma sala salva ainda</h3>
            <p className="text-sm text-gray-400 mt-1 mb-6">
              Crie sua primeira sala permanente com ID personalizado ou proteção por senha.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Criar Minha Primeira Sala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-xl hover:border-indigo-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                        room.isLocked
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {room.isLocked ? (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Com Senha</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3" />
                          <span>Pública</span>
                        </>
                      )}
                    </span>

                    <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3" />
                      {new Date(room.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {room.title}
                  </h3>
                  <p className="text-xs font-mono text-gray-400 mt-1">ID: {room.id}</p>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
                  <Link
                    href={`/room/${room.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>Entrar na Sala</span>
                  </Link>

                  <button
                    onClick={() => copyRoomLink(room.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#181b26] text-gray-300 hover:bg-secondary border border-border/80 transition-colors"
                    title="Copiar link"
                  >
                    {copiedId === room.id ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar Sala */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Criar Nova Sala Permanente</h2>
            <p className="text-xs text-gray-400 mb-5">
              Personalize o título, ID da URL e proteja com senha se desejar.
            </p>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-950/60 border border-red-500/40 p-3 text-xs text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Título da Sala *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sala de Reunião da Diretoria"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-border bg-[#181b26] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  ID Personalizado da URL (Opcional)
                </label>
                <div className="flex items-center rounded-xl border border-border bg-[#181b26] px-3 py-2 text-xs text-gray-400">
                  <span className="shrink-0 text-gray-500">/room/</span>
                  <input
                    type="text"
                    placeholder="minha-sala-vip"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none ml-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>Senha de Acesso (Opcional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Deixe em branco para sala aberta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-[#181b26] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {creating ? "Criando..." : "Salvar Sala"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
