"use client";

import { useCallback, useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import { GreenRoom } from "@/components/conference/GreenRoom";
import { AlertCircle } from "lucide-react";

// Code-split: o SDK do LiveKit (bundle de ~530 KB) só deve ser baixado
// depois que o usuário efetivamente entra na sala, nunca no lobby.
const ConferenceRoom = dynamic(
  () =>
    import("@/components/conference/ConferenceRoom").then(
      (m) => m.ConferenceRoom
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-gray-400">Preparando sala...</span>
        </div>
      </div>
    ),
  }
);

const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const roomId = id.toLowerCase().trim();

  // Room state
  const [roomInfo, setRoomInfo] = useState<{
    title: string;
    isLocked: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ name: string } | null>(null);

  // Conference state
  const [joined, setJoined] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  // Identidade fixa do participante: reenviá-la no refresh evita duplicar o
  // participante na sala (o anterior só sairia após o empty_timeout de 300s).
  const [participantIdentity, setParticipantIdentity] = useState<string | null>(
    null
  );
  // Necessária para renovar o token em salas trancadas, que exigem a senha.
  const [joinPassword, setJoinPassword] = useState<string | undefined>(
    undefined
  );
  const [joinConfig, setJoinConfig] = useState<{
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }>({ audioEnabled: true, videoEnabled: true });
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fallbackRoomInfo = {
      title: `Sala ${roomId}`,
      isLocked: false,
    };

    // Check session profile
    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar sessão (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (data.user) setUserProfile(data.user);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Erro ao carregar sessão:", err);
      });

    // Fetch room public info
    fetch(`/api/rooms/${roomId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar sala (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (data.room) {
          setRoomInfo({
            title: data.room.title,
            isLocked: data.room.isLocked,
          });
        } else {
          setRoomInfo(fallbackRoomInfo);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Erro ao carregar sala:", err);
        setRoomInfo(fallbackRoomInfo);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [roomId]);

  const handleJoin = async (config: {
    nickname: string;
    password?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }): Promise<boolean> => {
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
  };

  // Renova o token de acesso periodicamente. O `ConferenceRoom` escreve o token
  // novo no motor: sozinho a prop `token` não renova nada, porque `Room.connect`
  // retorna cedo quando a sala já está conectada.
  // Falha é silenciosa: o token de 6h ainda vale, não derrubamos a chamada.
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
          // Salas trancadas exigem a senha a cada renovação.
          password: joinPassword,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.token) setToken(data.token);
    } catch {
      // Silencioso: o token atual continua válido.
    }
  }, [roomId, participantIdentity, participantName, joinPassword]);

  useEffect(() => {
    if (!joined) return;
    const interval = setInterval(() => {
      void refreshToken();
    }, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [joined, refreshToken]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-gray-400">Preparando sala...</span>
        </div>
      </div>
    );
  }

  if (joined && token && serverUrl) {
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
    <div>
      {joinError && (
        <div className="container mx-auto px-4 pt-6 max-w-xl">
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-950/80 border border-red-500/40 p-4 text-xs font-semibold text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{joinError}</span>
          </div>
        </div>
      )}

      <GreenRoom
        roomId={roomId}
        roomTitle={roomInfo?.title || `Sala ${roomId}`}
        isLocked={Boolean(roomInfo?.isLocked)}
        initialNickname={userProfile?.name || ""}
        onJoin={handleJoin}
      />
    </div>
  );
}
