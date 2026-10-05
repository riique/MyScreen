"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(next: Theme) {
  const root = document.documentElement;
  // A transição só existe durante a troca manual; na carga o tema é instantâneo.
  root.classList.add("theme-switching");
  if (next === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  window.setTimeout(() => root.classList.remove("theme-switching"), 260);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Armazenamento bloqueado: o tema vale só para esta aba.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
    // Pode haver mais de um botão montado (barra do site e barra da chamada):
    // todos seguem o atributo, não o próprio clique.
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = isDark ? "light" : "dark";
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={label}
      title={label}
      className="relative inline-flex size-8 shrink-0 items-center justify-center border border-transparent text-ink-2 transition-colors hover:border-rule hover:bg-band hover:text-ink [border-radius:var(--radius-cell)]"
    >
      {/* Antes de hidratar, o slot reserva o tamanho e não chuta um ícone. */}
      {theme === null ? null : isDark ? (
        <Sun aria-hidden className="size-[1.0625rem]" strokeWidth={1.75} />
      ) : (
        <Moon aria-hidden className="size-[1.0625rem]" strokeWidth={1.75} />
      )}
    </button>
  );
}
