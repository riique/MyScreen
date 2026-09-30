"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { Sheet, SheetTitle, Stamp, inputClass } from "@/components/sheet";

interface Room {
  id: string;
  title: string;
  isLocked: boolean;
  createdAt: string;
}

const FORM_FIELDS = ["title", "customId", "password"] as const;
type FormField = (typeof FORM_FIELDS)[number];

/**
 * Sem campo `field` na resposta, o texto da mensagem ainda diz qual campo é.
 * Casa por frase, nunca pela palavra solta: "id" aparece dentro de "senha da
 * sala", "sala", "válido" e quase todo outro lado, e casar só com a palavra
 * esconderia o erro no lugar errado.
 */
function errorFieldFor(message: string): FormField | null {
  const m = message.toLowerCase();
  if (m.includes("id da sala")) return "customId";
  if (m.includes("senha")) return "password";
  if (m.includes("titulo") || m.includes("título")) return "title";
  return null;
}

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [customId, setCustomId] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formField, setFormField] = useState<FormField | null>(null);

  const [anonymousRoom, setAnonymousRoom] = useState<Room | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      if (res.status === 401) {
        setAuthRequired(true);
        setRooms([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { rooms: Room[] } = await res.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error("Erro ao carregar salas:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  async function handleCreate(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setFormError(null);
    setFormField(null);
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
        const message = data.error || "Erro ao criar sala.";
        setFormError(message);
        setFormField(
          typeof data.field === "string" && (FORM_FIELDS as readonly string[]).includes(data.field)
            ? (data.field as FormField)
            : errorFieldFor(message),
        );
        return;
      }

      setTitle("");
      setCustomId("");
      setPassword("");

      // Sala anônima não entra no painel: o banco não sabe de quem é. O link é
      // a única cópia que existe, então ele aparece inteiro e já vem copiado.
      if (data.anonymous === true) {
        setAnonymousRoom(data.room);
        setCopiedId(data.room.id);
        void copyToClipboard(`${window.location.origin}/room/${data.room.id}`);
        return;
      }
      await fetchRooms();
    } catch {
      setFormError("Erro de comunicação ao criar sala.");
      setFormField(null);
    } finally {
      setCreating(false);
    }
  }

  async function copyRoomLink(roomId: string) {
    const ok = await copyToClipboard(`${window.location.origin}/room/${roomId}`);
    if (ok) {
      setCopyFailedId(null);
      setCopiedId(roomId);
    } else {
      // Sem clipboard o link ainda precisa sobreviver: vira texto selecionável.
      setCopyFailedId(roomId);
      setCopiedId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-4 py-16 sm:px-6">
        <p className="font-mono text-[0.8125rem] text-ink-3">Carregando salas...</p>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="mx-auto w-full max-w-[34rem] px-4 py-20 sm:px-6">
        <Sheet className="p-7">
          <SheetTitle className="text-[1.375rem]">Sua sessão expirou</SheetTitle>
          <p className="mt-2 text-[0.875rem] leading-[1.6] text-ink-2">
            Entre novamente para ver as salas vinculadas à sua conta.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center border border-signal bg-signal px-4 py-2 text-[0.8125rem] font-semibold text-on-signal transition-colors hover:bg-signal-2 [border-radius:var(--radius-sheet)]"
          >
            Entrar novamente
          </Link>
        </Sheet>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-[34rem] px-4 py-20 sm:px-6">
        <Sheet className="p-7">
          <SheetTitle className="text-[1.375rem]">
            Não foi possível carregar suas salas
          </SheetTitle>
          <p className="mt-2 text-[0.875rem] leading-[1.6] text-ink-2">
            Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              void fetchRooms();
            }}
            className="mt-6 inline-flex items-center justify-center border border-rule-2 bg-sheet px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-band [border-radius:var(--radius-sheet)]"
          >
            Tentar novamente
          </button>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pt-12 sm:pt-16">
        <div>
          <SheetTitle>Suas salas de reunião</SheetTitle>
          <p className="mt-2 max-w-[54ch] text-[0.9375rem] leading-[1.6] text-ink-2">
            Gerencie salas permanentes e acesse o link de transmissão a qualquer momento.
          </p>
        </div>
      </div>

      {/* Sala anônima: o link é a única cópia que existe. */}
      {anonymousRoom ? (
        <div className="mt-8 border border-signal-line bg-signal-wash px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-ink">
                Sala &quot;{anonymousRoom.title}&quot; criada
              </h2>
              <p className="mt-1 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-ink-2">
                Salas criadas sem conta não ficam salvas no painel. Guarde o link agora.
              </p>
              <p className="mt-2 break-all font-mono text-[0.8125rem] text-ink">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/room/${anonymousRoom.id}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => copyRoomLink(anonymousRoom.id)}
                className="border border-rule-2 bg-sheet px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-band [border-radius:var(--radius-sheet)]"
              >
                {copiedId === anonymousRoom.id ? "Copiado" : "Copiar link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAnonymousRoom(null);
                  setCopiedId(null);
                }}
                className="border border-transparent px-3 py-1.5 text-[0.8125rem] text-ink-2 transition-colors hover:text-ink [border-radius:var(--radius-sheet)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Criar sala é uma faixa na própria folha, não um modal: são três campos,
          nadainterruptivo, e a regra do mundo é que nada flutua sobre a folha. */}
      <Sheet className="mt-8">
        <form onSubmit={handleCreate} className="p-5 sm:p-6" noValidate>
          <h2 className="border-b border-rule pb-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
            Criar nova sala permanente
          </h2>

          {formError ? (
            <p
              id="form-erro-criar-sala"
              role="alert"
              className="mt-4 border border-alert-line bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="sala-title"
                className="block border-b border-rule pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
              >
                Título da sala
              </label>
              <input
                id="sala-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Sala de Reunião da Diretoria"
                required
                maxLength={120}
                aria-invalid={formField === "title"}
                className={`${inputClass} mt-2`}
              />
            </div>

            <div>
              <label
                htmlFor="sala-custom-id"
                className="block border-b border-rule pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
              >
                ID personalizado
              </label>
              <div className="mt-2 flex items-stretch">
                <span className="flex items-center border border-r-0 border-rule-2 bg-band px-2.5 font-mono text-[0.8125rem] text-ink-3 [border-radius:var(--radius-cell)_0_0_var(--radius-cell)]">
                  /room/
                </span>
                <input
                  id="sala-custom-id"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder="minha-sala-vip"
                  maxLength={32}
                  aria-invalid={formField === "customId"}
                  className={`${inputClass} font-mono [border-radius:0_var(--radius-cell)_var(--radius-cell)_0]`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sala-password"
                className="block border-b border-rule pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
              >
                Senha de acesso
              </label>
              <input
                id="sala-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para sala aberta"
                aria-invalid={formField === "password"}
                className={`${inputClass} mt-2`}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:bg-signal-2 disabled:pointer-events-none disabled:opacity-40 [border-radius:var(--radius-sheet)]"
            >
              {creating ? "Criando..." : "Salvar sala"}
            </button>
          </div>
        </form>
      </Sheet>

      {/* A lista é uma tabela pautada: o formato nativo da folha. */}
      {rooms.length === 0 ? (
        <Sheet className="mt-8 p-7">
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
            Nenhuma sala salva ainda
          </h2>
          <p className="mt-2 max-w-[54ch] text-[0.875rem] leading-[1.6] text-ink-2">
            Crie sua primeira sala permanente com ID personalizado ou proteção por senha.
          </p>
        </Sheet>
      ) : (
        <Sheet className="mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <caption className="sr-only">
                Salas criadas por esta conta, com ID, estado de acesso e data de criação
              </caption>
              <thead>
                <tr className="border-b border-rule bg-band">
                  <th
                    scope="col"
                    className="px-5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
                  >
                    Sala
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
                  >
                    Acesso
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
                  >
                    Criada
                  </th>
                  <th scope="col" className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-b border-rule last:border-b-0">
                    <th
                      scope="row"
                      className="px-5 py-4 text-[0.875rem] font-medium text-ink [font-weight:500]"
                    >
                      {room.title}
                    </th>
                    <td className="px-5 py-4 font-mono text-[0.8125rem] text-ink-2">
                      {room.id}
                    </td>
                    <td className="px-5 py-4">
                      <Stamp state={room.isLocked ? "travado" : "pendente"}>
                        {room.isLocked ? "Com senha" : "Pública"}
                      </Stamp>
                    </td>
                    <td className="px-5 py-4 font-mono text-[0.8125rem] text-ink-3">
                      {new Date(room.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => copyRoomLink(room.id)}
                          aria-label={
                            copiedId === room.id
                              ? `Link da sala ${room.title} copiado`
                              : `Copiar link da sala ${room.title}`
                          }
                          className="border border-rule-2 bg-sheet px-3 py-1.5 text-[0.8125rem] text-ink transition-colors hover:bg-band [border-radius:var(--radius-cell)]"
                        >
                          {copiedId === room.id ? "Copiado" : "Copiar"}
                        </button>
                        <Link
                          href={`/room/${room.id}`}
                          className="border border-rule-2 bg-sheet px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band [border-radius:var(--radius-cell)]"
                        >
                          Entrar
                        </Link>
                      </div>
                      {copyFailedId === room.id ? (
                        <p className="mt-2 max-w-[22rem] text-right text-[0.75rem] leading-[1.45] text-ink-3">
                          Não foi possível copiar automaticamente. Copie o endereço:{" "}
                          <span className="break-all font-mono text-ink-2">
                            {`${window.location.origin}/room/${room.id}`}
                          </span>
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
      )}
    </div>
  );
}
