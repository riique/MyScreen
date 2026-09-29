"use client";

import { useEffect, useState, use } from "react";
import { GreenRoom } from "@/components/conference/GreenRoom";
import { ConferenceRoom } from "@/components/conference/ConferenceRoom";
import { AlertCircle } from "lucide-react";

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
  const [joinConfig, setJoinConfig] = useState<{
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }>({ audioEnabled: true, videoEnabled: true });
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    // Check session profile
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserProfile(data.user);
      })
      .catch(() => {});

    // Fetch room public info
    fetch(`/api/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) {
          setRoomInfo({
            title: data.room.title,
            isLocked: data.room.isLocked,
          });
        } else {
          setRoomInfo({
            title: `Sala ${roomId}`,
            isLocked: false,
          });
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar sala:", err);
        setRoomInfo({
          title: `Sala ${roomId}`,
          isLocked: false,
        });
      })
      .finally(() => setLoading(false));
  }, [roomId]);

  const handleJoin = async (config: {
    nickname: string;
    password?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }) => {
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
        return;
      }

      setToken(data.token);
      setServerUrl(data.livekitUrl);
      setParticipantName(config.nickname);
      setJoinConfig({
        audioEnabled: config.audioEnabled,
        videoEnabled: config.videoEnabled,
        audioDeviceId: config.audioDeviceId,
        videoDeviceId: config.videoDeviceId,
      });
      setJoined(true);
    } catch {
      setJoinError("Erro de comunicação com o servidor de conferência.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
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
        roomId={roomId}
        participantName={participantName}
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
          <div className="flex items-center gap-2 rounded-xl bg-red-950/80 border border-red-500/40 p-4 text-xs font-semibold text-red-200">
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
