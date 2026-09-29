"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [devMessage, setDevMessage] = useState<string | null>(null);

  // Em produção o Next.js sanitiza a mensagem do erro; só mostramos em dev.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    try {
      setDevMessage(error?.message || null);
    } catch {
      setDevMessage(null);
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-red-500/30 bg-[#0f111a] p-8 text-center shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-gray-100">
            Algo deu errado por aqui
          </h1>
          <p className="text-sm leading-relaxed text-gray-400">
            Não conseguimos continuar esta tela. Tente novamente — se o problema
            persistir, volte ao início e entre na sala outra vez.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 bg-[#181b26] px-4 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-secondary"
          >
            <Home className="h-4 w-4" />
            Voltar ao início
          </button>
        </div>

        {error.digest ? (
          <p className="w-full break-all rounded-lg border border-border/60 bg-[#0b0d14] px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-500">
            Código do erro: {error.digest}
          </p>
        ) : null}

        {devMessage ? (
          <pre className="w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-red-500/20 bg-red-950/40 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-red-300">
            {devMessage}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
