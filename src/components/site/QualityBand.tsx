"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { CaptureRuler, captureConsequence } from "./CaptureRuler";
import {
  DEFAULT_CAPTURE,
  writeCapture,
  type CaptureSettings,
} from "./capturePrefs";

export type { CaptureSettings } from "./capturePrefs";

/**
 * A banda da home: a mesma régua do lobby, com a ação primária na margem.
 *
 * O padrao da categoria mostra um print do produto e promete fidelidade. Aqui a
 * promessa e operavel: as celulas mudam de verdade, e cada escolha diz em uma
 * linha o que ela faz com o encoder. Isto e a evidencia do mecanismo — nao um
 * mockup dele.
 *
 * A banda tambem e quem guarda a escolha: sem isso ela seria demonstracao, e a
 * frase "e a mesma regua que voce opera no lobby" seria mentira.
 */
export function QualityBand({ onStart }: { onStart: () => void }) {
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_CAPTURE);

  return (
    <Sheet className="overflow-hidden">
      <CaptureRuler
        settings={settings}
        onChange={(next) => setSettings((prev: CaptureSettings) => ({ ...prev, ...next }))}
        showConsequence={false}
      />

      {/* A consequência ao lado da ação. Ela vive FORA da régua aqui porque a
          linha cede o espaço à margem primária; no lobby, onde não há CTA, ela
          entra na própria régua. A regra do texto é a mesma nos dois. */}
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0" aria-live="polite">
          <p className="max-w-[62ch] text-[0.875rem] leading-[1.5] text-ink-2 [text-wrap:pretty]">
            {captureConsequence(settings)}
          </p>
          <p className="mt-1 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-ink-3 [text-wrap:pretty]">
            {settings.systemAudio
              ? "O som do sistema viaja na mesma faixa, em estéreo, misturado com o microfone."
              : "Sem captura de áudio do sistema. O que sai da faixa é só a sua voz."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            writeCapture(settings);
            onStart();
          }}
          className="shrink-0 border border-signal bg-signal px-5 py-2.5 text-[0.875rem] font-semibold text-on-signal transition-colors hover:border-signal-2 hover:bg-signal-2 [border-radius:var(--radius-sheet)]"
        >
          Iniciar agora
        </button>
      </div>
    </Sheet>
  );
}
