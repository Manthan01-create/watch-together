"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Share2, Copy, Check, Video, VideoOff, Mic, MicOff, 
  Volume2, VolumeX, ShieldAlert, Radio, Flame, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import RoomLobby from "@/components/RoomLobby";
import VideoPlayer from "@/components/VideoPlayer";
import MediaQueue from "@/components/MediaQueue";
import VideoGrid from "@/components/VideoGrid";
import ChatContainer from "@/components/ChatContainer";

import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";

interface PageProps {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  senderName: string;
  left: number;
}

export default function RoomPage(props: PageProps) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const roomId = params.roomId;
  const router = useRouter();

  // URL query variables (passed during room creation)
  const queryName = (searchParams.name as string) || `Room ${roomId.substring(0, 6)}`;
  const queryPassword = (searchParams.pw as string) || "";
  const queryIsPublic = searchParams.isPublic === "true";

  // Lobby states
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(queryPassword);
  const [lobbyError, setLobbyError] = useState("");
  
  // Media source device configuration (from lobby selection)
  const [initialCamera, setInitialCamera] = useState(false);
  const [initialMic, setInitialMic] = useState(false);
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");

  // Sync Room states
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [roomState, setRoomState] = useState({
    activeVideoUrl: "",
    activeVideoType: "youtube",
    videoPlaying: false,
    videoTime: 0,
    pdfPage: 1,
    hostId: ""
  });

  // Share link copied feedback state
  const [copied, setCopied] = useState(false);

  // Floating emojis list
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Push to talk state
  const [pushToTalk, setPushToTalk] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Noise cancellation simulation
  const [noiseCancellation, setNoiseCancellation] = useState(false);

  // Connection parameters
  const [socketUsername, setSocketUsername] = useState("");

  // ----------------------------------------------------
  // Hooks setup
  // ----------------------------------------------------
  const {
    socket,
    isConnected,
    emitPlaybackControl,
    emitClaimHost,
    emitSendMessage,
    emitSendReaction,
    emitToggleMediaState
  } = useSocket({
    roomId,
    username: socketUsername,
    password,
    onRoomJoined: (data) => {
      setJoined(true);
      setUsers(data.users);
      setMessages(data.messages);
      setRoomState({
        activeVideoUrl: data.roomState.activeVideoUrl || "",
        activeVideoType: data.roomState.activeVideoType || "youtube",
        videoPlaying: data.roomState.videoPlaying,
        videoTime: data.roomState.videoTime,
        pdfPage: data.roomState.pdfPage || 1,
        hostId: data.roomState.hostId || ""
      });
      setLobbyError("");
    },
    onUpdateUsers: (usersList) => {
      setUsers(usersList);
    },
    onPlaybackUpdated: (data) => {
      setRoomState(prev => {
        const next = { ...prev };
        if (data.url !== undefined) next.activeVideoUrl = data.url;
        if (data.type !== undefined) next.activeVideoType = data.type;
        if (data.time !== undefined) next.videoTime = data.time;
        if (data.action === "play") next.videoPlaying = true;
        if (data.action === "pause") next.videoPlaying = false;
        if (data.page !== undefined) next.pdfPage = data.page;
        return next;
      });
    },
    onReceiveMessage: (msg) => {
      setMessages(prev => [...prev, msg]);
    },
    onReceiveReaction: ({ emoji, senderName }) => {
      // Spawn a floating emoji in the UI
      const id = Math.random().toString(36).substring(2, 9);
      const left = Math.random() * 60 + 20; // 20% to 80% width
      setFloatingEmojis(prev => [...prev, { id, emoji, senderName, left }]);

      // Clean up after 1.5s
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, 1500);
    },
    onHostChanged: (hostId) => {
      setRoomState(prev => ({ ...prev, hostId }));
    },
    onErrorMsg: (msg) => {
      setLobbyError(msg);
      setJoined(false);
    }
  });

  const {
    localStream,
    peerStreams,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare
  } = useWebRTC({
    socket,
    roomId,
    username: socketUsername,
    initialCamera,
    initialMic,
    videoDeviceId,
    audioDeviceId
  });

  // Keep track of microphone active status locally
  const [localCameraOn, setLocalCameraOn] = useState(initialCamera);
  const [localMicOn, setLocalMicOn] = useState(initialMic);

  // Sync state variables with toggles
  useEffect(() => {
    setLocalCameraOn(initialCamera);
    setLocalMicOn(initialMic);
  }, [initialCamera, initialMic]);

  // ----------------------------------------------------
  // Push to talk event listeners
  // ----------------------------------------------------
  useEffect(() => {
    if (!pushToTalk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpacePressed) {
        // Prevent default spacebar scroll behavior
        e.preventDefault();
        setIsSpacePressed(true);
        // Unmute microphone
        toggleMic(true);
        setLocalMicOn(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(false);
        // Mute microphone again
        toggleMic(false);
        setLocalMicOn(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pushToTalk, isSpacePressed]);

  // If push to talk is turned on, initially mute microphone
  useEffect(() => {
    if (pushToTalk) {
      toggleMic(false);
      setLocalMicOn(false);
    }
  }, [pushToTalk]);

  // Handle lobby submission
  const handleLobbySubmit = (data: { 
    username: string; 
    password?: string; 
    initialCamera: boolean; 
    initialMic: boolean; 
    videoDeviceId?: string; 
    audioDeviceId?: string; 
  }) => {
    setSocketUsername(data.username);
    setUsername(data.username);
    if (data.password) setPassword(data.password);
    setInitialCamera(data.initialCamera);
    setInitialMic(data.initialMic);
    if (data.videoDeviceId) setVideoDeviceId(data.videoDeviceId);
    if (data.audioDeviceId) setAudioDeviceId(data.audioDeviceId);
    
    // Changing socketUsername triggers connection effect in useSocket
    // useSocket's success callback (onRoomJoined) will set joined to true.
  };

  // Copy invitation link
  const copyInviteLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Media controller handler (called by MediaQueue)
  const handleSelectMedia = (url: string, type: string) => {
    const isHost = socket?.id === roomState.hostId;
    if (!isHost) return;

    emitPlaybackControl({
      url,
      type,
      time: 0,
      action: "pause",
      page: 1
    });
  };

  // Player controls handler (called by VideoPlayer)
  const handlePlaybackChange = (data: { action?: string; time?: number; url?: string; type?: string; page?: number }) => {
    emitPlaybackControl(data);
  };

  const handleToggleCamera = () => {
    const nextState = !localCameraOn;
    setLocalCameraOn(nextState);
    toggleCamera(nextState);
    emitToggleMediaState({ camera: nextState });
  };

  const handleToggleMic = () => {
    const nextState = !localMicOn;
    setLocalMicOn(nextState);
    toggleMic(nextState);
    emitToggleMediaState({ mic: nextState });
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // If lobby hasn't been completed, render the Lobby screen
  if (!joined) {
    return (
      <RoomLobby
        roomName={queryName}
        isPasswordProtected={queryIsPublic ? false : (queryPassword !== "")}
        onSubmit={handleLobbySubmit}
        error={lobbyError}
      />
    );
  }

  const isLocalHost = socket?.id === roomState.hostId;

  return (
    <div className="relative min-h-screen bg-[#030014] text-zinc-100 flex flex-col">
      {/* Background Glowing Orb */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* Floating Reactions Overlay (renders emojis floating upwards over the player area) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {floatingEmojis.map((e) => (
          <div
            key={e.id}
            className="floating-emoji"
            style={{
              left: `${e.left}%`,
              bottom: "20%"
            }}
          >
            <span className="text-sm font-semibold text-zinc-300 bg-black/60 px-2 py-0.5 rounded-full mr-2 pointer-events-none border border-white/5">
              {e.senderName}
            </span>
            {e.emoji}
          </div>
        ))}
      </div>

      {/* Header Panel */}
      <header className="w-full glass-panel border-b border-white/5 py-4 px-6 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2 truncate max-w-xs md:max-w-md">
              {queryName}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">Room ID: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Share/Invite Link */}
          <button
            onClick={copyInviteLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/15 active:scale-[0.98] transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link Copied!" : "Invite Friends"}
          </button>
          
          <div className="text-[10px] bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-zinc-400 font-medium shrink-0">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Live Sync
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                Connecting
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Room Layout Workspace */}
      <main className="flex-1 w-full max-w-8xl mx-auto px-6 py-6 grid lg:grid-cols-12 gap-6 relative z-10 min-h-0">
        
        {/* Left Area (70%): Synchronized player, video feeds, call controls */}
        <div className="lg:col-span-8 space-y-6 flex flex-col min-h-0">
          
          {/* Video Player Display Container */}
          <div className="w-full relative">
            {roomState.activeVideoUrl ? (
              <VideoPlayer
                url={roomState.activeVideoUrl}
                type={roomState.activeVideoType}
                playing={roomState.videoPlaying}
                time={roomState.videoTime}
                pdfPage={roomState.pdfPage}
                isHost={isLocalHost}
                onPlaybackChange={handlePlaybackChange}
              />
            ) : (
              <div className="w-full aspect-video rounded-2xl glass-card border border-white/5 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/40 relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute w-[300px] h-[300px] bg-indigo-500/5 blur-[80px] pointer-events-none" />
                <Radio className="w-10 h-10 text-indigo-400/80 mb-3 animate-pulse" />
                <h3 className="font-bold text-white text-sm">No Active Media Stream</h3>
                <p className="text-xs text-zinc-500 mt-1.5 max-w-sm">
                  {isLocalHost 
                    ? "Paste a link or upload a file using the media controller on the right to start watching."
                    : "Waiting for the room host to stream videos or presentations..."}
                </p>
              </div>
            )}
          </div>

          {/* Call Controls HUD Panel */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            
            {/* Primary camera & mic hardware toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleCamera}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                  localCameraOn
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/15"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                }`}
              >
                {localCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                Camera {localCameraOn ? "On" : "Off"}
              </button>
              <button
                onClick={handleToggleMic}
                disabled={pushToTalk}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  localMicOn
                    ? "bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/15"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                }`}
              >
                {localMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                Mic {localMicOn ? "On" : "Off"}
              </button>
            </div>

            {/* Premium feature toggles (Noise cancellation, Push-to-Talk, Screen Share) */}
            <div className="flex items-center gap-2">
              {/* Noise Cancellation */}
              <button
                onClick={() => setNoiseCancellation(!noiseCancellation)}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  noiseCancellation
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-white/2 border-white/5 text-zinc-500 hover:text-zinc-300"
                }`}
                title="Filter room noise using web audio API filters"
              >
                Noise Redux
              </button>

              {/* Push To Talk */}
              <button
                onClick={() => setPushToTalk(!pushToTalk)}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  pushToTalk
                    ? "bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse"
                    : "bg-white/2 border-white/5 text-zinc-500 hover:text-zinc-300"
                }`}
                title="Hold spacebar to talk, mute when released"
              >
                PTT Mode
              </button>

              {/* Screen Sharing Toggle */}
              <button
                onClick={handleToggleScreenShare}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                  isScreenSharing
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/15"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                }`}
              >
                <Share2 className="w-4 h-4" />
                {isScreenSharing ? "Stop Sharing" : "Share Screen"}
              </button>
            </div>
          </div>

          {/* PTT Active indicator */}
          {pushToTalk && (
            <div className={`p-3 rounded-xl border text-xs text-center flex items-center justify-center gap-2 transition-all ${
              isSpacePressed
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
                : "bg-zinc-900/60 border-white/5 text-zinc-500"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSpacePressed ? "bg-amber-400 animate-ping" : "bg-zinc-600"}`} />
              {isSpacePressed ? "PTT MICROPHONE UNMUTED - TALK NOW" : "HOLD [SPACEBAR] TO UNMUTE MICROPHONE AND TALK"}
            </div>
          )}

          {/* WebRTC Video Grid */}
          <div className="flex-1 min-h-0">
            <VideoGrid
              localStream={localStream}
              localUsername={username}
              localCamera={localCameraOn}
              localMic={localMicOn}
              peerStreams={peerStreams}
              hostSocketId={roomState.hostId}
              localSocketId={socket?.id || null}
            />
          </div>
        </div>

        {/* Right Area (30%): Media controller, chat list */}
        <div className="lg:col-span-4 space-y-6 flex flex-col min-h-0">
          {/* Media Queue controller */}
          <div className="shrink-0">
            <MediaQueue
              isHost={isLocalHost}
              onSelectMedia={handleSelectMedia}
            />
          </div>

          {/* Real-time Text chat & Reactions */}
          <div className="flex-1 min-h-0">
            <ChatContainer
              users={users}
              messages={messages}
              localSocketId={socket?.id || null}
              onSendMessage={emitSendMessage}
              onSendReaction={emitSendReaction}
              onClaimHost={emitClaimHost}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
