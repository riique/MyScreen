"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

/**
 * A cabeca da folha. Marca a esquerda, um fio, controles de sessao a direita.
 *
 * Sem carimbo "PRO": o produto e distribuido sob MIT e nao tem plano, tier nem
 * oferta, e um badge que promete um plano que nao existe e um claim inventado
 * — a interface nao pode carregar um.
 *
 * Enquanto a sessao carrega, o slot reserva a largura final em vez de sumir:
 * uma barra que encolhe depois da hidratacao obriga o olho a refazer a
 * leitura da pagina.
 */
export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user?: UserProfile | null }) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `pathname` e a chave: o layout raiz continua montado na navegacao do
    // cliente, e um fetch so no mount deixaria a barra desatualizada apos login.
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  const onDashboard = Boolean(pathname?.startsWith("/dashboard"));

  const linkBase =
    "border px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors [border-radius:var(--radius-cell)]";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-rule bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="-ml-1 flex min-w-0 items-center px-1 py-1 text-ink transition-opacity hover:opacity-70"
        >
          <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
            My<span className="text-signal">Screen</span>
          </span>
        </Link>

        <div className="flex h-full shrink-0 items-center gap-1 sm:gap-2">
          {loading ? (
            <div aria-hidden className="h-[1.75rem] w-[9.5rem]" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                aria-label="Painel"
                aria-current={onDashboard ? "page" : undefined}
                className={cn(
                  linkBase,
                  onDashboard
                    ? "border-signal-line bg-signal-wash text-signal"
                    : "border-transparent text-ink-2 hover:border-rule hover:bg-band hover:text-ink",
                )}
              >
                Painel
              </Link>
              <span
                className="hidden max-w-[10rem] truncate text-[0.8125rem] text-ink-2 md:inline"
                title={user.email}
              >
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair da conta"
                className={cn(
                  linkBase,
                  "border-transparent text-ink-2 hover:border-rule hover:bg-band hover:text-ink",
                )}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  linkBase,
                  "border-transparent text-ink-2 hover:border-rule hover:bg-band hover:text-ink",
                )}
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className={cn(
                  linkBase,
                  "border-rule-2 bg-sheet font-semibold text-ink hover:border-rule-3 hover:bg-band",
                )}
              >
                Cadastrar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
