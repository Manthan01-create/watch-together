"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tv, Video, Users, Share2, Plus, ArrowRight, Lock, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  
  // Create Room state
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Join Room state
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsCreating(true);
    try {
      // We generate a random room UUID on the client side
      const roomId = crypto.randomUUID();
      
      // We can pre-register/create the room in the database using a simple fetch/API call,
      // or we can let the Socket.IO connection handle room creation on connection.
      // Doing it via Socket.IO connection is standard and doesn't block room joining,
      // but let's make an API call to save room configuration in the DB first for security/verification.
      // Wait, let's create a Next.js api route, or we can just let it create via a POST to our socket-server!
      // Since our socket-server runs on port 3001, we can make an API request to `http://localhost:3001/api/upload`
      // or we can define a room creation API in Next.js.
      // Wait! Let's write an API route in Next.js for room creation.
      // Even simpler: since the room is created on socket join, we can just navigate to `/room/${roomId}?name=${encodeURIComponent(roomName)}&isPublic=${isPublic}&password=${encodeURIComponent(password)}`!
      // That is extremely simple, client-driven, and robust.
      // Wait, if a password is set, we pass it in query parameters or hash it first. Let's do it in query parameters or pass it along, and inside the Room page, we connect via socket and it stores it in the DB.
      
      router.push(`/room/${roomId}?name=${encodeURIComponent(roomName)}&isPublic=${isPublic}&pw=${encodeURIComponent(password)}`);
    } catch (error) {
      console.error(error);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    // Clean up room code from URL if they pasted a full link
    let cleanRoomId = joinRoomId.trim();
    if (cleanRoomId.includes("/room/")) {
      cleanRoomId = cleanRoomId.split("/room/")[1].split("?")[0];
    }

    router.push(`/room/${cleanRoomId}${joinPassword ? `?pw=${encodeURIComponent(joinPassword)}` : ""}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#030014] text-zinc-100 overflow-hidden">
      {/* Background Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
            <Tv className="w-5 h-5 text-white" />
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#030014] animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Together
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-medium">
            v1.0.0 Stable
          </span>
        </div>
      </header>

      {/* Hero & Lobby Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Marketing & Info */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            Next-Gen Synchronized Sharing
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white"
          >
            Watch, share, and talk <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              together in real-time.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-xl leading-relaxed"
          >
            Allowing you and your friends to watch synchronized videos (YouTube, Vimeo, HLS, direct files), make high-fidelity voice/video calls, share screens, and chat—all fully secure and running directly inside your browser.
          </motion.p>

          {/* Core Feature Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid sm:grid-cols-2 gap-4 pt-4 max-w-lg"
          >
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/2 border border-white/5">
              <Tv className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white">Playback Sync</h3>
                <p className="text-xs text-zinc-400 mt-1">Play, pause, seek, and swap media synchronized to the millisecond.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/2 border border-white/5">
              <Video className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white">HD Video Calls</h3>
                <p className="text-xs text-zinc-400 mt-1">Built-in WebRTC mesh calls with gallery view and push-to-talk.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/2 border border-white/5">
              <Share2 className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white">Screen Sharing</h3>
                <p className="text-xs text-zinc-400 mt-1">Share your browser tab, window, or entire screen alongside the player.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/2 border border-white/5">
              <Users className="w-6 h-6 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-white">Private Rooms</h3>
                <p className="text-xs text-zinc-400 mt-1">Password protection, host delegation, and private invites.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Interactive Lobby / Join form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-5 w-full glass-card rounded-3xl p-8 relative"
        >
          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 border border-white/5 mb-6">
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "create"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => setActiveTab("join")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "join"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Join Room
            </button>
          </div>

          {/* Create Room Form */}
          {activeTab === "create" ? (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Movie Night, Chill Zone"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Password <span className="text-zinc-600">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Require password to enter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm pr-10"
                  />
                  <Lock className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/2 border border-white/5">
                <div className="flex items-center gap-2">
                  {isPublic ? (
                    <Globe className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-purple-400" />
                  )}
                  <span className="text-xs font-medium text-white">
                    {isPublic ? "Public Room" : "Private (Invite-Only)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isPublic ? "bg-indigo-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isPublic ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Watch Room"}
                <Plus className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Join Room Form */
            <form onSubmit={handleJoinRoom} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Room Link / Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste link or type room code"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Room Password <span className="text-zinc-600">(If required)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm pr-10"
                  />
                  <Lock className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
              >
                Join Watch Room
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 text-center text-xs text-zinc-500 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© 2026 Together Inc. Developed for cross-device high fidelity sync.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}
