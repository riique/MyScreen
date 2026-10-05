"use client";

import dynamic from "next/dynamic";
import { use, useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { GreenRoom, type GreenRoomJoinConfig } from "@/components/conference/GreenRoom";

const NICKNAME_KEY = "myscreen:nickname";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

interface RoomInfo {
  title: string;
  isLocked: boolean;
}

/** O token do LiveKit vive 6h; renovar na metade evita cair no meio da call. */
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * O SDK do LiveKit entra dinamico e sem SSR: ele vale meio megabyte de bundle e
 * nao precisa existir enquanto a pessoa ainda esta no lobby conferindo camera e
 * microfone. A folha do lobby monta sem ele.
 */
const ConferenceRoom = dynamic(
  () => import("@/components/conference/ConferenceRoom").then((m) => m.ConferenceRoom),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-[34rem] px-4 py-20 sm:px-6">
        <p className="font-mono text-[0.8125rem] text-ink-3">Preparando sala...</p>
      </div>
    ),
  },
);

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const roomId = id.toLowerCase().trim();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantIdentity, setParticipantIdentity] = useState<string | null>(null);
  const [joinPassword, setJoinPassword] = useState<string | undefined>(undefined);
  const [joinConfig, setJoinConfig] = useState<
    Pick<
      GreenRoomJoinConfig,
      "audioEnabled" | "videoEnabled" | "audioDeviceId" | "videoDeviceId"
    > | null
  >(null);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Sem contas, o apelido é lembrado pelo próprio navegador: quem volta para
    // outra sala não digita o nome de novo.
    try {
      setUserName(localStorage.getItem(NICKNAME_KEY));
    } catch {
      // Armazenamento bloqueado: o campo só começa vazio.
    }

    void fetch(`/api/rooms/${roomId}`, { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar sala (${res.status})`);
        return res.json();
      })
      .then((data: { room?: { title?: string; isLocked?: boolean } | null }) => {
        setRoomInfo({
          title: data.room?.title || `Sala ${roomId}`,
          isLocked: Boolean(data.room?.isLocked),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Sala efêmera não está no banco, mas é válida: o endpoint responde 200
        // com `exists: false`. O lobby só precisa de um título para mostrar.
        console.error("Erro ao carregar sala:", error);
        setRoomInfo({ title: `Sala ${roomId}`, isLocked: false });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [roomId]);

  const handleJoin = useCallback(
    async (config: GreenRoomJoinConfig) => {
      setJoinError(null);
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            nickname: config.nickname,
            password: config.password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setJoinError(data.error || "Não foi possível conectar à sala.");
          return false;
        }
        setToken(data.token);
        setServerUrl(data.livekitUrl);
        setParticipantName(config.nickname);
        try {
          localStorage.setItem(NICKNAME_KEY, config.nickname);
        } catch {
          // Lembrar o apelido é conveniência, não requisito.
        }
        setParticipantIdentity(data.participantIdentity || null);
        setJoinPassword(config.password);
        setJoinConfig({
          audioEnabled: config.audioEnabled,
          videoEnabled: config.videoEnabled,
          audioDeviceId: config.audioDeviceId,
          videoDeviceId: config.videoDeviceId,
        });
        setJoined(true);
        return true;
      } catch {
        setJoinError("Erro de comunicação com o servidor de conferência.");
        return false;
      }
    },
    [roomId],
  );

  // Reusa a MESMA identidade de participante ao renovar: um identificador novo
  // faria o SFU tratar o_refresh como outra pessoa, e o sintoma é o
  // participante aparecer duplicado logo depois de reconectar.
  const refreshToken = useCallback(async () => {
    if (!participantIdentity || !participantName) return;
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          nickname: participantName,
          participantIdentity,
          password: joinPassword,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.token) setToken(data.token);
    } catch {
      // Renovar é rotina: falhar aqui derruba a chamada em curso sem necessidade.
    }
  }, [roomId, participantIdentity, participantName, joinPassword]);

  useEffect(() => {
    if (!joined) return;
    const id = setInterval(() => {
      void refreshToken();
    }, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [joined, refreshToken]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[34rem] px-4 py-20 sm:px-6">
        <p className="font-mono text-[0.8125rem] text-ink-3">Preparando sala...</p>
      </div>
    );
  }

  if (joined && token && serverUrl && joinConfig) {
    return (
      <ConferenceRoom
        token={token}
        serverUrl={serverUrl}
        initialAudioEnabled={joinConfig.audioEnabled}
        initialVideoEnabled={joinConfig.videoEnabled}
        initialAudioDeviceId={joinConfig.audioDeviceId}
        initialVideoDeviceId={joinConfig.videoDeviceId}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[68rem] px-4 py-10 sm:px-6">
      {joinError ? (
        <Sheet className="mb-6 border-alert-line bg-alert-wash px-5 py-3.5">
          <p role="alert" className="text-[0.875rem] text-alert">
            {joinError}
          </p>
        </Sheet>
      ) : null}

      <GreenRoom
        roomId={roomId}
        roomTitle={roomInfo?.title || `Sala ${roomId}`}
        isLocked={Boolean(roomInfo?.isLocked)}
        initialNickname={userName || ""}
        onJoin={handleJoin}
      />
    </div>
  );
}
