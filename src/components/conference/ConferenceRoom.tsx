"use client";

import { useState, useCallback, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useParticipants,
  VideoTrack,
  AudioTrack,
  useMediaDeviceSelect,
  isTrackReference,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useRouter } from "next/navigation";
import { MediaControls } from "./MediaControls";
import { ChatSidebar } from "./ChatSidebar";
import { ParticipantsList } from "./ParticipantsList";
import { SettingsModal, MediaSettings } from "./SettingsModal";
import { Mic, MicOff, Monitor, User } from "lucide-react";

interface ConferenceRoomProps {
  token: string;
  serverUrl: string;
  roomId: string;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
  participantName: string;
}

export function ConferenceRoom({
  token,
  serverUrl,
  roomId,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  initialAudioDeviceId,
  initialVideoDeviceId,
  participantName,
}: ConferenceRoomProps) {
  const router = useRouter();

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={initialAudioEnabled}
      video={initialVideoEnabled}
      onDisconnected={() => {
        router.push("/dashboard");
      }}
      className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#07080c] select-none"
    >
      <ConferenceStage
        roomId={roomId}
        participantName={participantName}
        initialAudioDeviceId={initialAudioDeviceId}
        initialVideoDeviceId={initialVideoDeviceId}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function ConferenceStage({
  roomId,
  participantName,
  initialAudioDeviceId,
  initialVideoDeviceId,
}: {
  roomId: string;
  participantName: string;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
}) {
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Panels state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusLayout, setIsFocusLayout] = useState(true);

  // Advanced media settings state
  const [settings, setSettings] = useState<MediaSettings>({
    screenFps: 60,
    screenResolution: "1080p",
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    audioInputId: initialAudioDeviceId,
    videoInputId: initialVideoDeviceId,
  });

  // Devices list
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });

  useEffect(() => {
    async function loadDevices() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audioInputs: devs.filter((d) => d.kind === "audioinput"),
          videoInputs: devs.filter((d) => d.kind === "videoinput"),
          audioOutputs: devs.filter((d) => d.kind === "audiooutput"),
        });
      } catch (e) {
        console.warn("Could not enumerate devices:", e);
      }
    }
    loadDevices();
  }, []);

  // Fetch all video and screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Screen share tracks across participants
  const screenShareTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track
  );

  // Camera tracks across participants
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicOn, {
        deviceId: settings.audioInputId,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
      });
    } catch (err) {
      console.error("Erro ao alternar microfone:", err);
    }
  }, [localParticipant, isMicOn, settings]);

  const toggleCam = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCamOn, {
        deviceId: settings.videoInputId,
      });
    } catch (err) {
      console.error("Erro ao alternar câmera:", err);
    }
  }, [localParticipant, isCamOn, settings.videoInputId]);

  const toggleScreenShare = useCallback(async () => {
    try {
      const nextState = !isScreenSharing;
      if (nextState) {
        // Publish Screen Share WITH Audio and chosen FPS / Resolution
        await localParticipant.setScreenShareEnabled(true, {
          audio: true,
          contentHint: "motion",
          resolution:
            settings.screenResolution === "4k"
              ? { width: 3840, height: 2160, frameRate: settings.screenFps }
              : settings.screenResolution === "720p"
              ? { width: 1280, height: 720, frameRate: settings.screenFps }
              : { width: 1920, height: 1080, frameRate: settings.screenFps },
        });
      } else {
        await localParticipant.setScreenShareEnabled(false);
      }
    } catch (err) {
      console.error("Erro ao compartilhar tela:", err);
    }
  }, [localParticipant, isScreenSharing, settings]);

  const handleLeave = () => {
    router.push("/");
  };

  const hasActiveScreenShare = screenShareTracks.length > 0;

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Main Video Arena */}
      <div className="relative flex flex-1 flex-col p-4 pb-24 overflow-hidden">
        {hasActiveScreenShare && isFocusLayout ? (
          // Presentation Layout: Large Screen Share + Webcam strip / PiP
          <div className="relative flex flex-1 flex-col lg:flex-row gap-4 h-full w-full overflow-hidden">
            {/* Primary Screen Share Display */}
            <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#0c0e15] border border-border/80 shadow-2xl flex items-center justify-center">
              {isTrackReference(screenShareTracks[0]) && screenShareTracks[0].publication?.track && (
                <VideoTrack
                  trackRef={screenShareTracks[0]}
                  className="h-full w-full object-contain"
                />
              )}
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 text-xs font-medium text-white">
                <Monitor className="h-4 w-4 text-emerald-400" />
                <span>
                  Tela de {screenShareTracks[0].participant.name || screenShareTracks[0].participant.identity}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                  AO VIVO
                </span>
              </div>
            </div>

            {/* Side / Bottom Webcam Column */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-72 shrink-0">
              {cameraTracks.map((trackRef) => {
                const p = trackRef.participant;
                const hasCam = isTrackReference(trackRef) && trackRef.publication?.track && !trackRef.publication.isMuted;
                const isSpeaking = p.isSpeaking;

                return (
                  <div
                    key={`${p.identity}-cam`}
                    className={`relative aspect-video rounded-xl overflow-hidden bg-[#11131c] border transition-all shrink-0 w-48 lg:w-full ${
                      isSpeaking
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-border/70"
                    }`}
                  >
                    {hasCam && isTrackReference(trackRef) ? (
                      <VideoTrack
                        trackRef={trackRef}
                        className="h-full w-full object-cover -scale-x-100"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#131622] text-gray-400">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-gray-300 font-bold text-base">
                          {(p.name || p.identity).charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    {/* Participant Badge */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/70 backdrop-blur-md px-2 py-1 text-[11px] text-white font-medium border border-white/10">
                      <span>{p.name || p.identity}</span>
                      {p.isLocal && <span className="text-[9px] text-indigo-400">(Você)</span>}
                      {p.isMicrophoneEnabled ? (
                        <Mic className="h-3 w-3 text-emerald-400 ml-1" />
                      ) : (
                        <MicOff className="h-3 w-3 text-red-400 ml-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Grid Layout: Adaptive Grid of Participants
          <div
            className={`grid flex-1 gap-4 h-full w-full overflow-y-auto p-1 ${
              tracks.length <= 1
                ? "grid-cols-1"
                : tracks.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : tracks.length <= 4
                ? "grid-cols-2"
                : "grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {tracks.map((trackRef) => {
              const p = trackRef.participant;
              const isScreen = trackRef.source === Track.Source.ScreenShare;
              const hasVideo = isTrackReference(trackRef) && trackRef.publication?.track && !trackRef.publication.isMuted;
              const isSpeaking = p.isSpeaking;

              return (
                <div
                  key={`${p.identity}-${trackRef.source}`}
                  className={`relative rounded-2xl overflow-hidden bg-[#11131c] border flex items-center justify-center transition-all ${
                    isSpeaking
                      ? "border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30"
                      : "border-border/80"
                  }`}
                >
                  {hasVideo && isTrackReference(trackRef) ? (
                    <VideoTrack
                      trackRef={trackRef}
                      className={`h-full w-full ${isScreen ? "object-contain" : "object-cover -scale-x-100"}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/80 text-gray-300 font-bold text-2xl border border-border/80 mb-2">
                        {(p.name || p.identity).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {p.name || p.identity}
                      </span>
                    </div>
                  )}

                  {/* Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs text-white font-medium border border-white/10">
                    {isScreen && <Monitor className="h-3.5 w-3.5 text-emerald-400" />}
                    <span>{isScreen ? `Tela de ${p.name || p.identity}` : p.name || p.identity}</span>
                    {p.isLocal && <span className="text-[10px] text-indigo-400 font-bold">(Você)</span>}
                    {p.isMicrophoneEnabled ? (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebars */}
      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        localParticipantName={participantName}
      />

      <ParticipantsList
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        localIdentity={localParticipant.identity}
      />

      {/* Floating Bottom Media Bar */}
      <MediaControls
        isMicOn={isMicOn}
        isCamOn={isCamOn}
        isScreenSharing={isScreenSharing}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        isFocusLayout={isFocusLayout}
        participantCount={participants.length}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreenShare={toggleScreenShare}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (isParticipantsOpen) setIsParticipantsOpen(false);
        }}
        onToggleParticipants={() => {
          setIsParticipantsOpen(!isParticipantsOpen);
          if (isChatOpen) setIsChatOpen(false);
        }}
        onToggleLayout={() => setIsFocusLayout(!isFocusLayout)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeave={handleLeave}
        roomId={roomId}
      />

      {/* Advanced Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        devices={devices}
      />
    </div>
  );
}
