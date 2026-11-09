import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

/**
 * A cabeça da janela: marca à esquerda, ações à direita, e a faixa inteira é
 * a área de arrastar. Os botões nativos do Windows ficam sobrepostos à direita
 * (`titlebar-pad` reserva o espaço deles).
 */
export function AppBar({
  children,
  className,
  live = false,
}: {
  children?: ReactNode;
  className?: string;
  /** Você está transmitindo: o ponto do selo respira. */
  live?: boolean;
}) {
  return (
    <header
      className={cn(
        "app-drag titlebar-pad flex h-12 shrink-0 items-center justify-between gap-4 border-b border-rule bg-sheet pl-4",
        className,
      )}
    >
      <Logo live={live} />
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </header>
  );
}
