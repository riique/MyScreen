import type { ReceivedChatMessage } from "@livekit/components-react";
import { RoomEvent, type Room } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatArchiveSummary, StoredChatMessage } from "@shared/ipc";

/** Um anexo na tela: o `File` que chegou pela sala, ou um id do histórico no servidor. */
export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  file?: File;
  remoteId?: string;
}

/** Uma linha do chat, venha ela da sala agora ou do histórico guardado. */
export interface ChatEntry {
  id: string;
  timestamp: number;
  message: string;
  attributes: Record<string, string>;
  fromIdentity: string;
  fromName: string;
  isLocal: boolean;
  files: ChatAttachment[];
}

export type ChatSend = (
  message: string,
  options?: { attachments?: File[]; attributes?: Record<string, string> },
) => Promise<unknown>;

/** Aviso na sala: "apaguei a mensagem X". Cada um tira da própria tela. */
const DELETE_TOPIC = "myscreen.chat.delete";
/**
 * Aviso na sala: "arquivei a conversa". Cada um limpa o próprio chat — o
 * site também escuta este tópico. Corpo: `{ archivedIds: string[] }`.
 */
export const ARCHIVE_TOPIC = "myscreen.chat.archived";

export interface RoomChat {
  entries: ChatEntry[];
  send: ChatSend;
  remove: (id: string) => Promise<void>;
  /** Busca os bytes de um anexo do histórico (com cache). */
  loadFile: (attachment: ChatAttachment) => Promise<Blob>;
  /** Guarda a conversa atual à parte e começa um chat novo, para todos. */
  archive: () => Promise<void>;
  /** As conversas guardadas da sala, da mais nova para a mais antiga. */
  listArchives: () => Promise<ChatArchiveSummary[]>;
  /** As mensagens de uma conversa guardada, prontas para mostrar. */
  openArchive: (id: string) => Promise<ChatEntry[]>;
  /** Muda quando alguém arquiva: a lista de conversas salvas precisa recarregar. */
  archiveVersion: number;
}

/**
 * O chat da sala com memória. O que vai pela sala continua indo pelo canal de
 * dados (rápido, e o site também recebe); cada um guarda no servidor o que
 * mandou, com os anexos. Ao entrar, o histórico guardado aparece antes das
 * mensagens ao vivo — sair, reiniciar o app e voltar para a mesma sala traz
 * a conversa de volta.
 */
