"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketProps {
  roomId: string;
  username: string;
  password?: string;
  onRoomJoined?: (data: { roomState: any; users: any[]; messages: any[] }) => void;
  onUserConnected?: (user: any) => void;
  onUserDisconnected?: (socketId: string) => void;
  onUpdateUsers?: (users: any[]) => void;
  onPlaybackUpdated?: (data: any) => void;
  onReceiveMessage?: (message: any) => void;
  onReceiveReaction?: (data: { emoji: string; senderName: string }) => void;
  onHostChanged?: (hostId: string) => void;
  onErrorMsg?: (msg: string) => void;
}

export function useSocket({
  roomId,
  username,
  password,
  onRoomJoined,
  onUserConnected,
  onUserDisconnected,
  onUpdateUsers,
  onPlaybackUpdated,
  onReceiveMessage,
  onReceiveReaction,
  onHostChanged,
  onErrorMsg
}: UseSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server running on port 3001
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const newSocket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to socket server");
      // Join Room
      newSocket.emit("join-room", { roomId, username, password });
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from socket server");
    });

    // Listeners
    if (onRoomJoined) newSocket.on("room-joined", onRoomJoined);
    if (onUserConnected) newSocket.on("user-connected", onUserConnected);
    if (onUserDisconnected) newSocket.on("user-disconnected", onUserDisconnected);
    if (onUpdateUsers) newSocket.on("update-users", onUpdateUsers);
    if (onPlaybackUpdated) newSocket.on("playback-updated", onPlaybackUpdated);
    if (onReceiveMessage) newSocket.on("receive-message", onReceiveMessage);
    if (onReceiveReaction) newSocket.on("receive-reaction", onReceiveReaction);
    if (onHostChanged) newSocket.on("host-changed", onHostChanged);
    if (onErrorMsg) newSocket.on("error-msg", onErrorMsg);

    return () => {
      if (newSocket) {
        newSocket.off("connect");
        newSocket.off("disconnect");
        newSocket.off("room-joined");
        newSocket.off("user-connected");
        newSocket.off("user-disconnected");
        newSocket.off("update-users");
        newSocket.off("playback-updated");
        newSocket.off("receive-message");
        newSocket.off("receive-reaction");
        newSocket.off("host-changed");
        newSocket.off("error-msg");
        newSocket.disconnect();
      }
    };
  }, [roomId, username, password]);

  // Emitters
  const emitPlaybackControl = (data: { action?: string; time?: number; url?: string; type?: string; page?: number }) => {
    if (socketRef.current) {
      socketRef.current.emit("playback-control", { roomId, ...data });
    }
  };

  const emitClaimHost = () => {
    if (socketRef.current) {
      socketRef.current.emit("claim-host", { roomId });
    }
  };

  const emitSendMessage = (content: string, fileUrl?: string, fileName?: string) => {
    if (socketRef.current) {
      socketRef.current.emit("send-message", {
        roomId,
        senderName: username,
        content,
        fileUrl,
        fileName
      });
    }
  };

  const emitSendReaction = (emoji: string) => {
    if (socketRef.current) {
      socketRef.current.emit("send-reaction", {
        roomId,
        emoji,
        senderName: username
      });
    }
  };

  const emitToggleMediaState = (data: { camera?: boolean; mic?: boolean }) => {
    if (socketRef.current) {
      socketRef.current.emit("toggle-media-state", { roomId, ...data });
    }
  };

  return {
    socket,
    isConnected,
    emitPlaybackControl,
    emitClaimHost,
    emitSendMessage,
    emitSendReaction,
    emitToggleMediaState
  };
}
