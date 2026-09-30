"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/site/AuthShell";
import { Button, Field, inputClass } from "@/components/sheet";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setErrorField(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao entrar.");
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
  }

  return (
    <AuthShell
      title="Entrar no MyScreen"
      subtitle="Acesse seu painel e gerencie suas salas permanentes"
      footer={
        <>
          Não tem uma conta?{" "}
          <Link href="/register" className="font-semibold text-signal hover:underline">
            Cadastre-se gratuitamente
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <p
            id="login-error"
            role="alert"
            className="border border-alert-line bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert"
          >
            {error}
          </p>
        ) : null}

        <Field label="E-mail" htmlFor="email" error={errorField === "email" ? error ?? undefined : undefined}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
            aria-invalid={errorField === "email"}
            className={inputClass}
          />
        </Field>

        <Field label="Senha" htmlFor="password" error={errorField === "password" ? error ?? undefined : undefined}>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={errorField === "password"}
            className={inputClass}
          />
        </Field>

        <Button type="submit" tone="primary" disabled={loading} className="w-full py-2.5">
          {loading ? "Entrando..." : "Acessar conta"}
        </Button>
      </form>
    </AuthShell>
  );
}
