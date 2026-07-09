"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, VideoOff, Pin, PinOff, LayoutGrid, Maximize2, User } from "lucide-react";

interface PeerStreamDetail {
  stream: MediaStream;
  username: string;
  camera: boolean;
  mic: boolean;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localUsername: string;
  localCamera: boolean;
  localMic: boolean;
  peerStreams: Record<string, PeerStreamDetail>;
  hostSocketId: string | null;
  localSocketId: string | null;
}

export default function VideoGrid({
  localStream,
  localUsername,
  localCamera,
  localMic,
  peerStreams,
  hostSocketId,
  localSocketId
}: VideoGridProps) {
  const [viewMode, setViewMode] = useState<"gallery" | "speaker">("gallery");
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // References for video elements to attach media stream objects
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localCamera]);

  const activePeers = Object.entries(peerStreams);

  // Dynamically render remote videos
  const RemoteVideo = ({ socketId, peer }: { socketId: string; peer: PeerStreamDetail }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      if (videoRef.current && peer.stream) {
        videoRef.current.srcObject = peer.stream;
      }
    }, [peer.stream]);

    const isHost = socketId === hostSocketId;

    return (
      <div className="relative aspect-video rounded-xl bg-zinc-950 border border-white/5 overflow-hidden flex items-center justify-center group">
        {peer.camera ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
              <User className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-[120px]">{peer.username}</p>
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white font-medium truncate max-w-[90px]">
              {peer.username}
            </span>
            {isHost && (
              <span className="text-[8px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                Host
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!peer.mic && (
              <div className="p-1 rounded bg-black/60 border border-white/10">
                <MicOff className="w-3 h-3 text-red-400" />
              </div>
            )}
            {!peer.camera && (
              <div className="p-1 rounded bg-black/60 border border-white/10">
                <VideoOff className="w-3 h-3 text-red-400" />
              </div>
            )}
          </div>
        </div>

        {/* Pin Control */}
        <button
          onClick={() => setPinnedId(pinnedId === socketId ? null : socketId)}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 border border-white/10 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {pinnedId === socketId ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  };

  const isLocalHost = localSocketId === hostSocketId;

  // Determine speaker stream layout
  const pinnedPeer = pinnedId && peerStreams[pinnedId] ? peerStreams[pinnedId] : null;

  return (
    <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-300">
            Calls Connected ({activePeers.length + 1})
          </span>
        </div>

        {/* Grid layout toggles */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setViewMode("gallery");
              setPinnedId(null);
            }}
            className={`p-1.5 rounded-lg border text-zinc-400 hover:text-white transition-all ${
              viewMode === "gallery"
                ? "bg-white/5 border-white/10 text-white"
                : "bg-transparent border-transparent"
            }`}
            title="Gallery View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("speaker")}
            className={`p-1.5 rounded-lg border text-zinc-400 hover:text-white transition-all ${
              viewMode === "speaker"
                ? "bg-white/5 border-white/10 text-white"
                : "bg-transparent border-transparent"
            }`}
            title="Speaker / Focus View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid layouts */}
      {viewMode === "gallery" || (!pinnedId && activePeers.length === 0) ? (
        /* ---------------- GALLERY VIEW ---------------- */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Local Feed */}
          <div className="relative aspect-video rounded-xl bg-zinc-950 border border-white/5 overflow-hidden flex items-center justify-center group">
            {localCamera ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
                  <User className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-400 truncate max-w-[120px]">You ({localUsername})</p>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white font-medium truncate max-w-[90px]">
                  You ({localUsername})
                </span>
                {isLocalHost && (
                  <span className="text-[8px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                    Host
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!localMic && (
                  <div className="p-1 rounded bg-black/60 border border-white/10">
                    <MicOff className="w-3 h-3 text-red-400" />
                  </div>
                )}
                {!localCamera && (
                  <div className="p-1 rounded bg-black/60 border border-white/10">
                    <VideoOff className="w-3 h-3 text-red-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Remote Feeds */}
          {activePeers.map(([id, peer]) => (
            <RemoteVideo key={id} socketId={id} peer={peer} />
          ))}
        </div>
      ) : (
        /* ---------------- SPEAKER / FOCUS VIEW ---------------- */
        <div className="flex flex-col xl:flex-row gap-3">
          {/* Main Focus Area (large size) */}
          <div className="flex-1">
            {pinnedId && pinnedPeer ? (
              <RemoteVideo socketId={pinnedId} peer={pinnedPeer} />
            ) : (
              /* Fallback to local if no pin */
              <div className="relative aspect-video rounded-xl bg-zinc-950 border border-white/5 overflow-hidden flex items-center justify-center group">
                {localCamera ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
                      <User className="w-8 h-8 text-zinc-500" />
                    </div>
                    <p className="text-sm text-zinc-400">You ({localUsername})</p>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between pointer-events-none">
                  <span className="text-xs text-white font-medium">You ({localUsername})</span>
                  <div className="flex items-center gap-1">
                    {!localMic && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    {!localCamera && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Row of small feeds */}
          <div className="w-full xl:w-64 flex xl:flex-col gap-3 overflow-x-auto xl:overflow-y-auto max-h-48 xl:max-h-none p-1">
            {/* If pinned stream is NOT local, show local as small stream */}
            {pinnedId !== null && (
              <div className="w-32 xl:w-full shrink-0 aspect-video rounded-xl bg-zinc-950 border border-white/5 overflow-hidden relative flex items-center justify-center group">
                {localCamera ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-1.5">
                    <p className="text-[10px] text-zinc-400 truncate max-w-[90px]">{localUsername}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-white truncate max-w-[70px]">{localUsername}</span>
                  {!localMic && <MicOff className="w-2.5 h-2.5 text-red-400" />}
                </div>
              </div>
            )}

            {/* Other peers small feeds */}
            {activePeers.map(([id, peer]) => {
              if (pinnedId === id) return null; // skip the pinned peer in small list
              return (
                <div key={id} className="w-32 xl:w-full shrink-0">
                  <RemoteVideo socketId={id} peer={peer} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
