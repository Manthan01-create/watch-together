"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Smile, Paperclip, Crown, ShieldAlert, Sparkles, Download, FileText, Image as ImageIcon } from "lucide-react";
import confetti from "canvas-confetti";

interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt: string | Date;
}

interface ChatUser {
  socketId: string;
  username: string;
  isHost: boolean;
  camera: boolean;
  mic: boolean;
}

interface ChatContainerProps {
  users: ChatUser[];
  messages: ChatMessage[];
  localSocketId: string | null;
  onSendMessage: (content: string, fileUrl?: string, fileName?: string) => void;
  onSendReaction: (emoji: string) => void;
  onClaimHost: () => void;
}

export default function ChatContainer({
  users,
  messages,
  localSocketId,
  onSendMessage,
  onSendReaction,
  onClaimHost
}: ChatContainerProps) {
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  // Emojis list
  const quickReactions = ["❤️", "😂", "😮", "😢", "👍", "🎉"];

  const handleReactionClick = (emoji: string) => {
    onSendReaction(emoji);
    
    // Trigger local client side feedback
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#6366f1", "#06b6d4", "#a855f7", "#ec4899"]
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = reader.result as string;
        
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

        if (!response.ok) throw new Error("Upload failed");

        const result = await response.json();
        
        // Broadcast the file in chat
        onSendMessage(`Shared a file: ${file.name}`, `${socketUrl}${result.fileUrl}`, file.name);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const isImageFile = (name?: string | null) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp");
  };

  return (
    <div className="glass-card rounded-2xl border border-white/5 flex flex-col h-full overflow-hidden">
      
      {/* 1. Lobby User Count & Host claim */}
      <div className="p-4 border-b border-white/5 bg-zinc-950/40 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Room Users ({users.length})
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Active participants</p>
        </div>

        {/* Claim Host control if not already host */}
        {users.find(u => u.socketId === localSocketId)?.isHost ? (
          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Room Owner
          </span>
        ) : (
          <button
            onClick={onClaimHost}
            className="text-[9px] font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-full transition-all active:scale-95"
          >
            Claim Host controls
          </button>
        )}
      </div>

      {/* 2. Mini scrollable User list */}
      <div className="px-4 py-2 bg-zinc-950/20 border-b border-white/5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        {users.map(u => (
          <div
            key={u.socketId}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] ${
              u.isHost
                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold"
                : "bg-white/2 border border-white/5 text-zinc-400"
            }`}
          >
            {u.isHost && <Crown className="w-3 h-3 text-indigo-400 shrink-0" />}
            <span className="truncate max-w-[80px]">{u.username}</span>
            {u.socketId === localSocketId && <span className="text-[8px] opacity-60">(you)</span>}
          </div>
        ))}
      </div>

      {/* 3. Messages viewport */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Smile className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs">Chat is empty</p>
            <p className="text-[10px] opacity-60">Send a greeting message or click reaction emoji below!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isLocal = users.find(u => u.username === msg.senderName)?.socketId === localSocketId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isLocal ? "items-end" : "items-start"} max-w-[85%] ${
                  isLocal ? "ml-auto" : "mr-auto"
                }`}
              >
                <div className="flex items-center gap-1 text-[9px] text-zinc-500 mb-0.5 px-1.5">
                  <span className="font-semibold text-zinc-400">{msg.senderName}</span>
                  <span>•</span>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs shadow-sm leading-relaxed break-all ${
                    isLocal
                      ? "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-tr-none"
                      : "bg-white/5 border border-white/5 text-zinc-200 rounded-tl-none"
                  }`}
                >
                  {msg.content}

                  {/* Rendering shared file */}
                  {msg.fileUrl && (
                    <div className="mt-2.5 p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-3 text-[10px]">
                      <div className="flex items-center gap-2 truncate">
                        {isImageFile(msg.fileName) ? (
                          <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                        )}
                        <span className="truncate max-w-[130px] font-medium text-zinc-300">{msg.fileName}</span>
                      </div>
                      <a
                        href={msg.fileUrl}
                        download={msg.fileName || "download"}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Image render inside chat if it's an image */}
                  {msg.fileUrl && isImageFile(msg.fileName) && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-white/5 max-h-32">
                      <img src={msg.fileUrl} alt="Upload attachment" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Instant Reaction HUD */}
      <div className="px-4 py-2 border-t border-white/5 bg-zinc-950/20 flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Reactions</span>
        <div className="flex items-center gap-2">
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className="text-sm p-1 rounded hover:bg-white/10 hover:scale-125 transition-all duration-150 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Chat Text Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-zinc-950/40 flex gap-2 relative">
        {/* File attachment toggle */}
        <div className="relative">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="absolute inset-0 opacity-0 cursor-pointer w-9 h-9"
          />
          <button
            type="button"
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {isUploading ? (
              <div className="w-4 h-4 rounded-full border border-zinc-400 border-t-transparent animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl glass-input text-xs h-9"
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Inline Emoji Selector Modal */}
          {showEmojiPicker && (
            <div className="absolute right-0 bottom-12 p-3 rounded-2xl glass-card border border-white/10 grid grid-cols-6 gap-2 bg-zinc-950 z-50 shadow-2xl">
              {["😀", "😂", "🥰", "😎", "🤔", "😮", "😭", "👍", "👎", "👏", "🎉", "🔥"].map(emoji => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-lg p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
