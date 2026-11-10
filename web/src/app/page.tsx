"use client";

import { ArrowRight, Lock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetProse, SheetTitle } from "@/components/sheet";

/**
 * A home e uma folha, nao uma vitrine: o titulo faz a promessa, o cartao logo
 * abaixo faz as duas unicas tarefas da pagina (criar e entrar), e o resto
 * explica o mecanismo. Os ajustes de captura nao moram aqui: sao perguntados
 * na hora de compartilhar a tela, que e quando importam.
 *
 * Medidas de titulo em `rem`, nunca em `ch`: `ch` resolve contra o tamanho de
 * fonte do pai (16px) e nao contra o do `h1`.
 */

const CAPACIDADES = [
  {
    term: "Tela e câmera concomitantes",
    body: "Transmita sua tela inteira, janela ou aba do navegador ao mesmo tempo em que sua webcam permanece ativa, lado a lado com a tela.",
  },
  {
    term: "Áudio estéreo do sistema",
    body: "Compartilhe o som de vídeos, jogos e aplicações junto com a sua voz. O áudio do sistema vai cru, sem cancelamento de eco que o apagaria.",
  },
  {
    term: "Qualidade escolhida na hora",
    body: "Resolução, taxa de quadros e tipo de conteúdo são perguntados quando você vai compartilhar a tela, e quem assiste recebe sempre a camada mais alta, sem trocar de qualidade com o zoom.",
  },
  {
    term: "Diagnóstico honesto",
    body: "O painel de estatísticas mostra quadros descartados, PLI, NACK, FIR e o decoder. O que não foi medido aparece como n/d — o app não inventa número de latência.",
  },
];

/** Campo grande: as duas tarefas da pagina merecem alvo de clique folgado. */
const bigInput =
  "h-12 w-full border border-rule-2 bg-sheet px-4 text-[1rem] text-ink transition-colors placeholder:text-ink-3 hover:border-rule-3 focus:border-signal focus:shadow-[0_0_0_3px_var(--color-signal-wash)] focus:outline-none [border-radius:var(--radius-cell)]";

