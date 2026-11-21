import { ConnectionState, ParticipantKind, RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useEffect } from "react";

/**
 * Sons de entrada e saída da chamada.
 *
 * Não há trilha publicada nem mensagem extra: cada pessoa na sala ouve os
 * eventos de presença do LiveKit e toca o som no próprio alto-falante. Como
 * todos recebem os mesmos eventos, todos ouvem o mesmo som, inclusive quem
 * acabou de entrar (o próprio som de entrada, ao conectar).
 *
 * Os sons são sintetizados (duas notas curtas, subindo na entrada e descendo
 * na saída), então não há arquivo para baixar nem para cachear.
 */
export type CallCue = "join" | "leave";

const NOTES: Record<CallCue, readonly [number, number]> = {
  join: [587.33, 880], // ré5 → lá5
  leave: [880, 587.33], // lá5 → ré5
};

const VOLUME = 0.2;
/** O mesmo som dentro desta janela vira um só: cinco pessoas entrando juntas não viram uma rajada. */
const COALESCE_MS = 400;
/** Uma reconexão completa do LiveKit desfaz e refaz todos os participantes; esperamos ela se assentar. */
const LEAVE_CONFIRM_MS = 250;
const RECONCILE_MS = 1500;

type SinkContext = AudioContext & { sinkId?: string; setSinkId?: (id: string) => Promise<void> };

let sharedCtx: SinkContext | null = null;
// Fora do hook: se a sala remontar, o mesmo som não toca duas vezes seguidas.
const lastPlayed: Record<CallCue, number> = { join: 0, leave: 0 };

function audioContext(): SinkContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor({ latencyHint: "interactive" }) as SinkContext;
  } catch {
    return null;
  }
  return sharedCtx;
}

function tone(ctx: AudioContext, out: AudioNode, freq: number, start: number, length: number) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(1, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  env.connect(out);

  // Fundamental senoidal com um pouco de oitava: soa como um sino macio, não como um bipe.
  const partials: Array<[OscillatorType, number, number]> = [
    ["sine", freq, 1],
    ["sine", freq * 2, 0.18],
  ];
  for (const [type, f, level] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    gain.gain.value = level;
    osc.connect(gain).connect(env);
    osc.start(start);
    osc.stop(start + length + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

/** Toca o som na saída de áudio escolhida para a chamada. Falhas são silenciosas: é só um aviso. */
export async function playCallCue(cue: CallCue, sinkId?: string): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (ctx.setSinkId && sinkId && sinkId !== "default" && ctx.sinkId !== sinkId) {
      await ctx.setSinkId(sinkId).catch(() => {});
    }
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return;
  } catch {
    return;
  }

  const master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.02;
  const [first, second] = NOTES[cue];
  tone(ctx, master, first, t0, 0.22);
  tone(ctx, master, second, t0 + 0.11, 0.32);
  setTimeout(() => master.disconnect(), 700);
}

function counts(participant: RemoteParticipant): boolean {
  // Gravações e agentes do servidor não são pessoas entrando na chamada.
  return participant.kind !== ParticipantKind.EGRESS && participant.kind !== ParticipantKind.AGENT;
}

/**
 * Liga os sons de entrada e saída a uma sala. Quem já estava na sala ao
 * montar não toca nada; o próprio participante ouve o som de entrada ao
 * conectar.
 */
export function useCallSounds(room: Room, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    // Quem já foi anunciado como presente. Sobrevive a reconexões nossas, para
    // que o LiveKit desfazendo e refazendo a lista não vire "saiu/entrou".
    const known = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let selfAnnounced = false;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const play = (cue: CallCue) => {
      const now = Date.now();
      if (now - lastPlayed[cue] < COALESCE_MS) return;
      lastPlayed[cue] = now;
      void playCallCue(cue, room.getActiveDevice("audiooutput"));
    };

    const syncKnown = () => {
      for (const p of room.remoteParticipants.values()) if (counts(p)) known.add(p.identity);
    };

    const announceSelf = () => {
      if (selfAnnounced) return;
      selfAnnounced = true;
      syncKnown();
      play("join");
    };

    const onConnected = (participant: RemoteParticipant) => {
      if (!counts(participant) || known.has(participant.identity)) return;
      known.add(participant.identity);
      play("join");
    };

    const onDisconnected = (participant: RemoteParticipant) => {
      if (!counts(participant)) return;
      const { identity } = participant;
      // Numa reconexão completa nossa, o LiveKit tira todo mundo da lista logo
      // antes de passar para "reconectando". Só vale como saída se a sala
      // continua conectada e a pessoa não voltou.
      later(() => {
        if (room.state !== ConnectionState.Connected) return;
        if (room.remoteParticipants.has(identity)) return;
        if (!known.delete(identity)) return;
        play("leave");
      }, LEAVE_CONFIRM_MS);
    };

    const onReconnected = () => {
      // Quem saiu enquanto estávamos fora não voltou na lista nova.
      later(() => {
        if (room.state !== ConnectionState.Connected) return;
        let someoneLeft = false;
        for (const identity of [...known]) {
          if (!room.remoteParticipants.has(identity)) {
            known.delete(identity);
            someoneLeft = true;
          }
        }
        if (someoneLeft) play("leave");
      }, RECONCILE_MS);
    };

    if (room.state === ConnectionState.Connected) announceSelf();
    else syncKnown();

    room
      .on(RoomEvent.Connected, announceSelf)
      .on(RoomEvent.ParticipantConnected, onConnected)
      .on(RoomEvent.ParticipantDisconnected, onDisconnected)
      .on(RoomEvent.Reconnected, onReconnected);

    return () => {
      room
        .off(RoomEvent.Connected, announceSelf)
        .off(RoomEvent.ParticipantConnected, onConnected)
        .off(RoomEvent.ParticipantDisconnected, onDisconnected)
        .off(RoomEvent.Reconnected, onReconnected);
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, [room, enabled]);
}
