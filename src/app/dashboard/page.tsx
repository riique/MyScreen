"use client";

import { useEffect, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import Link from "next/link";
import {
  Plus,
  Video,
  Lock,
  Globe,
  Copy,
  Check,
  Calendar,
  Shield,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

type FormField = "title" | "customId" | "password";

interface RoomItem {
  id: string;
  title: string;
  isLocked: boolean;
  createdAt: string;
}

/**
 * A API devolve texto livre (`Campo "customId" tem formato inválido.`,
 * `Este ID de sala já está em uso.`). Traduz para o campo do formulário para
 * que o leitor de tela anuncie `aria-invalid` no input certo.
 */
function errorFieldFor(message: string): FormField | null {
  const normalized = message.toLowerCase();
  const quoted = /campo "([a-z]+)"/.exec(normalized)?.[1];
  if (quoted === "title" || quoted === "customid" || quoted === "password") {
    return quoted === "customid" ? "customId" : (quoted as FormField);
  }
  if (normalized.includes("senha")) return "password";
  if (normalized.includes("id")) return "customId";
  if (normalized.includes("título") || normalized.includes("titulo")) return "title";
  return null;
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Sessao expirada: a API responde 401, o que antes virava estado vazio. */
  const [authRequired, setAuthRequired] = useState(false);
  /** Erro de carga (rede/500) — distinto de "nao tenho salas". */
  const [loadError, setLoadError] = useState(false);
  /** Sala criada sem conta: o painel nao a lista, entao mostramos o link. */
  const [anonymousRoom, setAnonymousRoom] = useState<RoomItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [customId, setCustomId] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [errorField, setErrorField] = useState<FormField | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** Copia falhou: mostramos o link para copiar a mao. */
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      if (res.status === 401) {
        setAuthRequired(true);
        setRooms([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuthRequired(false);
      setLoadError(false);
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch (err) {
      console.error("Erro ao carregar salas:", err);
      setLoadError(true);
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
    setErrorField(null);
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
        const message: string = data.error || "Erro ao criar sala.";
        setFormError(message);
        setErrorField(errorFieldFor(message));
        return;
      }

      setIsModalOpen(false);
      setTitle("");
      setCustomId("");
      setPassword("");

      if (data.anonymous) {
        // Sala sem dono: ela existe e tem link, mas nunca vai aparecer nesta
        // lista. Sem mostrar o link aqui, o usuario perde a reuniao que acabou
        // de criar sem nenhum aviso.
        setAnonymousRoom(data.room);
        setCopiedId(data.room.id);
        void copyToClipboard(`${window.location.origin}/room/${data.room.id}`);
        return;
      }
      await fetchRooms();
    } catch {
      setFormError("Erro de comunicação ao criar sala.");
      setErrorField(null);
    } finally {
      setCreating(false);
    }
  };

  const copyRoomLink = async (roomId: string) => {
    const url = `${window.location.origin}/room/${roomId}`;
    // Só anunciar "copiado" quando a escrita realmente aconteceu: em contexto
    // não seguro a API não existe e o clique pareceria quebrado.
    if (await copyToClipboard(url)) {
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2500);
    } else {
      // A copia falhou: o painel de salas mostra o endereco em texto para
      // copiar a mao, entao nao ha estado separado para avisar.
      setCopyFailedId(roomId);
      setTimeout(() => setCopyFailedId(null), 4000);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <LayoutDashboard className="h-4 w-4" />
            <span>Painel de Controle</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Suas Salas de Reunião</h1>
          <p className="mt-1 text-sm text-gray-400">
            Gerencie salas permanentes e acesse o link de transmissão a qualquer momento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 ${FOCUS_RING}`}
        >
          <Plus className="h-4 w-4" />
          <span>Criar Nova Sala</span>
        </button>
      </div>

      {/* Sala criada sem conta: ela existe e tem link, mas nao volta nesta lista. */}
      {anonymousRoom && (
        <div
          role="status"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Sala &quot;{anonymousRoom.title}&quot; criada
            </p>
            <p className="mt-0.5 text-xs text-indigo-200">
              {copiedId === anonymousRoom.id
                ? "Link copiado para a area de transferencia."
                : "Salas criadas sem conta nao ficam salvas no painel. Guarde o link agora."}
            </p>
            <code className="mt-2 block select-all break-all rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-indigo-100">
              {typeof window !== "undefined"
                ? `${window.location.origin}/room/${anonymousRoom.id}`
                : `/room/${anonymousRoom.id}`}
            </code>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void copyRoomLink(anonymousRoom.id)}
              className={`rounded-xl border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/20 ${FOCUS_RING}`}
            >
              Copiar link
            </button>
            <button
              type="button"
              onClick={() => setAnonymousRoom(null)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold text-gray-400 transition-colors hover:text-white ${FOCUS_RING}`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Rooms Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : authRequired ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/5 p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Sua sessao expirou</h3>
            <p className="mb-6 mt-1 text-sm text-gray-400">
              Entre novamente para ver as salas vinculadas a sua conta.
            </p>
            <Link
              href="/login"
              className={`inline-block rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 ${FOCUS_RING}`}
            >
              Entrar novamente
            </Link>
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-500/5 p-12 text-center"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Nao foi possivel carregar suas salas</h3>
            <p className="mb-6 mt-1 text-sm text-gray-400">
              Verifique sua conexao e tente novamente.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void fetchRooms();
              }}
              className={`rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 ${FOCUS_RING}`}
            >
              Tentar novamente
            </button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border/80 bg-[#11131c]/60 p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <Video className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhuma sala salva ainda</h3>
            <p className="mb-6 mt-1 text-sm text-gray-400">
              Crie sua primeira sala permanente com ID personalizado ou protecao por senha.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 ${FOCUS_RING}`}
            >
              Criar Minha Primeira Sala
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-xl transition-all hover:border-indigo-500/50"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        room.isLocked
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
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

                    <span className="flex items-center gap-1 font-mono text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(room.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-indigo-400">
                    {room.title}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-gray-400">ID: {room.id}</p>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
                  <Link
                    href={`/room/${room.id}`}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 ${FOCUS_RING}`}
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>Entrar na Sala</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => void copyRoomLink(room.id)}
                    aria-label={
                      copiedId === room.id
                        ? `Link da sala ${room.title} copiado`
                        : `Copiar link da sala ${room.title}`
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-[#181b26] text-gray-300 transition-colors hover:bg-secondary ${FOCUS_RING}`}
                  >
                    {copiedId === room.id ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {copyFailedId === room.id && (
                  <code
                    role="status"
                    className="mt-2 block select-all break-all rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-amber-200"
                  >
                    Não foi possível copiar automaticamente. Copie o endereço:{" "}
                    {`${typeof window !== "undefined" ? window.location.origin : ""}/room/${room.id}`}
                  </code>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar Sala */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="criar-sala-titulo"
            className="w-full max-w-md rounded-2xl border border-border/80 bg-[#11131c] p-6 shadow-2xl"
          >
            <h2 id="criar-sala-titulo" className="mb-1 text-xl font-bold text-white">
              Criar Nova Sala Permanente
            </h2>
            <p className="mb-5 text-xs text-gray-400">
              Personalize o título, ID da URL e proteja com senha se desejar.
            </p>

            {formError && (
              <div
                id="form-erro-criar-sala"
                role="alert"
                className="mb-4 rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs text-red-200"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label
                  htmlFor="room-title"
                  className="mb-1 block text-xs font-medium text-gray-300"
                >
                  Título da Sala *
                </label>
                <input
                  id="room-title"
                  name="title"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Ex: Sala de Reunião da Diretoria"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={errorField === "title"}
                  aria-describedby={errorField === "title" ? "form-erro-criar-sala" : undefined}
                  className={`w-full rounded-xl border border-border bg-[#181b26] px-3.5 py-2.5 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none ${FOCUS_RING} ${
                    errorField === "title" ? "border-red-500/70" : ""
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="room-custom-id"
                  className="mb-1 block text-xs font-medium text-gray-300"
                >
                  ID Personalizado da URL (Opcional)
                </label>
                <div className="flex items-center rounded-xl border border-border bg-[#181b26] px-3 py-2 text-xs text-gray-400 focus-within:border-indigo-500">
                  <span className="shrink-0 text-gray-400">/room/</span>
                  <input
                    id="room-custom-id"
                    name="customId"
                    type="text"
                    autoComplete="off"
                    placeholder="minha-sala-vip"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    aria-invalid={errorField === "customId"}
                    aria-describedby={
                      errorField === "customId" ? "form-erro-criar-sala" : undefined
                    }
                    className={`ml-1 flex-1 rounded bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none ${FOCUS_RING} ${
                      errorField === "customId" ? "text-red-200" : ""
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="room-password"
                  className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-300"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>Senha de Acesso (Opcional)</span>
                </label>
                <input
                  id="room-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Deixe em branco para sala aberta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={errorField === "password"}
                  aria-describedby={errorField === "password" ? "form-erro-criar-sala" : undefined}
                  className={`w-full rounded-xl border border-border bg-[#181b26] px-3.5 py-2.5 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none ${FOCUS_RING} ${
                    errorField === "password" ? "border-red-500/70" : ""
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 transition-colors hover:text-white ${FOCUS_RING}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className={`cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
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
