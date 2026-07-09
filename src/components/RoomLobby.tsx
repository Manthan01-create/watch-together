"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, Settings, Volume2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface RoomLobbyProps {
  roomName: string;
  isPasswordProtected: boolean;
  onSubmit: (data: { username: string; password?: string; initialCamera: boolean; initialMic: boolean; videoDeviceId?: string; audioDeviceId?: string }) => void;
  error?: string;
}

export default function RoomLobby({ roomName, isPasswordProtected, onSubmit, error }: RoomLobbyProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  
  // Media devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedAudioId, setSelectedAudioId] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Load available devices
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const video = devices.filter(d => d.kind === "videoinput");
        const audio = devices.filter(d => d.kind === "audioinput");
        
        setVideoDevices(video);
        setAudioDevices(audio);
        
        if (video.length > 0) setSelectedVideoId(video[0].deviceId);
        if (audio.length > 0) setSelectedAudioId(audio[0].deviceId);
      } catch (err) {
        console.error("Error listing devices:", err);
      }
    }
    getDevices();
  }, []);

  // Sync camera toggle
  useEffect(() => {
    let active = true;

    async function startCamera() {
      // Stop old stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (cameraOn && active) {
        try {
          const constraints: MediaStreamConstraints = {
            video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
            audio: false // handle audio separately or mock
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          localStreamRef.current = stream;
          if (localVideoRef.current && active) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error opening camera:", err);
          setCameraOn(false);
        }
      } else {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOn, selectedVideoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    onSubmit({
      username,
      password: isPasswordProtected ? password : undefined,
      initialCamera: cameraOn,
      initialMic: micOn,
      videoDeviceId: selectedVideoId,
      audioDeviceId: selectedAudioId
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#030014] text-zinc-100 p-6">
      {/* Background Glowing Orb */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl glass-card rounded-3xl overflow-hidden grid md:grid-cols-12"
      >
        {/* Left pane: Camera preview (7 cols) */}
        <div className="md:col-span-7 bg-black/40 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 relative min-h-[300px] md:min-h-[450px]">
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Lobby Setup</h2>
            <h1 className="text-xl font-bold text-white mt-1 truncate max-w-full">
              Joining: <span className="text-indigo-400">{roomName}</span>
            </h1>
          </div>

          {/* Video Area */}
          <div className="relative flex-1 my-4 rounded-2xl bg-zinc-950 border border-white/5 overflow-hidden flex items-center justify-center">
            {cameraOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <VideoOff className="w-8 h-8 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400 font-medium">Camera is turned off</p>
                <p className="text-xs text-zinc-600 mt-1">People in the room won't see you</p>
              </div>
            )}

            {/* Quick overlay controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10">
              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  cameraOn 
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white" 
                    : "bg-white/10 hover:bg-white/20 text-zinc-300"
                }`}
              >
                {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  micOn 
                    ? "bg-purple-500 hover:bg-purple-600 text-white" 
                    : "bg-white/10 hover:bg-white/20 text-zinc-300"
                }`}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Quick Hardware Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Camera Source</label>
              <select
                disabled={videoDevices.length === 0}
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full text-xs bg-white/5 border border-white/10 text-zinc-300 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
              >
                {videoDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">{d.label || `Camera ${d.deviceId.substring(0, 4)}`}</option>
                ))}
                {videoDevices.length === 0 && <option className="bg-zinc-900">No Cameras Found</option>}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Microphone Source</label>
              <select
                disabled={audioDevices.length === 0}
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="w-full text-xs bg-white/5 border border-white/10 text-zinc-300 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
              >
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">{d.label || `Microphone ${d.deviceId.substring(0, 4)}`}</option>
                ))}
                {audioDevices.length === 0 && <option className="bg-zinc-900">No Microphones Found</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Right pane: Setup inputs (5 cols) */}
        <form onSubmit={handleSubmit} className="md:col-span-5 p-8 flex flex-col justify-between h-full space-y-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Join Meeting</h3>
              <p className="text-xs text-zinc-400 mt-1">Configure your screen name and password before entering the room.</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Display Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="What should we call you?"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              {isPasswordProtected && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Room Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter room password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all"
            >
              Enter Watch Together
            </button>
            <p className="text-[10px] text-zinc-500 text-center">
              By joining, you agree to enable peer-to-peer audio and video transmission.
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
