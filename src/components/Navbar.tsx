import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * A cabeça da folha: marca à esquerda, tema à direita. O MyScreen não tem
 * contas — quem tem o link da sala entra —, então não há sessão para mostrar.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-rule bg-paper/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="-ml-1 flex min-w-0 items-center px-1 py-1 text-ink transition-opacity hover:opacity-70"
        >
          <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
            My<span className="text-signal">Screen</span>
          </span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
