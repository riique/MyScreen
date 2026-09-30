import type { ReactNode } from "react";
import { Sheet, SheetTitle } from "@/components/sheet";

/**
 * Login e cadastro são a mesma folha com campos diferentes: um cabecalho, os
 * campos pautados, a ação primaria na margem, e a ponte para a outra folha na
 * base. Um shell só, para as duas não divergirem no respiro.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[30rem] px-4 py-16 sm:px-6 sm:py-24">
      <Sheet className="p-6 sm:p-8">
        <SheetTitle className="text-[1.5rem] sm:text-[1.75rem]">{title}</SheetTitle>
        <p className="mt-2 text-[0.875rem] leading-[1.5] text-ink-2">{subtitle}</p>

        <div className="mt-7">{children}</div>
      </Sheet>

      <p className="mt-5 px-1 text-[0.875rem] text-ink-2">{footer}</p>
    </div>
  );
}
