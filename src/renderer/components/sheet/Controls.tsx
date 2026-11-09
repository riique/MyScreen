import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Choice } from "./Cell";

/* ---------------------------------------------------------------------------
   Ações

   Um botão é tinta sobre a superfície: o primário é a tinta cheia (quase preto
   no claro, quase branco no escuro), o secundário é a superfície com anel de
   1px, o discreto não tem fundo até o hover. "live" é só para começar/parar
   uma transmissão; "danger", para sair e apagar.
   ------------------------------------------------------------------------ */

export type ButtonTone = "primary" | "secondary" | "quiet" | "danger" | "live";
export type ButtonSize = "sm" | "md" | "lg";

const TONE: Record<ButtonTone, string> = {
  primary: "bg-signal text-on-signal hover:bg-signal-2 active:bg-signal-2",
  secondary:
    "bg-sheet text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)] hover:bg-band hover:shadow-[inset_0_0_0_1px_var(--color-rule-3)] active:bg-band-2",
  quiet: "bg-transparent text-ink-2 hover:bg-band-2 hover:text-ink",
  danger:
    "bg-sheet text-alert shadow-[inset_0_0_0_1px_var(--color-alert-line)] hover:bg-alert-wash active:bg-alert-wash-2",
  live: "bg-live text-on-live hover:bg-live-2 active:bg-live-2",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem]",
  md: "h-10 gap-2 px-4 text-[0.875rem]",
  lg: "h-12 gap-2 px-5 text-[0.9375rem]",
};

const BASE =
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.01em] transition-[background-color,box-shadow,color,transform] duration-150 ease-out active:translate-y-px [border-radius:var(--radius-cell)] disabled:pointer-events-none disabled:opacity-45";

/** As classes do botão, para links e rótulos que precisam parecer um. */
export function buttonClass(tone: ButtonTone = "secondary", size: ButtonSize = "md", className?: string): string {
  return cn(BASE, SIZE[size], TONE[tone], className);
}

export function Button({
  children,
  className,
  tone = "secondary",
  size = "md",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
} & Omit<React.ComponentProps<"button">, "className">) {
  return (
    <button type={type} className={buttonClass(tone, size, className)} {...rest}>
      {children}
    </button>
  );
}

/** Botão só de ícone: alvo quadrado, rótulo obrigatório para leitor de tela. */
export function IconButton({
  label,
  children,
  className,
  active = false,
  size = "md",
  ...rest
}: {
  label: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  size?: "sm" | "md";
} & Omit<React.ComponentProps<"button">, "className" | "aria-label" | "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-ink-2 transition-colors duration-150 hover:bg-band-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45 [border-radius:var(--radius-cell)]",
        size === "sm" ? "size-8" : "size-9",
        active && "bg-signal-wash text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Campos

   O rótulo é cabeçalho de coluna, com fio abaixo, igual à célula de dado. Erro
   nomeia o problema e a recuperação — nunca "algo deu errado".
   ------------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={htmlFor}
        className="label-col block"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-[0.8125rem] leading-[1.5] text-alert" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[0.8125rem] leading-[1.5] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full border border-rule-2 bg-sheet px-3.5 py-2.5 text-[0.875rem] text-ink transition-colors placeholder:text-ink-3 hover:border-rule-3 focus:border-ink-3 focus:shadow-[0_0_0_4px_var(--color-signal-wash)] focus:outline-none focus-visible:outline-none [border-radius:var(--radius-cell)]";

/**
 * Select nativo (teclado, leitor de tela e lista do sistema continuam de
 * graça) com a seta desenhada pelo tema em vez da do Windows.
 */
export function Select({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & Omit<React.ComponentProps<"select">, "className">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(inputClass, "cursor-pointer appearance-none truncate pr-10")} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Linhas de escolha

   `Choice` sozinho é a célula marcada. `ChoiceRow` é a régua: as células em
   fila, separadas por fio, dentro de uma folha. É a forma que o seletor de
   resolução e FPS assume no produto inteiro.
   ------------------------------------------------------------------------ */

export function ChoiceRow({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string; disabled?: boolean }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid border-y border-rule bg-sheet [border-radius:var(--radius-sheet)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <Choice
          key={option.value}
          name={name}
          value={option.value}
          checked={option.value === value}
          onChange={onChange}
          label={option.label}
          hint={option.hint}
          disabled={option.disabled}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Caixa marcada

   Booleano numa folha é quadrado marcado à mão, não um switch. A caixa é a
   parte impressa; o estado mora no quadrado e no texto, nunca só na cor.
   ------------------------------------------------------------------------ */

export function CheckCell({
  name,
  checked,
  onChange,
  label,
  note,
  disabled = false,
  className,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  note?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 border-b border-rule px-5 py-3.5 transition-colors last:border-b-0 hover:bg-band has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-3px] has-[:focus-visible]:outline-signal",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-[3px] flex size-[16px] shrink-0 items-center justify-center border transition-colors [border-radius:5px]",
          checked ? "border-signal bg-signal" : "border-rule-2 bg-sheet",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="size-[11px]" fill="none" aria-hidden>
            <path
              d="M2.5 6.2 4.7 8.4 9.5 3.6"
              stroke="var(--color-on-signal)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[0.875rem] font-medium leading-[1.4]",
            checked ? "text-ink" : "text-ink-2",
          )}
        >
          {label}
        </span>
        {note ? (
          <span className="mt-0.5 block max-w-[58ch] text-[0.8125rem] leading-[1.5] text-ink-3">
            {note}
          </span>
        ) : null}
      </span>
    </label>
  );
}
