import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/sheet";

/**
 * Diálogo de acesso direto (admin / não assistido): quem tem a senha
 * configurada no PC controlado assume o controle sem esperar o clique em
 * "Permitir". A senha só é usada para assinar o desafio criptográfico — nunca
 * é enviada em texto puro pela rede.
 */
export function AdminAccessDialog({
  targetName,
  targetIdentity,
  initialPassword,
  busy,
  error,
  onClearError,
  onSubmit,
  onCancel,
}: {
  targetName: string;
  targetIdentity: string;
  initialPassword: string;
  busy: boolean;
  error: string | null;
  onClearError: () => void;
  onSubmit: (password: string, rememberInSession: boolean) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState(initialPassword);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(initialPassword.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const name = targetName.slice(0, 64);
  const suffix = targetIdentity.slice(-8);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    onSubmit(password, remember);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-scrim p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-admin-access-title"
        className="w-full max-w-[28rem] border border-rule-2 bg-sheet shadow-overlay [border-radius:var(--radius-sheet)]"
      >
        <div className="flex items-start gap-3 border-b border-rule px-6 py-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-rule-2 bg-band text-ink [border-radius:var(--radius-cell)]">
            <KeyRound size={15} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="rc-admin-access-title" className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink">
              Acesso direto à tela de {name}
            </h2>
            <p className="mt-0.5 font-mono text-[0.75rem] text-ink-3">
              {name} · {suffix}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-[0.8125rem] leading-[1.5] text-ink-2">
            Informe a senha de acesso direto configurada no computador de <strong className="text-ink">{name}</strong> para
            assumir o controle sem pedir confirmação.
          </p>

          <div>
            <label htmlFor="rc-direct-password" className="label-col block">
              Senha de acesso
            </label>
            <div className="relative mt-2">
              <input
                ref={inputRef}
                id="rc-direct-password"
                type={show ? "text" : "password"}
                value={password}
                disabled={busy}
                autoComplete="off"
                placeholder="Digite a senha configurada no PC remoto"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) onClearError();
                }}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShow((v) => !v)}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center text-ink-3 transition-colors hover:text-ink [border-radius:var(--radius-cell)]"
              >
                {show ? <EyeOff size={15} strokeWidth={1.75} aria-hidden /> : <Eye size={15} strokeWidth={1.75} aria-hidden />}
              </button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-[0.8125rem] leading-[1.45] text-alert">
                {error}
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-2 select-none">
            <input
              type="checkbox"
              checked={remember}
              disabled={busy}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 accent-signal"
            />
            <span>Lembrar nesta sala (apenas em memória, apaga ao sair)</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-rule px-6 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="border border-rule-2 bg-sheet px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band [border-radius:var(--radius-cell)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!password || busy}
            className="border border-signal bg-signal px-4 py-2 text-[0.8125rem] font-semibold text-on-signal transition-colors hover:bg-signal-2 disabled:opacity-45 [border-radius:var(--radius-cell)]"
          >
            {busy ? "Verificando…" : "Assumir controle"}
          </button>
        </div>
      </form>
    </div>
  );
}