const HOSPEDAGEM = [
  ["Caddy", "TLS automático, HTTP/2 e HTTP/3, WSS"],
  ["LiveKit SFU", "Go, com TURN embutido — sem container coturn"],
  ["Next.js 15", "App Router, React 19, TypeScript strict"],
  ["SQLite + Prisma", "Volume persistente em /app/data"],
  ["Licença", "MIT"],
];

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Reunião instantânea",
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar a sala.");
      router.push(`/room/${data.room.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a sala. Verifique sua conexão e tente novamente.",
      );
      setCreating(false);
    }
  }

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = roomCode.trim();
    if (!raw) return;
    const code = raw.includes("/room/") ? raw.split("/room/")[1].split(/[?#]/)[0] : raw;
    router.push(`/room/${encodeURIComponent(code)}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 sm:px-6">
      {/* Primeira dobra: a tese e as duas tarefas. */}
      <section className="pt-16 sm:pt-24">
        <SheetTitle className="max-w-[40rem] text-[2.25rem] tracking-[-0.034em] [line-height:1.04] sm:text-[3.5rem]">
          Sua tela, o áudio do sistema e a sua câmera, na mesma faixa.
        </SheetTitle>
        <SheetProse className="mt-6 max-w-[60ch] text-[1.0625rem] leading-[1.6]">
          Compartilhe a tela inteira, uma janela ou só a aba, em até 60 FPS, com o som do
          sistema viajando junto do microfone. Sem conta: crie uma sala e mande o link.
        </SheetProse>

        <Sheet className="mt-12 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Criar */}
            <form onSubmit={handleCreate} className="flex flex-col p-7 sm:p-10">
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                Criar uma sala
              </h2>
              <p className="mt-1.5 text-[0.9375rem] leading-[1.55] text-ink-2">
                Você entra primeiro e manda o link para quem vai assistir.
              </p>

              <div className="mt-7 space-y-4">
                <div>
                  <label htmlFor="room-title" className="label-col block">
                    Nome da sala (opcional)
                  </label>
                  <input
                    id="room-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Ex: Revisão do deploy"
                    autoComplete="off"
                    className={`${bigInput} mt-2`}
                  />
                </div>
                <div>
                  <label htmlFor="room-password" className="label-col block">
                    Senha (opcional)
                  </label>
                  <div className="relative mt-2">
                    <Lock
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
                    />
                    <input
                      id="room-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Deixe em branco para sala aberta"
                      autoComplete="new-password"
                      className={`${bigInput} pl-11`}
                    />
                  </div>
                </div>
              </div>

              {createError ? (
                <p
                  role="alert"
                  className="mt-4 border border-alert-line bg-alert-wash px-4 py-3 text-[0.875rem] text-alert [border-radius:var(--radius-cell)]"
                >
                  {createError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={creating}
                className="mt-7 inline-flex h-12 items-center justify-center gap-2 border border-signal bg-signal px-6 text-[0.9375rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 disabled:pointer-events-none disabled:opacity-60 sm:self-start [border-radius:var(--radius-sheet)]"
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
                {creating ? "Criando sala..." : "Criar e entrar"}
              </button>
            </form>

            {/* Entrar */}
            <form
              onSubmit={handleJoin}
              className="flex flex-col border-t border-rule bg-band p-7 sm:p-10 md:border-t-0 md:border-l"
            >
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                Entrar em uma sala
              </h2>
              <p className="mt-1.5 text-[0.9375rem] leading-[1.55] text-ink-2">
                Cole o link que recebeu, ou só o código da sala.
              </p>

              <div className="mt-7">
                <label htmlFor="room-code" className="label-col block">
                  Código ou link da reunião
                </label>
                <input
                  id="room-code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="abc-def-ghi"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${bigInput} mt-2 font-mono`}
                />
              </div>

              <button
                type="submit"
                disabled={!roomCode.trim()}
                className="mt-7 inline-flex h-12 items-center justify-center gap-2 border border-rule-2 bg-sheet px-6 text-[0.9375rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band-2 disabled:pointer-events-none disabled:opacity-50 sm:self-start [border-radius:var(--radius-sheet)]"
              >
                Entrar
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </form>
          </div>
        </Sheet>
      </section>

      {/* Capacidades como lista de termos, a forma nativa da folha. */}
      <section className="mt-24 sm:mt-32">
        <SheetTitle as="h2" className="max-w-[30rem] text-[1.625rem] sm:text-[2rem]">
          Engenharia de mídia feita para alta fidelidade
        </SheetTitle>
        <SheetProse className="mt-3">
          Projetado para transmissão contínua sem comprometer a qualidade do áudio ou
          vídeo.
        </SheetProse>

        <dl className="mt-8 border-t border-rule">
          {CAPACIDADES.map((c) => (
            <div
              key={c.term}
              className="grid gap-x-8 gap-y-1.5 border-b border-rule py-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
            >
              <dt className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
                {c.term}
              </dt>
              <dd className="max-w-[68ch] text-[0.875rem] leading-[1.6] text-ink-2 [text-wrap:pretty]">
                {c.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Fecho real: a stack de hospedagem e a prova que este produto tem. */}
      <section className="mt-20 sm:mt-32">
        <Sheet>
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:gap-12">
            <div>
              <SheetTitle as="h2" className="max-w-[20rem] text-[1.5rem] sm:text-[1.75rem]">
                Roda no seu servidor, não no nosso
              </SheetTitle>
              <SheetProse className="mt-3">
                Caddy, LiveKit SFU e Next.js sobem juntos com um comando. Você fica com a
                chave do TLS, o banco e o log.
              </SheetProse>
              <pre className="mt-5 overflow-x-auto border border-rule bg-band px-4 py-3 font-mono text-[0.8125rem] text-ink [border-radius:var(--radius-sheet)]">
                <code>sudo bash deploy.sh</code>
              </pre>
            </div>

            <dl className="self-start">
              {HOSPEDAGEM.map(([term, body]) => (
                <div
                  key={term}
                  className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-5 border-b border-rule py-3 first:border-t first:pt-0 last:border-b-0 last:pb-0"
                >
                  <dt className="font-mono text-[0.8125rem] text-ink">{term}</dt>
                  <dd className="text-[0.8125rem] leading-[1.5] text-ink-2">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Sheet>
      </section>
    </div>
  );
}
