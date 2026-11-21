import { Check, LoaderCircle, Music, Pencil, Play, RotateCw, Square, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SoundInfo } from "@shared/ipc";
import { cn } from "@/lib/utils";
import type { SoundboardState } from "./useSoundboard";

/** Um áudio em edição: nome novo, ou a senha para apagar. */
type Editing = { id: string; mode: "rename" | "delete"; value: string; busy: boolean; error: string | null };

/**
 * O botão de áudios da doca (ligado em Configurações): abre a lista do
 * servidor; um clique toca para a sala inteira, outro clique no mesmo para.
 */
export function SoundboardControl({ board }: { board: SoundboardState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { sounds, listError, playingId, loadingId, error, refresh, play, stop, uploading, upload, rename, remove } = board;
  const [editing, setEditing] = useState<Editing | null>(null);

  // Fechou o painel ou o áudio sumiu da lista: a edição acaba junto.
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);
  useEffect(() => {
    if (editing && sounds && !sounds.some((s) => s.id === editing.id)) setEditing(null);
  }, [sounds, editing]);

  const startEdit = (sound: SoundInfo, mode: Editing["mode"]) =>
    setEditing({ id: sound.id, mode, value: mode === "rename" ? sound.name : "", busy: false, error: null });

  const submitEdit = (e: FormEvent, sound: SoundInfo) => {
    e.preventDefault();
    if (!editing || editing.busy) return;
    const { mode, value } = editing;
    setEditing({ ...editing, busy: true, error: null });
    void (mode === "rename" ? rename(sound, value) : remove(sound, value)).then((err) => {
      setEditing((cur) => {
        if (!cur || cur.id !== sound.id) return cur;
        // Senha errada apaga o campo: a próxima tentativa começa do zero.
        return err ? { ...cur, busy: false, error: err, value: mode === "delete" ? "" : cur.value } : null;
      });
    });
  };

  // A lista vem de novo a cada abertura: arquivo novo no servidor aparece sem sair da sala.
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const busy = playingId !== null || loadingId !== null;
  const label = playingId ? "Áudio tocando para a sala" : "Áudios";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${label}: escolher`}
        title={label}
        className={cn(
          "flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3.5 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] sm:px-4",
          busy
            ? "border-signal bg-signal text-on-signal hover:border-signal-2 hover:bg-signal-2"
            : "border-rule-2 bg-sheet text-ink hover:border-rule-3 hover:bg-band",
        )}
      >
        <Music size={18} strokeWidth={1.75} aria-hidden className={cn(playingId && "animate-pulse")} />
        <span className="hidden text-[0.8125rem] font-semibold sm:inline">Áudios</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Áudios"
          className="absolute bottom-full left-1/2 z-30 mb-3 flex max-h-[60vh] w-[20rem] -translate-x-1/2 flex-col border border-rule-2 bg-sheet shadow-overlay [border-radius:var(--radius-sheet)]"
        >
          <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <span className="block text-[0.875rem] font-semibold text-ink">Áudios</span>
              <span className="block text-[0.75rem] text-ink-3">Toca para todo mundo na sala.</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
              title="Enviar um áudio do computador para a lista de todos"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 border border-rule-2 px-2.5 py-1 text-[0.75rem] font-semibold text-ink transition-colors hover:border-rule-3 hover:bg-band disabled:opacity-60 [border-radius:var(--radius-cell)]"
            >
              {uploading ? (
                <LoaderCircle size={12} strokeWidth={2} aria-hidden className="animate-spin" />
              ) : (
                <Upload size={12} strokeWidth={2} aria-hidden />
              )}
              {uploading ? "Enviando…" : "Importar"}
            </button>
            {playingId ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex shrink-0 items-center gap-1.5 border border-alert-line bg-alert-wash px-2.5 py-1 text-[0.75rem] font-semibold text-alert transition-colors hover:bg-alert-wash-2 [border-radius:var(--radius-cell)]"
              >
                <Square size={12} strokeWidth={2} aria-hidden />
                Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={refresh}
                aria-label="Atualizar a lista"
                title="Atualizar a lista"
                className="shrink-0 p-1.5 text-ink-3 transition-colors hover:text-ink"
              >
                <RotateCw size={15} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listError ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-warn">{listError}</p>
            ) : sounds === null ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-ink-3">Carregando…</p>
            ) : sounds.length === 0 ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-ink-3">
                Nenhum áudio no servidor ainda. Use “Importar” para mandar um do computador.
              </p>
            ) : (
              <ul aria-label="Áudios do servidor">
                {sounds.map((s) => {
                  const playing = playingId === s.id;
                  const loading = loadingId === s.id;
                  const edit = editing?.id === s.id ? editing : null;
                  if (edit) {
                    const deleting = edit.mode === "delete";
                    return (
                      <li key={s.id} className="border-b border-rule bg-band px-4 py-2.5 last:border-b-0">
                        <form onSubmit={(e) => submitEdit(e, s)} className="flex flex-col gap-2">
                          <span className="truncate text-[0.75rem] text-ink-3">
                            {deleting ? (
                              <>
                                Apagar <span className="font-semibold text-ink">{s.name}</span> para todo mundo?
                              </>
                            ) : (
                              "Novo nome"
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type={deleting ? "password" : "text"}
                              value={edit.value}
                              maxLength={100}
                              disabled={edit.busy}
                              placeholder={deleting ? "Senha" : s.name}
                              aria-label={deleting ? `Senha para apagar ${s.name}` : `Novo nome de ${s.name}`}
                              aria-invalid={edit.error ? true : undefined}
                              autoComplete={deleting ? "off" : undefined}
                              onFocus={(e) => {
                                if (!deleting) e.currentTarget.select();
                              }}
                              onChange={(e) => setEditing({ ...edit, value: e.target.value, error: null })}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  // Esc cancela a edição, não fecha o painel.
                                  e.stopPropagation();
                                  setEditing(null);
                                }
                              }}
                              className="min-w-0 flex-1 border border-rule-2 bg-sheet px-2 py-1 text-[0.875rem] text-ink outline-none focus:border-rule-3 disabled:opacity-60 [border-radius:var(--radius-cell)]"
                            />
                            <button
                              type="submit"
                              disabled={edit.busy || !edit.value.trim()}
                              aria-label={deleting ? "Apagar" : "Salvar nome"}
                              title={deleting ? "Apagar" : "Salvar"}
                              className={cn(
                                "inline-flex shrink-0 items-center justify-center border p-1.5 transition-colors disabled:opacity-60 [border-radius:var(--radius-cell)]",
                                deleting
                                  ? "border-alert-line bg-alert-wash text-alert hover:bg-alert-wash-2"
                                  : "border-rule-2 text-ink hover:border-rule-3 hover:bg-sheet",
                              )}
                            >
                              {edit.busy ? (
                                <LoaderCircle size={14} strokeWidth={2} aria-hidden className="animate-spin" />
                              ) : deleting ? (
                                <Trash2 size={14} strokeWidth={2} aria-hidden />
                              ) : (
                                <Check size={14} strokeWidth={2} aria-hidden />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              disabled={edit.busy}
                              aria-label="Cancelar"
                              title="Cancelar"
                              className="shrink-0 p-1.5 text-ink-3 transition-colors hover:text-ink disabled:opacity-60"
                            >
                              <X size={14} strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                          {edit.error ? (
                            <span role="alert" className="text-[0.75rem] text-warn">
                              {edit.error}
                            </span>
                          ) : null}
                        </form>
                      </li>
                    );
                  }
                  return (
                    <li key={s.id} className="group flex items-center border-b border-rule last:border-b-0">
                      <button
                        type="button"
                        onClick={() => (playing ? stop() : play(s))}
                        aria-pressed={playing}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 text-left transition-colors hover:bg-band",
                          playing && "bg-band",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full border",
                            playing ? "border-signal bg-signal text-on-signal" : "border-rule-2 text-ink-2",
                          )}
                        >
                          {loading ? (
                            <LoaderCircle size={14} strokeWidth={2} className="animate-spin" />
                          ) : playing ? (
                            <Square size={11} strokeWidth={2.25} />
                          ) : (
                            <Play size={13} strokeWidth={2} className="translate-x-px" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">{s.name}</span>
                        <span className="sr-only">{playing ? " (tocando, clique para parar)" : ""}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(s, "rename")}
                          aria-label={`Renomear ${s.name}`}
                          title="Renomear"
                          className="p-1.5 text-ink-3 transition-colors hover:text-ink"
                        >
                          <Pencil size={14} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(s, "delete")}
                          aria-label={`Apagar ${s.name}`}
                          title="Apagar (pede senha)"
                          className="p-1.5 text-ink-3 transition-colors hover:text-alert"
                        >
                          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? (
            <p role="alert" className="border-t border-rule px-4 py-2.5 text-[0.8125rem] text-warn">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
