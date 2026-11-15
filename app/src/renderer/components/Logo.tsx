import { cn } from "@/lib/utils";

/**
 * A marca: a tela no ar (brand/mark.svg) desenhada inline para seguir o tema:
 * o quadrado é a tinta da vez, a tela é a superfície, as ondas voltam à tinta
 * e o ponto é o vermelho de "no ar". `live` faz o ponto respirar enquanto
 * você transmite.
 */
const ARCS = [
  { d: "M604.2 405.0A124 124 0 0 1 604.2 571.0", o: 1 },
  { d: "M419.8 405.0A124 124 0 0 0 419.8 571.0", o: 1 },
  { d: "M663.6 351.5A204 204 0 0 1 663.6 624.5", o: 0.42 },
  { d: "M360.4 351.5A204 204 0 0 0 360.4 624.5", o: 0.42 },
];

export function LogoMark({ className, live = false }: { className?: string; live?: boolean }) {
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="1024" height="1024" rx="230" fill="var(--color-ink)" />
      <rect x="417" y="768" width="190" height="30" rx="15" fill="var(--color-sheet)" opacity="0.24" />
      <rect x="162" y="262" width="700" height="452" rx="92" fill="var(--color-sheet)" />
      {ARCS.map((a) => (
        <path
          key={a.d}
          d={a.d}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity={a.o}
          strokeWidth="36"
          strokeLinecap="round"
        />
      ))}
      <circle
        cx="512"
        cy="488"
        r="58"
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
