import { useCallback, useEffect, useRef, useState } from "react";
import {
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
} from "livekit-client";

/** O que compõe uma transmissão: a imagem da tela e o som que vai junto. */
const SHARE_SOURCES: ReadonlySet<Track.Source> = new Set([Track.Source.ScreenShare, Track.Source.ScreenShareAudio]);

export interface LeftShares {
  /** Pessoas (identity) de quem eu saí da transmissão. */
  left: ReadonlySet<string>;
  leave: (identity: string) => void;
  rejoin: (identity: string) => void;
}

/**
 * Sair da transmissão de alguém: deixo de receber a tela e o som dela —
 * cancela a assinatura no SFU, então nem a banda é gasta. Só para mim; quem
 * transmite e os outros não percebem nada. Voltar assina de novo.
 *
 * Vale para a pessoa, não para a trilha: se ela parar e transmitir de novo,
 * continuo fora até voltar. Quem sai da sala sai da lista.
 */
export function useLeftShares(room: Room): LeftShares {
  const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set());
  const leftRef = useRef(left);
  leftRef.current = left;

  const apply = useCallback(
    (identity: string, subscribed: boolean) => {
      const participant = room.remoteParticipants.get(identity);
      if (!participant) return;
      for (const pub of participant.trackPublications.values()) {
        if (pub.source && SHARE_SOURCES.has(pub.source)) pub.setSubscribed(subscribed);
      }
    },
    [room],
  );

  const leave = useCallback(
    (identity: string) => {
      setLeft((cur) => new Set(cur).add(identity));
      apply(identity, false);
    },
    [apply],
  );

  const rejoin = useCallback(
    (identity: string) => {
      setLeft((cur) => {
        const next = new Set(cur);
        next.delete(identity);
        return next;
      });
      apply(identity, true);
    },
    [apply],
  );

  useEffect(() => {
    // Transmissão nova (ou de novo) de quem eu deixei: nem começa a chegar.
    const onPublished = (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (leftRef.current.has(participant.identity) && pub.source && SHARE_SOURCES.has(pub.source)) {
        pub.setSubscribed(false);
      }
    };
    // A assinatura automática pode chegar depois: desfaz também.
    const onSubscribed = (_track: unknown, pub: RemoteTrackPublication, participant: RemoteParticipant) =>
      onPublished(pub, participant);
    const onGone = (participant: RemoteParticipant) => {
      if (!leftRef.current.has(participant.identity)) return;
      setLeft((cur) => {
        const next = new Set(cur);
        next.delete(participant.identity);
        return next;
      });
    };
    room.on(RoomEvent.TrackPublished, onPublished);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onGone);
    return () => {
      room.off(RoomEvent.TrackPublished, onPublished);
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onGone);
    };
  }, [room]);

  return { left, leave, rejoin };
}
