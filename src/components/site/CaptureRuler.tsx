"use client";

import { Cell, Choice } from "@/components/sheet";
import type { CaptureSettings } from "./capturePrefs";

/**
 * A régua de captura: quatro colunas, quatro ajustes que o produto de fato
 * expõe, e a consequência de cada escolha logo abaixo.
 *
 * É UM componente só, usado pela home e pelo lobby. A promessa da home é "é a
 * mesma régua que você opera no lobby" — duas implementações parallelas
 * transformariam essa frase em mentira no primeiro ajuste, e a emenda (o valor
 * anterior riscado em grafite) deixaria de ser a assinatura em uma das
 * superfícies.
 *
 * As DUAS linhas usam a mesma grade em todo breakpoint. A linha de valores é
 * `grid-cols-2` no celular e a de opções também: se divergirem, as colunas
 * deixam de coincidir e a folha vira exatamente a planilha solta que o contrato
 * diz para não virar.
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
  { value: "motion", label: "Vídeo" },
] as const;

const SYSTEM_AUDIO = [
  { value: "on", label: "Sistema" },
  { value: "off", label: "Só mic" },
] as const;

/**
 * O que cada ajuste realmente faz com o encoder, em linguagem de quem opera.
 * A ordem importa: tipo de conteudo domina taxa, que domina resolucao — e o que
 * a pessoa le primeiro e o que pesa mais na escolha.
 *
 * Nenhuma sentence aqui carrega um valor que a celula ao lado nao carrega. Um
 * "4K, em 60 FPS" fixo no texto brigaria com a celula da taxa mostrando 30.
 */
function consequence(s: CaptureSettings): string {
  if (s.contentHint === "motion")
    return "Vídeo e jogos: o encoder gasta o quadro a quadro em movimento. Texto pequeno perde nitidez.";
  if (s.frameRate === "15")
    return "15 FPS basta para código e slides em movimento lento. Vídeo e jogo pedem 60.";
  if (s.resolution === "4k")
    return `4K na faixa de tela, em ${s.frameRate} FPS. É a faixa mais pesada do seu uplink.`;
  if (s.resolution === "720p")
    return "720p na faixa de tela. Um link de 4G cai antes de travar a imagem.";
  return "1080p Full HD na faixa de tela. Texto de editor de código continua legível.";
}

function audioConsequence(on: boolean): string {
  return on
    ? "O som do sistema viaja na mesma faixa, em estéreo, misturado com o microfone."
    : "Sem captura de áudio do sistema. O que sai da faixa é só a sua voz.";
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
      <div className="grid grid-cols-2 border-b border-rule md:grid-cols-4">
        <Cell
          label="Resolução"
          value={settings.resolution === "4k" ? "4K" : settings.resolution}
          className="border-b border-rule md:border-b-0 md:border-r"
        />
        <Cell
          label="Taxa"
          value={`${settings.frameRate} FPS`}
          className="border-b border-rule md:border-b-0 md:border-r"
        />
        <Cell
          label="Conteúdo"
          value={settings.contentHint === "detail" ? "Telas e texto" : "Vídeo e jogos"}
          className="border-r"
        />
        <Cell
          label="Áudio"
          value={settings.systemAudio ? "Sistema + mic" : "Só microfone"}
          emphasis
        />
      </div>

      <div className="grid grid-cols-2 border-b border-rule md:grid-cols-4">
        <div className="border-b border-r border-rule md:border-b-0">
          <div className="grid grid-cols-3">
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
          </div>
        </div>

        <div className="border-b border-rule md:border-b-0 md:border-r">
          <div className="grid grid-cols-3">
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
          </div>
        </div>

        <div className="border-b border-r border-rule md:border-b-0">
          <div className="grid grid-cols-2">
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
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2">
            {SYSTEM_AUDIO.map((o) => (
              <Choice
                key={o.value}
                name="ruler-audio"
                value={o.value}
                checked={settings.systemAudio === (o.value === "on")}
                onChange={() => onChange({ systemAudio: o.value === "on" })}
                label={o.label}
              />
            ))}
          </div>
        </div>
      </div>

      {showConsequence ? (
        <div className="px-5 py-4 sm:px-6">
          <p
            className="max-w-[62ch] text-[0.875rem] leading-[1.5] text-ink-2 [text-wrap:pretty]"
            aria-live="polite"
          >
            {consequence(settings)}
          </p>
          <p className="mt-1 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-ink-3 [text-wrap:pretty]">
            {audioConsequence(settings.systemAudio)}
          </p>
        </div>
      ) : null}
    </>
  );
}

/** A consequência em texto, para quem quiser mostrá-la fora da régua. */
export { consequence as captureConsequence };
