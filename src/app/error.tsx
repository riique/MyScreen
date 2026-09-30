"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sheet, SheetTitle } from "@/components/sheet";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Erro não tratado na tela:", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[34rem] px-4 py-20 sm:px-6">
      <Sheet className="p-7">
        <SheetTitle className="text-[1.375rem]">Algo deu errado por aqui</SheetTitle>
        <p className="mt-2 max-w-[52ch] text-[0.875rem] leading-[1.6] text-ink-2">
          Não conseguimos continuar esta tela. Tente novamente — se o problema persistir,
          volte ao início e entre na sala outra vez.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="border border-signal bg-signal px-4 py-2 text-[0.8125rem] font-semibold text-on-signal transition-colors hover:bg-signal-2 [border-radius:var(--radius-sheet)]"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="border border-rule-2 bg-sheet px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-band [border-radius:var(--radius-sheet)]"
          >
            Voltar ao início
          </button>
        </div>

        {error.digest ? (
          <p className="mt-5 border-t border-rule pt-4 font-mono text-[0.75rem] text-ink-3">
            Código do erro: {error.digest}
          </p>
        ) : null}

        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-3 font-mono text-[0.75rem] text-ink-3">{error.message}</p>
        ) : null}
      </Sheet>
    </div>
  );
}
