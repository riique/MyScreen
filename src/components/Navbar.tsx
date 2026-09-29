"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Tv, User as UserIcon, LogOut, LayoutDashboard } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090a0f]";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function Navbar() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const onDashboard = Boolean(pathname?.startsWith("/dashboard"));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-[#090a0f]/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        {/* min-w-0 + truncate: a marca cede espaco em vez de empurrar as acoes
            para fora da viewport em telas estreitas. */}
        <Link
          href="/"
          className={`group flex min-w-0 items-center gap-2.5 rounded-xl ${FOCUS_RING}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-transform duration-200 group-hover:scale-105">
            <Tv className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xl font-bold tracking-tight text-white">
              My<span className="text-indigo-400">Screen</span>
            </span>
            <span className="hidden shrink-0 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 sm:inline-block">
              PRO
            </span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/dashboard"
                    aria-label="Painel"
                    aria-current={onDashboard ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg border border-border/80 bg-secondary/80 px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:px-3.5 ${FOCUS_RING}`}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0 text-indigo-400" />
                    <span className="hidden sm:inline">Painel</span>
                  </Link>

                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[#121520] px-3 py-1.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-600/20 text-xs font-semibold text-indigo-300">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden text-sm font-medium text-gray-200 sm:inline">
                      {user.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleLogout}
                      aria-label="Sair da conta"
                      className={`ml-1 rounded-md p-1 text-gray-400 transition-colors hover:text-red-400 ${FOCUS_RING}`}
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <Link
                    href="/login"
                    className={`rounded-lg px-2.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white sm:px-3.5 ${FOCUS_RING}`}
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/register"
                    className={`flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-500 sm:px-4 ${FOCUS_RING}`}
                  >
                    <UserIcon className="h-4 w-4 shrink-0" />
                    <span>Cadastrar</span>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
