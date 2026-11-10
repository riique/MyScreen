import { cn } from "@/lib/utils";

/**
 * A marca: o selo do canal (brand/mark.svg) desenhado inline para seguir o
 * tema — o quadrado é a tinta da vez, a tela é a superfície, e o ponto é o
 * vermelho de "no ar". `live` faz o ponto respirar enquanto você transmite.
 */
export function LogoMark({ className, live = false }: { className?: string; live?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="64" height="64" rx="16" fill="var(--color-ink)" />
      <rect x="16.5" y="21.5" width="31" height="21" rx="3.5" fill="none" stroke="var(--color-sheet)" strokeWidth="5" />
      <circle cx="47" cy="19" r="9.5" fill="var(--color-ink)" />
      <circle
        cx="47"
        cy="19"
        r="7"
        fill="var(--color-live)"
        style={live ? { animation: "live-breathe 1.8s ease-in-out infinite" } : undefined}
      />
    </svg>
  );
}

export function Logo({ className, live = false }: { className?: string; live?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark live={live} />
      <span className="text-[0.9375rem] font-semibold tracking-[-0.025em] text-ink">MyScreen</span>
    </span>
  );
}
