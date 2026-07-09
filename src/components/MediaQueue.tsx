"use client";

import { useState } from "react";
import { Link2, Upload, Tv, FileText, Music, Sparkles } from "lucide-react";

interface MediaQueueProps {
  isHost: boolean;
  onSelectMedia: (url: string, type: string) => void;
}

export default function MediaQueue({ isHost, onSelectMedia }: MediaQueueProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    let detectedType = "file";
    const url = inputUrl.trim();

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      detectedType = "youtube";
    } else if (url.includes("vimeo.com")) {
      detectedType = "vimeo";
    } else if (url.endsWith(".m3u8") || url.includes("/hls/") || url.includes(".live")) {
      detectedType = "live";
    } else if (url.endsWith(".mp3") || url.endsWith(".ogg") || url.endsWith(".wav") || url.endsWith(".aac")) {
      detectedType = "audio";
    } else if (url.endsWith(".pdf") || url.includes("/pdf/") || url.includes("/docs/")) {
      detectedType = "pdf";
    }

    onSelectMedia(url, detectedType);
    setInputUrl("");
  };

  // Local file upload handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Reading file...");

    try {
      const reader = new FileReader();
      
      reader.onload = async () => {
        const fileData = reader.result as string;
        setUploadProgress("Uploading to local server...");

        // Post to our custom Node/Express socket-server upload API (on port 3001)
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
        const response = await fetch(`${socketUrl}/api/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileName: file.name,
            fileData: fileData
          })
        });

        if (!response.ok) {
          throw new Error("Server upload failed");
        }

        const result = await response.json();
        
        // Auto-detect type from file name
        let fileType = "file";
        if (file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav")) {
          fileType = "audio";
        } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          fileType = "pdf";
        }

        // Selected upload URL is a relative path like `/uploads/12345-video.mp4`
        // We prepend the Socket.IO server host so all clients fetch it from there!
        const fullUploadedUrl = `${socketUrl}${result.fileUrl}`;
        
        onSelectMedia(fullUploadedUrl, fileType);
        setIsUploading(false);
        setUploadProgress("");
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setUploadProgress(`Upload failed: ${err.message}`);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress("");
      }, 3000);
    }
  };

  // Test suggestion clicks
  const playSuggestion = (url: string, type: string) => {
    if (!isHost) return;
    onSelectMedia(url, type);
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-5">
      <div>
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Queue & Media Controller
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          {isHost ? "Enter links or upload files to update media for the room." : "Only hosts can modify room media."}
        </p>
      </div>

      {isHost ? (
        <div className="space-y-4">
          {/* Submit Link */}
          <form onSubmit={handleLinkSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Paste YouTube, Vimeo, HLS or file URL..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-xs"
              />
              <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition-colors shrink-0"
            >
              Play
            </button>
          </form>

          {/* Upload File */}
          <div className="relative border border-dashed border-white/10 hover:border-white/20 transition-all rounded-xl p-4 text-center cursor-pointer">
            <input
              type="file"
              accept="video/*,audio/*,application/pdf"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            {isUploading ? (
              <div className="space-y-2">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
                <p className="text-[10px] text-indigo-400 font-semibold">{uploadProgress}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5 text-indigo-400" />
                <p className="text-[10px] font-semibold text-zinc-300">Upload Local Media File</p>
                <p className="text-[9px] text-zinc-500">Supports Videos, Audios, and PDF Presentations</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/2 border border-white/5 text-center text-xs text-zinc-500">
          Waiting for room host to select media source...
        </div>
      )}

      {/* Suggested testing links */}
      <div className="space-y-2.5 pt-1 border-t border-white/5">
        <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Test Suggestions</h4>
        <div className="grid grid-cols-2 gap-2 text-left">
          <button
            onClick={() => playSuggestion("https://www.youtube.com/watch?v=aqz-KE-bpKQ", "youtube")}
            disabled={!isHost}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/2 border border-white/5 hover:bg-white/5 text-xs text-zinc-300 disabled:opacity-40"
          >
            <Tv className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-white block text-[10px]">YouTube Demo</span>
              <span className="text-[9px] text-zinc-500 block truncate">Big Buck Bunny</span>
            </div>
          </button>
          <button
            onClick={() => playSuggestion("https://test-streams.mux.dev/x36xhg/main.m3u8", "live")}
            disabled={!isHost}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/2 border border-white/5 hover:bg-white/5 text-xs text-zinc-300 disabled:opacity-40"
          >
            <Tv className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-white block text-[10px]">Live HLS Demo</span>
              <span className="text-[9px] text-zinc-500 block truncate">Mux Stream</span>
            </div>
          </button>
          <button
            onClick={() => playSuggestion("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "audio")}
            disabled={!isHost}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/2 border border-white/5 hover:bg-white/5 text-xs text-zinc-300 disabled:opacity-40"
          >
            <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-white block text-[10px]">Audio Demo</span>
              <span className="text-[9px] text-zinc-500 block truncate">SoundHelix MP3</span>
            </div>
          </button>
          <button
            onClick={() => playSuggestion("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "pdf")}
            disabled={!isHost}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/2 border border-white/5 hover:bg-white/5 text-xs text-zinc-300 disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-white block text-[10px]">PDF Demo</span>
              <span className="text-[9px] text-zinc-500 block truncate">Sample PDF document</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