export function useRoomChat({
  room,
  roomId,
  roomToken,
  live,
  sendLive,
}: {
  room: Room;
  roomId: string;
  roomToken: string;
  live: ReceivedChatMessage[];
  sendLive: (message: string, options?: { attachments?: File[]; attributes?: Record<string, string> }) => Promise<ReceivedChatMessage>;
}): RoomChat {
  const [history, setHistory] = useState<StoredChatMessage[]>([]);
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());
  const [archiveVersion, setArchiveVersion] = useState(0);
  const tokenRef = useRef(roomToken);
  tokenRef.current = roomToken;
  const fileCache = useRef(new Map<string, Promise<Blob>>());

  useEffect(() => {
    let alive = true;
    void window.myscreen.api.chatHistory(roomId, tokenRef.current).then((r) => {
      if (!alive) return;
      if (r.ok) setHistory(r.data);
      else console.warn("Histórico do chat indisponível:", r.error);
    });
    return () => {
      alive = false;
    };
  }, [roomId]);

  const myIdentity = room.localParticipant.identity;

  const entries = useMemo(() => {
    const liveIds = new Set(live.map((m) => m.id));
    const out: ChatEntry[] = [];
    for (const m of history) {
      if (liveIds.has(m.id)) continue;
      out.push(storedEntry(m, myIdentity));
    }
    for (const m of live) {
      out.push({
        id: m.id,
        timestamp: m.timestamp,
        message: m.message,
        attributes: m.attributes ?? {},
        fromIdentity: m.from?.identity ?? "",
        fromName: m.from?.name || m.from?.identity || "",
        // `isLocal` é a autoridade do SDK, não o apelido.
        isLocal: m.from?.isLocal === true,
        files: (m.attachedFiles ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type, file: f })),
      });
    }
    return out.filter((e) => !deleted.has(e.id)).sort((a, b) => a.timestamp - b.timestamp);
  }, [history, live, deleted, myIdentity]);

  // Apagar só vale vindo do autor: compara quem avisou com quem mandou.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  /**
   * A conversa foi arquivada (por mim ou por outro): some da tela tudo o que
   * estava nela, inclusive mensagens ao vivo que o servidor nunca guardou.
   * O que chegar depois já é do chat novo.
   */
  const clearArchived = useCallback((archivedIds: string[]) => {
    const gone = new Set([...archivedIds, ...entriesRef.current.map((e) => e.id)]);
    setDeleted((cur) => new Set([...cur, ...gone]));
    setHistory((cur) => cur.filter((m) => !gone.has(m.id)));
    setArchiveVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: { identity: string }, _k?: unknown, topic?: string) => {
      if (topic === ARCHIVE_TOPIC && participant) {
        let ids: string[] = [];
        try {
          const raw = JSON.parse(new TextDecoder().decode(payload)) as { archivedIds?: unknown };
          if (Array.isArray(raw.archivedIds)) ids = raw.archivedIds.filter((x): x is string => typeof x === "string");
        } catch {
          // Aviso sem corpo: limpa o que está na tela.
        }
        clearArchived(ids);
        return;
      }
      if (topic !== DELETE_TOPIC || !participant) return;
      const id = new TextDecoder().decode(payload).slice(0, 128);
      const entry = entriesRef.current.find((e) => e.id === id);
      if (!entry || entry.fromIdentity !== participant.identity) return;
      setDeleted((cur) => new Set(cur).add(id));
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, clearArchived]);

  const send = useCallback<ChatSend>(
    async (message, options) => {
      const sent = await sendLive(message, options);
      // Guardar é melhor-esforço: a mensagem já chegou a quem está na sala.
      void (async () => {
        const fileIds: string[] = [];
        for (const file of options?.attachments ?? []) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const r = await window.myscreen.api.chatUploadFile(roomId, tokenRef.current, {
            name: file.name || "arquivo",
            type: file.type,
            bytes,
          });
          if (!r.ok) throw new Error(r.error);
          fileIds.push(r.data.id);
        }
        const r = await window.myscreen.api.chatAppend(roomId, tokenRef.current, {
          id: sent.id,
          timestamp: sent.timestamp,
          message,
          attributes: options?.attributes ?? {},
          fileIds,
        });
        if (!r.ok) throw new Error(r.error);
      })().catch((err) => console.warn("Mensagem não ficou no histórico:", err));
      return sent;
    },
    [roomId, sendLive],
  );

  const remove = useCallback(
    async (id: string) => {
      const r = await window.myscreen.api.chatDelete(roomId, tokenRef.current, id);
      // Servidor sem histórico (rota ausente): ainda some da tela de todos.
      if (!r.ok && r.status !== 404 && r.status !== 405) throw new Error(r.error);
      setDeleted((cur) => new Set(cur).add(id));
      await room.localParticipant
        .publishData(new TextEncoder().encode(id), { reliable: true, topic: DELETE_TOPIC })
        .catch(() => {});
    },
    [room, roomId],
  );

  const loadFile = useCallback(
    (a: ChatAttachment): Promise<Blob> => {
      if (a.file) return Promise.resolve(a.file);
      const id = a.remoteId;
      if (!id) return Promise.reject(new Error("Anexo sem origem."));
      let p = fileCache.current.get(id);
      if (!p) {
        p = window.myscreen.api.chatFile(roomId, tokenRef.current, id).then((r) => {
          if (!r.ok) throw new Error(r.error);
          return new Blob([r.data as Uint8Array<ArrayBuffer>], { type: a.type });
        });
        p.catch(() => fileCache.current.delete(id));
        fileCache.current.set(id, p);
      }
      return p;
    },
    [roomId],
  );

  const archive = useCallback(async () => {
    const r = await window.myscreen.api.chatArchive(roomId, tokenRef.current);
    if (!r.ok) throw new Error(r.error);
    clearArchived(r.data.archivedIds);
    // Só os ids do servidor vão no aviso: cada um limpa o resto da própria tela.
    const body = JSON.stringify({ archivedIds: r.data.archivedIds.slice(0, 500) });
    await room.localParticipant
      .publishData(new TextEncoder().encode(body), { reliable: true, topic: ARCHIVE_TOPIC })
      .catch(() => {});
  }, [room, roomId, clearArchived]);

  const listArchives = useCallback(async () => {
    const r = await window.myscreen.api.chatArchives(roomId, tokenRef.current);
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }, [roomId]);

  const openArchive = useCallback(
    async (id: string) => {
      const r = await window.myscreen.api.chatArchiveMessages(roomId, tokenRef.current, id);
      if (!r.ok) throw new Error(r.error);
      return r.data.map((m) => storedEntry(m, myIdentity)).sort((a, b) => a.timestamp - b.timestamp);
    },
    [roomId, myIdentity],
  );

  return { entries, send, remove, loadFile, archive, listArchives, openArchive, archiveVersion };
}

function storedEntry(m: StoredChatMessage, myIdentity: string): ChatEntry {
  return {
    id: m.id,
    timestamp: m.timestamp,
    message: m.message,
    attributes: m.attributes,
    fromIdentity: m.fromIdentity,
    fromName: m.fromName,
    isLocal: m.fromIdentity !== "" && m.fromIdentity === myIdentity,
    files: m.files.map((f) => ({ name: f.name, size: f.size, type: f.type, remoteId: f.id })),
  };
}
