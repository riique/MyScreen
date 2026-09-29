"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Tv, User as UserIcon, LogOut, LayoutDashboard, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function Navbar() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-[#090a0f]/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
            <Tv className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              My<span className="text-indigo-400">Screen</span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="hidden sm:flex items-center gap-2 rounded-lg bg-secondary/80 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-secondary border border-border/80 transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 text-indigo-400" />
                    <span>Painel</span>
                  </Link>

                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[#121520] px-3 py-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 font-semibold text-xs border border-indigo-500/30">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-gray-200">
                      {user.name}
                    </span>
                    <button
                      onClick={handleLogout}
                      title="Sair"
                      className="ml-1 text-gray-400 hover:text-red-400 transition-colors p-1"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/login"
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
                  >
                    <UserIcon className="h-4 w-4" />
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
