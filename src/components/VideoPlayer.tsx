"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Settings, FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface VideoPlayerProps {
  url: string;
  type: string; // youtube, vimeo, file, live, audio, pdf
  playing: boolean;
  time: number;
  pdfPage: number;
  isHost: boolean;
  onPlaybackChange: (data: { action?: string; time?: number; url?: string; type?: string; page?: number }) => void;
}

export default function VideoPlayer({
  url,
  type,
  playing,
  time,
  pdfPage,
  isHost,
  onPlaybackChange
}: VideoPlayerProps) {
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Player DOM refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Synchronization guard refs to prevent infinite loopbacks
  const ignoreEventsRef = useRef(false);

  // Helper: Extract YouTube ID
  const getYoutubeId = (urlStr: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlStr.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Helper: Extract Vimeo ID
  const getVimeoId = (urlStr: string) => {
    const regExp = /vimeo\.com\/(?:video\/)?([0-9]+)/;
    const match = urlStr.match(regExp);
    return match ? match[1] : null;
  };

  // ----------------------------------------------------
  // YouTube API Script Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (type === "youtube" && !(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [type]);

  // Initialize YouTube Player
  useEffect(() => {
    if (type !== "youtube" || !url) return;

    let ytPlayer: any = null;
    const ytId = getYoutubeId(url);
    if (!ytId) return;

    const initYT = () => {
      ytPlayer = new (window as any).YT.Player("youtube-player-element", {
        videoId: ytId,
        playerVars: {
          autoplay: playing ? 1 : 0,
          controls: isHost ? 1 : 0, // only show native controls to host if desired, but we can sync anyway
          disablekb: isHost ? 0 : 1,
          rel: 0,
          showinfo: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event: any) => {
            ytPlayerRef.current = event.target;
            event.target.setVolume(muted ? 0 : volume * 100);
            setIsReady(true);
            
            // Sync initial state
            event.target.seekTo(time, true);
            if (playing) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            if (!isHost || ignoreEventsRef.current) return;
            
            // YT States: 1 = Playing, 2 = Paused, 3 = Buffering
            const state = event.data;
            const t = event.target.getCurrentTime();
            
            if (state === (window as any).YT.PlayerState.PLAYING) {
              onPlaybackChange({ action: "play", time: t });
            } else if (state === (window as any).YT.PlayerState.PAUSED) {
              onPlaybackChange({ action: "pause", time: t });
            }
          }
        }
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initYT();
    } else {
      // Global callback called by YT script when ready
      (window as any).onYouTubeIframeAPIReady = () => {
        initYT();
      };
    }

    return () => {
      if (ytPlayer) {
        try {
          ytPlayer.destroy();
        } catch (e) {}
        ytPlayerRef.current = null;
      }
    };
  }, [type, url]);

  // ----------------------------------------------------
  // HTML5 Video & HLS Live Streams Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (type !== "file" && type !== "live" && type !== "audio") return;
    const video = videoRef.current;
    if (!video) return;

    setIsReady(false);

    // Reset HLS if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (type === "live" || url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsReady(true);
          video.volume = muted ? 0 : volume;
          if (playing) video.play().catch(() => {});
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        setIsReady(true);
      }
    } else {
      video.src = url;
      setIsReady(true);
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [type, url]);

  // ----------------------------------------------------
  // Synchronizing incoming state from room
  // ----------------------------------------------------
  useEffect(() => {
    ignoreEventsRef.current = true;

    if (type === "youtube" && ytPlayerRef.current) {
      try {
        const ytPlayer = ytPlayerRef.current;
        const currentYtTime = ytPlayer.getCurrentTime();
        
        // Synchronize play/pause
        if (playing) {
          if (ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo();
        } else {
          if (ytPlayer.getPlayerState() !== 2) ytPlayer.pauseVideo();
        }

        // Seek sync (threshold of 2 seconds drift)
        if (Math.abs(currentYtTime - time) > 2) {
          ytPlayer.seekTo(time, true);
        }
      } catch (err) {}
    } 
    else if ((type === "file" || type === "live" || type === "audio") && videoRef.current) {
      try {
        const video = videoRef.current;
        
        if (playing) {
          if (video.paused) video.play().catch(() => {});
        } else {
          if (!video.paused) video.pause();
        }

        if (Math.abs(video.currentTime - time) > 2) {
          video.currentTime = time;
        }
      } catch (err) {}
    }

    setTimeout(() => {
      ignoreEventsRef.current = false;
    }, 200);

  }, [playing, time, type, url]);

  // ----------------------------------------------------
  // User Actions (Host Controls)
  // ----------------------------------------------------
  const togglePlay = () => {
    if (!isHost) return;

    if (type === "youtube" && ytPlayerRef.current) {
      const state = ytPlayerRef.current.getPlayerState();
      const t = ytPlayerRef.current.getCurrentTime();
      if (state === 1) {
        onPlaybackChange({ action: "pause", time: t });
      } else {
        onPlaybackChange({ action: "play", time: t });
      }
    } 
    else if ((type === "file" || type === "live" || type === "audio") && videoRef.current) {
      const video = videoRef.current;
      const t = video.currentTime;
      if (video.paused) {
        onPlaybackChange({ action: "play", time: t });
      } else {
        onPlaybackChange({ action: "pause", time: t });
      }
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
  };

  const handleSeekEnd = (e: React.MouseEvent | React.TouchEvent | React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const val = parseFloat(target.value);
    if (isHost) {
      onPlaybackChange({ action: playing ? "play" : "pause", time: val });
    }
    setIsSeeking(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setMuted(val === 0);

    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(val * 100);
      if (val === 0) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    }
  };

  const toggleMute = () => {
    const newMute = !muted;
    setMuted(newMute);
    if (videoRef.current) {
      videoRef.current.muted = newMute;
    }
    if (ytPlayerRef.current) {
      if (newMute) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    }
  };

  // PDF Page change
  const changePdfPage = (dir: "prev" | "next") => {
    if (!isHost) return;
    const newPage = dir === "next" ? pdfPage + 1 : Math.max(1, pdfPage - 1);
    onPlaybackChange({ page: newPage });
  };

  const handleFullscreen = () => {
    const el = videoRef.current || document.getElementById("player-container");
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen().catch(() => {});
      }
    }
  };

  // ----------------------------------------------------
  // Renderers
  // ----------------------------------------------------
  if (type === "pdf") {
    return (
      <div id="player-container" className="w-full aspect-video rounded-2xl glass-card border border-white/10 flex flex-col items-center justify-between p-6 bg-zinc-950 relative overflow-hidden">
        {/* Glowing aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none" />

        <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Active Presentation / PDF</h3>
              <p className="text-xs text-zinc-500 truncate max-w-md">{url}</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold tracking-wider uppercase">
            Document View
          </span>
        </div>

        {/* PDF Document Frame */}
        <div className="flex-1 w-full bg-zinc-900/60 rounded-xl border border-white/5 my-4 overflow-hidden relative z-10 flex items-center justify-center">
          <iframe
            src={`${url}#page=${pdfPage}`}
            className="w-full h-full border-0"
            title="PDF Presentation"
          />
        </div>

        {/* Sync Controls */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-white/5 relative z-10">
          <div className="text-sm text-zinc-400 font-medium">
            Page <span className="text-white font-bold">{pdfPage}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => changePdfPage("prev")}
              disabled={!isHost || pdfPage <= 1}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => changePdfPage("next")}
              disabled={!isHost}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {isHost ? "✦ You Control Flipping" : "Waiting for host"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="player-container" className="w-full aspect-video rounded-2xl glass-card border border-white/10 bg-black overflow-hidden relative group">
      
      {/* 1. YouTube container */}
      {type === "youtube" && (
        <div className="w-full h-full">
          <div id="youtube-player-element" className="w-full h-full pointer-events-auto" />
        </div>
      )}

      {/* 2. Vimeo container */}
      {type === "vimeo" && (
        <div className="w-full h-full">
          <iframe
            src={`https://player.vimeo.com/video/${getVimeoId(url)}?autoplay=${playing ? 1 : 0}&muted=${muted ? 1 : 0}&background=0&controls=${isHost ? 1 : 0}`}
            className="w-full h-full"
            allow="autoplay; fullscreen"
            title="Vimeo Player"
          />
        </div>
      )}

      {/* 3. HTML5 File / Live Stream / Audio Container */}
      {(type === "file" || type === "live" || type === "audio") && (
        <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
          <video
            ref={videoRef}
            playsInline
            onClick={togglePlay}
            className={`w-full h-full ${type === "audio" ? "h-24 max-h-24" : "object-contain"}`}
          />

          {/* Direct Audio Graphic Visualizer Simulation */}
          {type === "audio" && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-20 pointer-events-none">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-gradient-to-t from-indigo-500 to-cyan-500"
                  style={{
                    height: playing ? `${Math.random() * 80 + 20}%` : '20%',
                    transition: 'height 0.15s ease-in-out'
                  }}
                />
              ))}
            </div>
          )}

          {/* Custom Controls HUD overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {/* Playback Seek slider (only interactable if host) */}
            {type !== "live" && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(currentTime * 1000).toISOString().substr(14, 5)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  disabled={!isHost}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  className="flex-1 accent-indigo-500 h-1.5 rounded-lg bg-white/20 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(duration * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
            )}

            {/* Bottom HUD buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  disabled={!isHost}
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                </button>

                {/* Volume slider */}
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 rounded-lg bg-white/25 accent-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Center status */}
              {type === "live" && (
                <div className="flex items-center gap-2 text-red-500 px-2 py-0.5 bg-red-500/10 border border-red-500/25 rounded-md text-[10px] uppercase font-bold tracking-widest animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Live Sync
                </div>
              )}

              {/* Right buttons */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest bg-white/5 px-2 py-1 rounded border border-white/5 font-semibold">
                  {isHost ? "Host Control" : "Viewer Sync"}
                </span>
                <button onClick={handleFullscreen} className="text-zinc-400 hover:text-white transition-colors">
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
