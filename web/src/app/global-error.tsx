"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Este arquivo SUBSTITUI o layout raiz, `<html>` e `<body>` inclusive. Por isso
 * ele nao importa `globals.css`, os primitivos da folha nem o Navbar: o proprio
 * reset de CSS pode ser o que quebrou. Os valores sao literais porque as
 * variaveis de tema moram justamente no CSS que nao carregou.
 *
 * `Link` em vez de `useRouter`: o hook depende do contexto de navegacao que
 * acabou de quebrar.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro fatal na aplicação:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          backgroundColor: "#f2f2ef",
          color: "#16171a",
          fontFamily:
            'var(--font-archivo), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "34rem",
            border: "1px solid #d5d5ce",
            backgroundColor: "#ffffff",
            borderRadius: 3,
            padding: "1.75rem",
            boxShadow:
              "0 1px 2px rgba(22,23,26,.06), 0 6px 16px -10px rgba(22,23,26,.18)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.375rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            A aplicação encontrou um erro
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#4b4e55",
              maxWidth: "52ch",
            }}
          >
            Algo quebrou fora do fluxo normal da sala. Você pode tentar novamente ou voltar
            ao início.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginTop: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                border: "1px solid #1b3a7d",
                backgroundColor: "#1b3a7d",
                color: "#ffffff",
                borderRadius: 3,
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
            <Link
              href="/"
              style={{
                border: "1px solid #b9b9b0",
                backgroundColor: "#ffffff",
                color: "#16171a",
                borderRadius: 3,
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Voltar ao início
            </Link>
          </div>

          {error.digest ? (
            <p
              style={{
                marginTop: "1.25rem",
                paddingTop: "1rem",
                borderTop: "1px solid #d5d5ce",
                fontFamily: "var(--font-spline-mono), ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#9a9ea6",
              }}
            >
              Código: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
