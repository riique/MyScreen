"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

/**
 * Erro global: roda fora do provider de erro raiz, então não pode depender de
 * nenhum módulo do app (contextos, hooks compartilhados, estilos do layout).
 * Só o React, o next/link e o lucide-react.
 *
 * `Link` funciona aqui: o App Router ainda monta esta árvore dentro do contexto
 * de navegação. O que NÃO funciona é `useRouter`, porque ele depende do
 * contexto de error boundary que acabou de quebrar.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [devMessage, setDevMessage] = useState<string | null>(null);

  // Em produção o Next.js sanitiza a mensagem do erro; só mostramos em dev.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    try {
      setDevMessage(error.message);
    } catch {
      setDevMessage(null);
    }
  }, [error]);

  return (
    <html lang="pt-BR" className="dark">
      <body
        className="flex min-h-dvh items-center justify-center bg-[#090a0f] p-4 text-gray-100 antialiased"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-[#0f111a] p-6 text-center shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">A aplicação encontrou um erro</h1>
            <p className="mt-1 text-sm text-gray-400">
              Algo quebrou fora do fluxo normal da sala. Você pode tentar novamente ou voltar ao
              início.
            </p>
          </div>

          {devMessage && (
            <p className="w-full break-words rounded-lg bg-black/40 p-3 text-left font-mono text-[11px] text-red-300">
              {devMessage}
            </p>
          )}

          <div className="flex w-full gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#181b26] px-4 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-[#222636]"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Voltar ao início
            </Link>
          </div>

          {error.digest && (
            <p className="font-mono text-[11px] text-gray-500">
              Código: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
