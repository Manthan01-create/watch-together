"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket | null;
  roomId: string;
  username: string;
  initialCamera: boolean;
  initialMic: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
}

export function useWebRTC({
  socket,
  roomId,
  username,
  initialCamera,
  initialMic,
  videoDeviceId,
  audioDeviceId
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peerStreams, setPeerStreams] = useState<Record<string, { stream: MediaStream; username: string; camera: boolean; mic: boolean }>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const usersRef = useRef<any[]>([]); // list of other users in the room

  // Ice servers list
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ];

  // ----------------------------------------------------
  // 1. Initialize Local Stream
  // ----------------------------------------------------
  useEffect(() => {
    let active = true;

    async function initLocalStream() {
      try {
        const constraints: MediaStreamConstraints = {
          video: initialCamera ? (videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true) : false,
          audio: initialMic ? (audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true) : false
        };

        let stream: MediaStream;
        if (initialCamera || initialMic) {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
          // If both are off, create an empty media stream so we can still pass a stream ref
          stream = new MediaStream();
        }

        if (active) {
          localStreamRef.current = stream;
          setLocalStream(stream);

          // Update socket state
          if (socket) {
            socket.emit("toggle-media-state", {
              roomId,
              camera: initialCamera,
              mic: initialMic
            });
          }
        }
      } catch (err) {
        console.error("Failed to get local media stream:", err);
      }
    }

    initLocalStream();

    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, roomId, videoDeviceId, audioDeviceId]);

  // ----------------------------------------------------
  // 2. Peer Connections & Signaling Loop
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket || !localStream) return;

    // A. Connect to existing peers (We initiate the call to everyone currently in the room)
    const handleUpdateUsers = (usersList: any[]) => {
      usersRef.current = usersList;
      
      // Update camera/mic status of peers
      setPeerStreams(prev => {
        const next = { ...prev };
        usersList.forEach(user => {
          if (user.socketId !== socket.id && next[user.socketId]) {
            next[user.socketId].camera = user.camera;
            next[user.socketId].mic = user.mic;
            next[user.socketId].username = user.username;
          }
        });
        return next;
      });

      usersList.forEach(async (user) => {
        // If the user is not ourselves and we don't have a peer connection for them yet
        if (user.socketId !== socket.id && !peersRef.current[user.socketId]) {
          console.log(`Initiating WebRTC connection to: ${user.socketId}`);
          await createPeerConnection(user.socketId, user.username, true);
        }
      });
    };

    // B. Handle incoming signals
    const handleSignal = async ({ senderSocketId, signalData }: any) => {
      let peerConnection = peersRef.current[senderSocketId];

      if (!peerConnection) {
        // Find user username
        const peerUser = usersRef.current.find(u => u.socketId === senderSocketId);
        const peerName = peerUser ? peerUser.username : "Peer";
        peerConnection = await createPeerConnection(senderSocketId, peerName, false);
      }

      if (signalData.sdp) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          if (signalData.sdp.type === "offer") {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit("signal", {
              targetSocketId: senderSocketId,
              signalData: { sdp: peerConnection.localDescription }
            });
          }
        } catch (err) {
          console.error("Error setting session description:", err);
        }
      } else if (signalData.iceCandidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.iceCandidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      }
    };

    // C. Clean up disconnected user peer connections
    const handleUserDisconnected = (disconnectedSocketId: string) => {
      console.log(`Cleaning up WebRTC peer: ${disconnectedSocketId}`);
      if (peersRef.current[disconnectedSocketId]) {
        peersRef.current[disconnectedSocketId].close();
        delete peersRef.current[disconnectedSocketId];
      }
      setPeerStreams(prev => {
        const next = { ...prev };
        delete next[disconnectedSocketId];
        return next;
      });
    };

    // Socket Event bindings
    socket.on("update-users", handleUpdateUsers);
    socket.on("signal", handleSignal);
    socket.on("user-disconnected", handleUserDisconnected);

    return () => {
      socket.off("update-users", handleUpdateUsers);
      socket.off("signal", handleSignal);
      socket.off("user-disconnected", handleUserDisconnected);
    };
  }, [socket, localStream]);

  // Create Peer Connection helper
  const createPeerConnection = async (peerSocketId: string, peerUsername: string, isOfferInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers });
    peersRef.current[peerSocketId] = pc;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    // ICE Candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("signal", {
          targetSocketId: peerSocketId,
          signalData: { iceCandidate: event.candidate }
        });
      }
    };

    // Handle remote media track arrival
    pc.ontrack = (event) => {
      console.log(`Received remote track from peer: ${peerSocketId}`);
      const remoteStream = event.streams[0];

      setPeerStreams(prev => {
        const peerDetails = usersRef.current.find(u => u.socketId === peerSocketId) || { camera: false, mic: false };
        return {
          ...prev,
          [peerSocketId]: {
            stream: remoteStream,
            username: peerUsername,
            camera: peerDetails.camera,
            mic: peerDetails.mic
          }
        };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        delete peersRef.current[peerSocketId];
        setPeerStreams(prev => {
          const next = { ...prev };
          delete next[peerSocketId];
          return next;
        });
      }
    };

    // Create Offer if Initiator
    if (isOfferInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket) {
          socket.emit("signal", {
            targetSocketId: peerSocketId,
            signalData: { sdp: pc.localDescription }
          });
        }
      } catch (err) {
        console.error("Error creating RTC offer:", err);
      }
    }

    return pc;
  };

  // ----------------------------------------------------
  // 3. User Controls API (Mute, Camera toggles, Screen share)
  // ----------------------------------------------------
  const toggleCamera = async (forceState?: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    let videoTrack = stream.getVideoTracks()[0];
    const newState = forceState !== undefined ? forceState : !videoTrack?.enabled;

    if (newState && !videoTrack) {
      // If we previously had no camera track (initialized with cameraOff), fetch track now
      try {
        const freshStream = await navigator.mediaDevices.getUserMedia({ video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true });
        const freshTrack = freshStream.getVideoTracks()[0];
        stream.addTrack(freshTrack);
        
        // Add fresh track to all active peer connections
        Object.values(peersRef.current).forEach(pc => {
          pc.addTrack(freshTrack, stream);
          // renegotiate
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            if (socket) {
              const targetId = Object.keys(peersRef.current).find(key => peersRef.current[key] === pc);
              if (targetId) socket.emit("signal", { targetSocketId: targetId, signalData: { sdp: pc.localDescription } });
            }
          });
        });

        videoTrack = freshTrack;
      } catch (err) {
        console.error("Failed to add camera track:", err);
        return;
      }
    }

    if (videoTrack) {
      videoTrack.enabled = newState;
    }

    // Trigger state changes
    setLocalStream(new MediaStream(stream.getTracks()));
    if (socket) {
      socket.emit("toggle-media-state", { roomId, camera: newState });
    }
  };

  const toggleMic = async (forceState?: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    let audioTrack = stream.getAudioTracks()[0];
    const newState = forceState !== undefined ? forceState : !audioTrack?.enabled;

    if (newState && !audioTrack) {
      try {
        const freshStream = await navigator.mediaDevices.getUserMedia({ audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true });
        const freshTrack = freshStream.getAudioTracks()[0];
        stream.addTrack(freshTrack);

        Object.values(peersRef.current).forEach(pc => {
          pc.addTrack(freshTrack, stream);
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            if (socket) {
              const targetId = Object.keys(peersRef.current).find(key => peersRef.current[key] === pc);
              if (targetId) socket.emit("signal", { targetSocketId: targetId, signalData: { sdp: pc.localDescription } });
            }
          });
        });

        audioTrack = freshTrack;
      } catch (err) {
        console.error("Failed to add microphone track:", err);
        return;
      }
    }

    if (audioTrack) {
      audioTrack.enabled = newState;
    }

    setLocalStream(new MediaStream(stream.getTracks()));
    if (socket) {
      socket.emit("toggle-media-state", { roomId, mic: newState });
    }
  };

  const startScreenShare = async () => {
    if (isScreenSharing) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      // Replace camera video track in all active peer connections
      Object.values(peersRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === "video");
        if (videoSender && screenTrack) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      // Handle user stopping screen share via browser HUD UI
      screenTrack.onended = () => {
        stopScreenShareDirect(displayStream);
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      stopScreenShareDirect(screenStream);
    }
  };

  const stopScreenShareDirect = (streamToStop: MediaStream) => {
    streamToStop.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);

    // Put back original camera video track
    const localVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (localVideoTrack) {
      Object.values(peersRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(localVideoTrack);
        }
      });
    }
  };

  return {
    localStream,
    peerStreams,
    screenStream,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare
  };
}
