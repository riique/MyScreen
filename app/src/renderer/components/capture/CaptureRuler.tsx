
import { useEffect, useState } from "react";
import { Choice } from "@/components/sheet";
import { probeEncoders } from "@/lib/codecProbe";
import { chooseScreenCodec, type CodecChoice } from "@shared/codec";
import { RESOLUTION } from "@shared/media";
import type { CaptureSettings } from "./capturePrefs";

/**
 * A régua de captura: duas colunas (resolução e taxa), cada uma com o
 * título e as opções logo abaixo. A opção marcada JÁ é o valor — uma linha de
 * valores por cima repetiria a mesma informação duas vezes.
 */

const RESOLUTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "1440p", label: "1440p" },
] as const;

const FRAME_RATES = [
  { value: "30", label: "30" },
  { value: "60", label: "60" },
] as const;

/** A escolha de codec que valeria para estas configurações nesta máquina. */
export function useCodecChoice(settings: CaptureSettings): CodecChoice | null {
  const [choice, setChoice] = useState<CodecChoice | null>(null);
  const { width, height } = RESOLUTION[settings.resolution];
  const fps = Number(settings.frameRate);
  useEffect(() => {
    let alive = true;
    void probeEncoders(width, height, fps).then((probe) => {
      if (alive) setChoice(chooseScreenCodec("auto", probe));
    });
    return () => {
      alive = false;
    };
  }, [width, height, fps]);
  return choice;
}

/**
 * O que a combinação faz com o encoder, em uma frase. O conteúdo é sempre
 * vídeo e jogos: quando a rede aperta, cai a nitidez e o movimento segue fluido.
 */
function consequence(s: CaptureSettings): string {
  const content = "Se a rede apertar, cai a nitidez e o movimento continua fluido.";
  if (s.resolution === "1440p") return `1440p é a opção mais pesada para a sua internet. ${content}`;
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
  const codec = useCodecChoice(settings);
  return (
    <>
      <div className="grid grid-cols-[3fr_2fr] border-b border-rule">
        <Column title="Resolução" cols="grid-cols-3" className="border-r border-rule">
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

        <Column title="Taxa (FPS)" cols="grid-cols-2">
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
      </div>


      {showConsequence ? (
        <p
          className="px-5 py-3 text-[0.8125rem] leading-[1.5] text-ink-3 [text-wrap:pretty] sm:px-6"
          aria-live="polite"
        >
          {consequence(settings)}
          {codec ? <span className="mt-1 block text-ink-2">{codec.reason}</span> : null}
        </p>
      ) : null}
    </>
  );
}

/** A consequência em texto, para quem quiser mostrá-la fora da régua. */
export { consequence as captureConsequence };
