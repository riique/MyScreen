"use client";

import { Choice } from "@/components/sheet";
import type { CaptureSettings } from "./capturePrefs";

/**
 * A régua de captura: três colunas (resolução, taxa, conteúdo), cada uma com o
 * título e as opções logo abaixo. A opção marcada JÁ é o valor — uma linha de
 * valores por cima repetiria a mesma informação duas vezes.
 *
 * O áudio não mora aqui: é uma escolha de origem (navegador, app, nenhum), não
 * de qualidade, e fica no diálogo de compartilhar.
 */

const RESOLUTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4k", label: "4K" },
] as const;

const FRAME_RATES = [
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "60", label: "60" },
] as const;

const CONTENT_TYPES = [
  { value: "detail", label: "Texto" },
  { value: "motion", label: "Vídeo e jogos" },
] as const;

/**
 * O que a combinação faz com o encoder, em uma frase. O tipo de conteúdo pesa
 * mais: ele decide o que o encoder sacrifica quando a rede aperta.
 */
function consequence(s: CaptureSettings): string {
  const content =
    s.contentHint === "motion"
      ? "Se a rede apertar, cai a nitidez e o movimento continua fluido."
      : "Se a rede apertar, cai a fluidez e o texto continua nítido.";
  if (s.resolution === "4k") return `4K é a opção mais pesada para a sua internet. ${content}`;
  if (s.frameRate === "15") return `15 FPS basta para código e slides. ${content}`;
  return content;
}

function Column({
  title,
  className,
  cols,
  children,
}: {
  title: string;
  className?: string;
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="px-4 pt-3 pb-2">
        <span className="label-col">{title}</span>
      </div>
      <div className={`grid border-t border-rule ${cols}`}>{children}</div>
    </div>
  );
}

export function CaptureRuler({
  settings,
  onChange,
  showConsequence = true,
}: {
  settings: CaptureSettings;
  onChange: (next: Partial<CaptureSettings>) => void;
  showConsequence?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 border-b border-rule md:grid-cols-[1fr_1fr_1.3fr]">
        <Column title="Resolução" cols="grid-cols-3" className="border-r border-b border-rule md:border-b-0">
          {RESOLUTIONS.map((o) => (
            <Choice
              key={o.value}
              name="ruler-resolucao"
              value={o.value}
              checked={settings.resolution === o.value}
              onChange={() => onChange({ resolution: o.value })}
              label={o.label}
            />
          ))}
        </Column>

        <Column title="Taxa (FPS)" cols="grid-cols-3" className="border-b border-rule md:border-b-0 md:border-r">
          {FRAME_RATES.map((o) => (
            <Choice
              key={o.value}
              name="ruler-taxa"
              value={o.value}
              checked={settings.frameRate === o.value}
              onChange={() => onChange({ frameRate: o.value })}
              label={o.label}
            />
          ))}
        </Column>

        <Column title="Conteúdo" cols="grid-cols-2" className="col-span-2 md:col-span-1">
          {CONTENT_TYPES.map((o) => (
            <Choice
              key={o.value}
              name="ruler-conteudo"
              value={o.value}
              checked={settings.contentHint === o.value}
              onChange={() => onChange({ contentHint: o.value })}
              label={o.label}
            />
          ))}
        </Column>
      </div>

      {showConsequence ? (
        <p
          className="px-5 py-3 text-[0.8125rem] leading-[1.5] text-ink-3 [text-wrap:pretty] sm:px-6"
          aria-live="polite"
        >
          {consequence(settings)}
        </p>
      ) : null}
    </>
  );
}

/** A consequência em texto, para quem quiser mostrá-la fora da régua. */
export { consequence as captureConsequence };
