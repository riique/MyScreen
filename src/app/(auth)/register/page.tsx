"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ArrowRight, Lock, Mail, User, AlertCircle } from "lucide-react";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** Campo culpado, vindo do `field` da resposta. Sem isto, um erro de
   *  e-mail pintava a senha de vermelho e vice-versa. */
  const [errorField, setErrorField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorField(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar.");
        setErrorField(typeof data.field === "string" ? data.field : null);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro de conexão ao servidor.");
      setErrorField(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-[#11131c] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Criar Nova Conta</h1>
          <p className="mt-1 text-sm text-gray-400">
            Cadastre-se para criar salas protegidas por senha
          </p>
        </div>

        {error && (
          <div
            id="register-error"
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs text-red-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="register-name"
              className="mb-1.5 block text-xs font-medium text-gray-300"
            >
              Seu Nome
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="register-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Henrique Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errorField === "name" ? true : undefined}
                aria-describedby={error ? "register-error" : undefined}
                className={`w-full rounded-xl border border-border bg-[#181b26] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none ${FOCUS_RING} ${
                  errorField === "name" ? "border-red-500/70" : ""
                }`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-xs font-medium text-gray-300"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="register-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errorField === "email" ? true : undefined}
                aria-describedby={error ? "register-error" : undefined}
                className={`w-full rounded-xl border border-border bg-[#181b26] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none ${FOCUS_RING} ${
                  errorField === "email" ? "border-red-500/70" : ""
                }`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-xs font-medium text-gray-300"
            >
              Senha (mínimo 10 caracteres)
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="register-password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={10}
                maxLength={72}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errorField === "password" ? true : undefined}
                aria-describedby={error ? "register-error" : undefined}
                className={`w-full rounded-xl border border-border bg-[#181b26] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none ${FOCUS_RING} ${
                  errorField === "password" ? "border-red-500/70" : ""
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
          >
            <span>{loading ? "Cadastrando..." : "Concluir Cadastro"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Já possui cadastro?{" "}
          <Link
            href="/login"
            className={`rounded font-medium text-indigo-400 hover:underline ${FOCUS_RING}`}
          >
            Entrar na sua conta
          </Link>
        </p>
      </div>
    </div>
  );
}
