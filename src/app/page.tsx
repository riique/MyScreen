"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QualityBand } from "@/components/site/QualityBand";
import { Sheet, SheetHead, SheetProse, SheetTitle, inputClass } from "@/components/sheet";

/**
 * A home e uma folha, nao uma vitrine: o titulo faz a promessa, a banda logo
 * abaixo e a superficie de controle real, e o resto explica o mecanismo.
 *
 * Medidas de titulo em `rem`, nunca em `ch`: `ch` resolve contra o tamanho de
 * fonte do pai (16px) e nao contra o do `h1` (34px), o que dava uma coluna de
 * 405px e tres linhas quebradas no lugar de duas.
 */

const CAPACIDADES = [
  {
    term: "Tela e câmera concomitantes",
    body: "Transmita sua tela inteira, janela ou aba do navegador ao mesmo tempo em que sua webcam permanece ativa em Picture-in-Picture ou grade.",
  },
  {
    term: "Áudio estéreo do sistema",
    body: "Compartilhe o som de vídeos, jogos e aplicações com mixagem em tempo real e filtros de cancelamento de eco e supressão de ruído, aplicados na track viva.",
  },
  {
    term: "Gravação local com 1 clique",
    body: "Grave a apresentação e o áudio diretamente no seu próprio navegador via MediaRecorder, sem sobrecarregar a CPU do seu servidor VPS.",
  },
  {
    term: "Diagnóstico honesto",
    body: "O painel de estatísticas mostra quadros descartados, PLI, NACK, FIR e o decoder. O que não foi medido aparece como n/d — o app não inventa número de latência.",
  },
];

const HOSPEDAGEM = [
  ["Caddy", "TLS automático, HTTP/2 e HTTP/3, WSS"],
  ["LiveKit SFU", "Go, com TURN embutido — sem container coturn"],
  ["Next.js 15", "App Router, React 19, TypeScript strict"],
  ["SQLite + Prisma", "Volume persistente em /app/data"],
  ["Licença", "MIT"],
];

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");

  async function handleStart() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reunião Instantânea" }),
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
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 sm:px-6">
      {/* Primeira dobra: a tese e a prova. */}
      <section className="pt-14 sm:pt-20">
        <SheetTitle className="max-w-[34rem]">
          Sua tela, o áudio do sistema e a sua câmera, na mesma faixa.
        </SheetTitle>

        <div className="mt-6 max-w-[62ch] space-y-3">
          <SheetProse>
            Compartilhe a tela inteira, uma janela ou só a aba, em 60 FPS, com o som do
            sistema viajando junto do microfone. Roda no seu próprio servidor Ubuntu, com
            LiveKit SFU e TURN embutido.
          </SheetProse>
          <p className="text-[0.875rem] leading-[1.6] text-ink-3">
            Ajuste os quatro parâmetros abaixo. É a mesma régua que você opera no lobby —
            e a escolha muda o que o encoder faz.
          </p>
        </div>

        <div className="mt-9">
          <QualityBand onStart={handleStart} />
        </div>

        {createError ? (
          <p
            role="alert"
            className="mt-4 border border-alert-line bg-alert-wash px-4 py-3 text-[0.875rem] text-alert"
          >
            {createError}
          </p>
        ) : null}

        {creating ? (
          <p className="mt-4 font-mono text-[0.8125rem] text-ink-3">Criando sala...</p>
        ) : null}
      </section>

      {/* Entrar: a segunda tarefa real, e a mais usada de todas. */}
      <section className="mt-16 grid gap-6 sm:mt-20 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start">
        <Sheet className="p-6 sm:p-7">
          <SheetHead title="Entrar em uma sala" id="ENTRAR" />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const raw = roomCode.trim();
              if (!raw) return;
              const code = raw.includes("/room/")
                ? raw.split("/room/")[1].split("?")[0]
                : raw;
              router.push(`/room/${code}`);
            }}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="room-code"
                className="block border-b border-rule pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-3"
              >
                Código ou link da reunião
              </label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Código ou link (ex: abc-def-ghi)"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} mt-2 font-mono`}
              />
            </div>
            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 disabled:pointer-events-none disabled:opacity-40 [border-radius:var(--radius-sheet)]"
            >
              Entrar
            </button>
          </form>
        </Sheet>

        <Sheet className="flex flex-col justify-between gap-4 p-6">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
              Meu painel
            </h2>
            <p className="mt-1.5 text-[0.8125rem] leading-[1.5] text-ink-3">
              Acompanhe suas salas, compartilhe links e retome reuniões em um só lugar.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center border border-rule-2 bg-sheet px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band [border-radius:var(--radius-sheet)]"
          >
            Abrir painel
          </Link>
        </Sheet>
      </section>

      {/* Capacidades como lista de termos, a forma nativa da folha. */}
      <section className="mt-16 sm:mt-20">
        <SheetTitle as="h2" className="max-w-[30rem] text-[1.5rem] sm:text-[1.75rem]">
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
              className="grid gap-x-8 gap-y-1.5 border-b border-rule py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
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
      <section className="mt-16 sm:mt-20">
        <Sheet>
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:gap-12">
            <div>
              <SheetTitle as="h2" className="max-w-[20rem] text-[1.375rem] sm:text-[1.5rem]">
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
