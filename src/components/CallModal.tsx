import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { ActiveCallState, User, WebStreamState } from '../types';
import { ParticipantVideoCard } from './ParticipantVideoCard';
import { WebStreamStage } from './WebStreamStage';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  SwitchCamera,
  MonitorUp,
  Maximize2,
  Minimize2,
  Users,
  ShieldCheck,
  Radio,
  Sparkles,
  RefreshCw,
  Globe,
  Compass,
  Share2,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Layers,
  X,
  ArrowUpRight,
  Search,
  Cast,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface CallModalProps {
  callState: ActiveCallState;
  currentUser: User;
  socket: Socket | null;
  onAcceptCall: () => void;
  onRejectCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onSwitchCamera?: () => void;
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

interface PresetSite {
  title: string;
  url: string;
  category: 'Popular' | 'Tech & Docs' | 'Media & Science' | 'Interactive';
  icon: string;
  description: string;
}

const PRESET_WEBSITES: PresetSite[] = [
  {
    title: 'Wikipedia',
    url: 'https://en.wikipedia.org',
    category: 'Popular',
    icon: '🌐',
    description: 'Free online encyclopedia & world knowledge',
  },
  {
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    category: 'Tech & Docs',
    icon: '⚡',
    description: 'Live technology & programmer discussions',
  },
  {
    title: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org',
    category: 'Interactive',
    icon: '🗺️',
    description: 'Interactive global collaborative map',
  },
  {
    title: 'DevDocs API',
    url: 'https://devdocs.io',
    category: 'Tech & Docs',
    icon: '📚',
    description: 'Fast, unified developer documentation',
  },
  {
    title: 'NASA Astronomy Picture',
    url: 'https://apod.nasa.gov/apod/astropix.html',
    category: 'Media & Science',
    icon: '🔭',
    description: 'Daily astronomy exploration and discoveries',
  },
  {
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org',
    category: 'Tech & Docs',
    icon: '💻',
    description: 'HTML, CSS, and JavaScript standards reference',
  },
  {
    title: 'TechCrunch',
    url: 'https://techcrunch.com',
    category: 'Popular',
    icon: '📰',
    description: 'Breaking technology and startup news',
  },
  {
    title: 'JSFiddle Sandbox',
    url: 'https://jsfiddle.net',
    category: 'Interactive',
    icon: '🧪',
    description: 'Collaborative live web code testing',
  },
];

export const CallModal: React.FC<CallModalProps> = ({
  callState,
  currentUser,
  socket,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onSwitchCamera,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [peerVideoStates, setPeerVideoStates] = useState<Record<string, boolean>>({});
  const [peerAudioStates, setPeerAudioStates] = useState<Record<string, boolean>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPosition, setPipPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);

  // Web Stream & Co-Browsing State
  const [webStream, setWebStream] = useState<WebStreamState | null>(callState.webStream || null);
  const [showWebStreamDialog, setShowWebStreamDialog] = useState(false);
  const [streamUrlInput, setStreamUrlInput] = useState('https://en.wikipedia.org');
  const [streamTitleInput, setStreamTitleInput] = useState('');
  const [streamFilterCategory, setStreamFilterCategory] = useState<string>('All');
  const [streamEngineMode, setStreamEngineMode] = useState<'proxy' | 'direct'>('proxy');
  const [webStreamZoom, setWebStreamZoom] = useState(100);
  const [isLaserPointerOn, setIsLaserPointerOn] = useState(false);
  const [livePointer, setLivePointer] = useState<{ x: number; y: number; username: string; active?: boolean } | null>(null);
  const [webStreamLayout, setWebStreamLayout] = useState<'split' | 'cinema'>('split');
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const ringtoneIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pointerThrottleRef = useRef<number>(0);
  const streamIframeContainerRef = useRef<HTMLDivElement | null>(null);
  const localStreamPromiseRef = useRef<Promise<MediaStream | null> | null>(null);

  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const isVideoMode = callState.callType === 'video';
  const isStreamActive = Boolean(webStream && webStream.isActive);
  const isCurrentStreamer = Boolean(
    webStream &&
      webStream.streamerUsername.toLowerCase() === currentUser.username.toLowerCase()
  );

  // Sync state from parent callState prop if available
  useEffect(() => {
    if (callState.webStream !== undefined) {
      setWebStream(callState.webStream);
      if (callState.webStream?.zoom) {
        setWebStreamZoom(callState.webStream.zoom);
      }
    }
  }, [callState.webStream]);

  // Web Audio Ringtone
  const playRingtoneNote = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = isVideoMode ? 520 : 440;
      osc2.frequency.value = isVideoMode ? 660 : 480;

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
      // Audio context might be blocked before user interaction
    }
  }, [isVideoMode]);

  // Ringtone playback
  useEffect(() => {
    if (callState.status === 'incoming' || callState.status === 'outgoing') {
      playRingtoneNote();
      ringtoneIntervalRef.current = setInterval(playRingtoneNote, 2500);
    } else {
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
    }

    return () => {
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
      }
    };
  }, [callState.status, playRingtoneNote]);

  // Call duration counter
  useEffect(() => {
    let timer: any;
    if (callState.status === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState.status]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to extract remote target peers
  const getTargetPeers = useCallback((): string[] => {
    const peers = new Set<string>();
    if (callState.participants && Array.isArray(callState.participants)) {
      callState.participants.forEach((p: any) => {
        const uname = typeof p === 'string' ? p : p?.username;
        if (uname && uname.toLowerCase() !== currentUser.username.toLowerCase()) {
          peers.add(uname);
        }
      });
    }
    if (callState.callerUsername && callState.callerUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
      peers.add(callState.callerUsername);
    }
    if (peers.size === 0 && !callState.isGroup && callState.chatName && callState.chatName.toLowerCase() !== currentUser.username.toLowerCase()) {
      peers.add(callState.chatName);
    }
    return Array.from(peers);
  }, [callState.participants, callState.callerUsername, callState.chatName, callState.isGroup, currentUser.username]);

  // Attach local media stream tracks to a peer connection safely and ensure sendrecv direction
  const attachStreamToPc = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const senders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const existingSender = senders.find((s) => s.track && s.track.kind === track.kind) ||
                             senders.find((s) => !s.track);
      if (existingSender) {
        existingSender.replaceTrack(track).catch((err) => {
          console.warn(`[WebRTC] replaceTrack ${track.kind} error:`, err);
        });
      } else {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          console.warn(`[WebRTC] addTrack ${track.kind} error:`, err);
        }
      }
    });

    pc.getTransceivers().forEach((transceiver) => {
      if (transceiver.direction !== 'sendrecv') {
        try {
          transceiver.direction = 'sendrecv';
        } catch (e) {}
      }
    });
  }, []);

  // Flush any ICE candidates received before remote description was set
  const flushQueuedIceCandidates = useCallback(async (targetUsername: string, pc: RTCPeerConnection) => {
    const key = targetUsername.toLowerCase();
    const queue = pendingIceCandidatesRef.current.get(key) || [];
    if (queue.length > 0) {
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('[WebRTC] Error adding queued ICE candidate:', err);
        }
      }
      pendingIceCandidatesRef.current.delete(key);
    }
  }, []);

  // Stable helper to create or retrieve peer connection
  const getOrCreatePeerConnection = useCallback((targetUsername: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(targetUsername) ||
             peerConnectionsRef.current.get(targetUsername.toLowerCase());
    if (pc) return pc;

    pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionsRef.current.set(targetUsername, pc);
    peerConnectionsRef.current.set(targetUsername.toLowerCase(), pc);

    if (localStreamRef.current) {
      attachStreamToPc(pc, localStreamRef.current);
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        if (isVideoMode) {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } catch (e) {}
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && callStateRef.current.callId) {
        socketRef.current.emit('call:ice_candidate', {
          chatId: callStateRef.current.chatId,
          callId: callStateRef.current.callId,
          targetUsername,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${targetUsername}`);
      const incomingTrack = event.track;

      setRemoteStreams((prev) => {
        const existing = prev[targetUsername] || prev[targetUsername.toLowerCase()];
        let updatedStream: MediaStream;
        if (existing) {
          const remainingTracks = existing.getTracks().filter((t) => t.id !== incomingTrack.id);
          updatedStream = new MediaStream([...remainingTracks, incomingTrack]);
        } else {
          updatedStream = event.streams[0] ? new MediaStream(event.streams[0].getTracks()) : new MediaStream([incomingTrack]);
        }
        return {
          ...prev,
          [targetUsername]: updatedStream,
          [targetUsername.toLowerCase()]: updatedStream,
        };
      });

      setConnectedUsers((prev) => (prev.includes(targetUsername) ? prev : [...prev, targetUsername]));

      event.track.onunmute = () => {
        setRemoteStreams((prev) => {
          const existing = prev[targetUsername] || prev[targetUsername.toLowerCase()];
          if (existing) {
            return {
              ...prev,
              [targetUsername]: new MediaStream(existing.getTracks()),
              [targetUsername.toLowerCase()]: new MediaStream(existing.getTracks()),
            };
          }
          return prev;
        });
      };

      if (event.track.kind === 'audio') {
        let audioEl = audioElementsRef.current.get(targetUsername.toLowerCase());
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          document.body.appendChild(audioEl);
          audioElementsRef.current.set(targetUsername.toLowerCase(), audioEl);
          audioElementsRef.current.set(targetUsername, audioEl);
        }
        const audioStream = event.streams[0] || new MediaStream([incomingTrack]);
        audioEl.srcObject = audioStream;
        audioEl.muted = !callStateRef.current.isSpeakerOn;
        if (callStateRef.current.isSpeakerOn) {
          audioEl.play().catch(() => {});
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetUsername}: ${pc?.connectionState}`);
      if (pc?.connectionState === 'connected') {
        setConnectedUsers((prev) => (prev.includes(targetUsername) ? prev : [...prev, targetUsername]));
      } else if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
        setConnectedUsers((prev) => prev.filter((u) => u !== targetUsername && u !== targetUsername.toLowerCase()));
      }
    };

    return pc;
  }, [attachStreamToPc, isVideoMode]);

  // Proactively acquire or return existing local media stream
  const getOrAcquireLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    if (localStreamPromiseRef.current) {
      return localStreamPromiseRef.current;
    }

    const currentCallId = callStateRef.current.callId;

    const acquisition = (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: isVideoMode && !callStateRef.current.isVideoOff
            ? {
                facingMode: isFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
          console.warn('[WebRTC] Video getUserMedia failed, attempting audio fallback:', mediaErr);
          if (isVideoMode) {
            setHasCameraError('Camera access restricted. Switching to audio-only.');
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        }

        if (callStateRef.current.callId !== currentCallId) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasCameraError(null);

        stream.getAudioTracks().forEach((track) => {
          track.enabled = !callStateRef.current.isMuted;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !callStateRef.current.isVideoOff;
        });

        if (localVideoRef.current && isVideoMode) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        // Attach tracks to all existing peer connections
        peerConnectionsRef.current.forEach((pc) => {
          attachStreamToPc(pc, stream);
        });

        return stream;
      } catch (fatalErr) {
        console.error('[WebRTC] Media acquisition fatal error:', fatalErr);
        setHasCameraError('Microphone or Camera access restricted.');
        return null;
      } finally {
        localStreamPromiseRef.current = null;
      }
    })();

    localStreamPromiseRef.current = acquisition;
    return acquisition;
  }, [attachStreamToPc, isFrontCamera, isVideoMode]);

  // Send offer to a specific peer with local stream guaranteed attached
  const sendOfferToPeer = useCallback(async (peer: string) => {
    const pc = getOrCreatePeerConnection(peer);
    const stream = await getOrAcquireLocalStream();
    if (stream) {
      attachStreamToPc(pc, stream);
    }

    // Ensure transceivers are sendrecv
    pc.getTransceivers().forEach((transceiver) => {
      if (transceiver.direction !== 'sendrecv') {
        try {
          transceiver.direction = 'sendrecv';
        } catch (e) {}
      }
    });

    if (pc.signalingState !== 'stable') {
      console.log(`[WebRTC] Skipping offer creation for ${peer}, signalingState: ${pc.signalingState}`);
      return;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoMode,
      });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call:webrtc_offer', {
        chatId: callStateRef.current.chatId,
        callId: callStateRef.current.callId,
        targetUsername: peer,
        offer,
      });
      console.log(`[WebRTC] Emitted offer to ${peer}`);
    } catch (err) {
      console.error(`[WebRTC] Error emitting offer to ${peer}:`, err);
    }
  }, [getOrCreatePeerConnection, getOrAcquireLocalStream, attachStreamToPc, isVideoMode]);

  // Send offers to all peer participants
  const sendOffersToPeers = useCallback(async () => {
    const peers = getTargetPeers();
    for (const peer of peers) {
      await sendOfferToPeer(peer);
    }
  }, [getTargetPeers, sendOfferToPeer]);

  // Setup Local Media Stream on incoming, outgoing, or connected state
  useEffect(() => {
    if (!callState.callId) return;
    if (callState.status === 'incoming' || callState.status === 'outgoing' || callState.status === 'connected') {
      getOrAcquireLocalStream().then((stream) => {
        if (stream && callStateRef.current.status === 'connected') {
          const isCaller = callStateRef.current.callerUsername.toLowerCase() === currentUser.username.toLowerCase();
          if (isCaller) {
            sendOffersToPeers();
          }
        }
      });
    }
  }, [callState.status, callState.callId, getOrAcquireLocalStream, sendOffersToPeers, currentUser.username]);

  // Trigger offers once call connects
  useEffect(() => {
    if (callState.status === 'connected') {
      const isCaller = callState.callerUsername.toLowerCase() === currentUser.username.toLowerCase();
      if (isCaller) {
        sendOffersToPeers();
      }
    }
  }, [callState.status, currentUser.username, sendOffersToPeers]);

  // Clean up WebRTC session when call ends
  useEffect(() => {
    if (callState.status === 'ended') {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingIceCandidatesRef.current.clear();

      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      audioElementsRef.current.clear();
      setRemoteStreams({});
      setConnectedUsers([]);
    }
  }, [callState.status]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingIceCandidatesRef.current.clear();

      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      audioElementsRef.current.clear();
    };
  }, []);

  // Ensure remote and local video elements remain bound when view switches
  useEffect(() => {
    if (!isStreamActive && isVideoMode) {
      if (localVideoRef.current) {
        const streamToUse = (isScreenSharing && screenStreamRef.current)
          ? screenStreamRef.current
          : (localStreamRef.current || localStream);
        if (streamToUse && localVideoRef.current.srcObject !== streamToUse) {
          localVideoRef.current.srcObject = streamToUse;
        }
        if (localVideoRef.current.srcObject) {
          localVideoRef.current.play().catch(() => {});
        }
      }
    }
  }, [isStreamActive, isVideoMode, localStream, isScreenSharing]);

  // Ensure all remote audio elements are active and playing uninterrupted
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([username, stream]) => {
      if (stream && stream.getAudioTracks().length > 0) {
        let audioEl = audioElementsRef.current.get(username) ||
                      audioElementsRef.current.get(username.toLowerCase());
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          audioElementsRef.current.set(username, audioEl);
          audioElementsRef.current.set(username.toLowerCase(), audioEl);
        }
        if (audioEl.srcObject !== stream) {
          audioEl.srcObject = stream;
        }
        audioEl.muted = !callState.isSpeakerOn;
        if (callState.isSpeakerOn) {
          audioEl.play().catch(() => {});
        }
      }
    });
  }, [remoteStreams, callState.isSpeakerOn]);

  // Audio mute toggling
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !callState.isMuted;
      });
    }
    if (socket && callState.status === 'connected') {
      socket.emit('call:toggle_media', {
        chatId: callState.chatId,
        callId: callState.callId,
        isMuted: callState.isMuted,
      });
    }
  }, [callState.isMuted, callState.chatId, callState.callId, callState.status, socket]);

  // Video camera toggling
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !callState.isVideoOff;
      });
    }

    if (socket && callState.status === 'connected') {
      socket.emit('call:toggle_media', {
        chatId: callState.chatId,
        callId: callState.callId,
        isVideoOff: callState.isVideoOff,
      });
    }
  }, [callState.isVideoOff, callState.chatId, callState.callId, callState.status, socket]);

  // Speaker audio sync
  useEffect(() => {
    audioElementsRef.current.forEach((audioEl) => {
      audioEl.muted = !callState.isSpeakerOn;
      if (callState.isSpeakerOn) {
        audioEl.play().catch(() => {});
      }
    });
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !callState.isSpeakerOn;
    }
  }, [callState.isSpeakerOn]);

  // Socket signaling listeners for WebRTC & Web Streaming
  useEffect(() => {
    if (!socket) return;

    const handleWebRtcOffer = async (data: {
      callId: string;
      chatId: string;
      fromUsername: string;
      offer: any;
    }) => {
      if (data.callId !== callStateRef.current.callId) return;
      console.log(`[WebRTC] Received offer from ${data.fromUsername}`);
      const pc = getOrCreatePeerConnection(data.fromUsername);

      try {
        // ALWAYS ensure local stream is acquired BEFORE creating the answer!
        const stream = await getOrAcquireLocalStream();
        if (stream) {
          attachStreamToPc(pc, stream);
        }

        // Handle glare rollback if in have-local-offer
        if (pc.signalingState !== 'stable') {
          console.log(`[WebRTC] Rolling back peer connection for ${data.fromUsername} from ${pc.signalingState}`);
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushQueuedIceCandidates(data.fromUsername, pc);

        // Ensure transceivers are sendrecv
        pc.getTransceivers().forEach((transceiver) => {
          if (transceiver.direction !== 'sendrecv') {
            try {
              transceiver.direction = 'sendrecv';
            } catch (e) {}
          }
        });

        // Re-attach local stream in case offer created new transceivers
        if (stream) {
          attachStreamToPc(pc, stream);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call:webrtc_answer', {
          chatId: callStateRef.current.chatId,
          callId: callStateRef.current.callId,
          targetUsername: data.fromUsername,
          answer,
        });
        console.log(`[WebRTC] Emitted answer to ${data.fromUsername}`);
      } catch (err) {
        console.error('[WebRTC] Error handling WebRTC offer:', err);
      }
    };

    const handleWebRtcAnswer = async (data: {
      callId: string;
      chatId: string;
      fromUsername: string;
      answer: any;
    }) => {
      if (data.callId !== callStateRef.current.callId) return;
      console.log(`[WebRTC] Received answer from ${data.fromUsername}`);
      const pc = peerConnectionsRef.current.get(data.fromUsername) ||
                 peerConnectionsRef.current.get(data.fromUsername.toLowerCase());
      if (pc) {
        try {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushQueuedIceCandidates(data.fromUsername, pc);
            console.log(`[WebRTC] Successfully set remote description answer for ${data.fromUsername}`);
          }
        } catch (err) {
          console.error('[WebRTC] Error setting remote description answer:', err);
        }
      }
    };

    const handleIceCandidate = async (data: {
      callId: string;
      chatId: string;
      fromUsername: string;
      candidate: any;
    }) => {
      if (data.callId !== callStateRef.current.callId) return;
      const pc = peerConnectionsRef.current.get(data.fromUsername) ||
                 peerConnectionsRef.current.get(data.fromUsername.toLowerCase());
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        const key = data.fromUsername.toLowerCase();
        const q = pendingIceCandidatesRef.current.get(key) || [];
        q.push(data.candidate);
        pendingIceCandidatesRef.current.set(key, q);
      }
    };

    const handlePeerMediaChanged = (data: {
      callId: string;
      chatId: string;
      username: string;
      isVideoOff?: boolean;
      isMuted?: boolean;
    }) => {
      if (data.callId !== callStateRef.current.callId) return;
      if (data.isVideoOff !== undefined) {
        setPeerVideoStates((prev) => ({
          ...prev,
          [data.username]: data.isVideoOff!,
          [data.username.toLowerCase()]: data.isVideoOff!,
        }));
      }
      if (data.isMuted !== undefined) {
        setPeerAudioStates((prev) => ({
          ...prev,
          [data.username]: data.isMuted!,
          [data.username.toLowerCase()]: data.isMuted!,
        }));
      }
    };

    // Co-browsing & Web Streaming Socket Listeners
    const handleWebStreamStarted = (data: {
      chatId: string;
      callId: string;
      streamState: WebStreamState;
    }) => {
      if (data.chatId === callStateRef.current.chatId) {
        setWebStream(data.streamState);
        setStreamUrlInput(data.streamState.url);
        if (data.streamState.zoom) setWebStreamZoom(data.streamState.zoom);
      }
    };

    const handleWebStreamUpdated = (data: {
      chatId: string;
      callId: string;
      streamState: WebStreamState;
      updatedBy: string;
    }) => {
      if (data.chatId === callStateRef.current.chatId) {
        setWebStream(data.streamState);
        if (data.streamState.pointer) {
          setLivePointer(data.streamState.pointer);
        } else {
          setLivePointer(null);
        }
        if (data.streamState.zoom) {
          setWebStreamZoom(data.streamState.zoom);
        }
      }
    };

    const handleWebStreamStopped = (data: { chatId: string; callId: string }) => {
      if (data.chatId === callStateRef.current.chatId) {
        if (screenStreamRef.current || isScreenSharing) {
          handleStopScreenShare();
        }
        setWebStream(null);
        setLivePointer(null);
      }
    };

    socket.on('call:webrtc_offer', handleWebRtcOffer);
    socket.on('call:webrtc_answer', handleWebRtcAnswer);
    socket.on('call:ice_candidate', handleIceCandidate);
    socket.on('call:peer_media_changed', handlePeerMediaChanged);
    socket.on('call:web_stream_started', handleWebStreamStarted);
    socket.on('call:web_stream_updated', handleWebStreamUpdated);
    socket.on('call:web_stream_stopped', handleWebStreamStopped);

    return () => {
      socket.off('call:webrtc_offer', handleWebRtcOffer);
      socket.off('call:webrtc_answer', handleWebRtcAnswer);
      socket.off('call:ice_candidate', handleIceCandidate);
      socket.off('call:peer_media_changed', handlePeerMediaChanged);
      socket.off('call:web_stream_started', handleWebStreamStarted);
      socket.off('call:web_stream_updated', handleWebStreamUpdated);
      socket.off('call:web_stream_stopped', handleWebStreamStopped);
    };
  }, [socket, getOrCreatePeerConnection, attachStreamToPc, flushQueuedIceCandidates]);

  // Flip Camera
  const handleFlipCamera = async () => {
    const nextFacing = !isFrontCamera;
    setIsFrontCamera(nextFacing);

    if (localStreamRef.current && isVideoMode) {
      try {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          currentVideoTrack.stop();
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack);
          localStreamRef.current.addTrack(newVideoTrack);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            }
          });
        }
      } catch (err) {
        console.error('Could not switch camera:', err);
      }
    }
    if (onSwitchCamera) onSwitchCamera();
  };

  // Screen Sharing
  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
          localVideoRef.current.play().catch(() => {});
        }

        setLocalStream(screenStream);

        // Gather all call peers
        const targetPeers = new Set<string>();
        callState.participants.forEach((p) => {
          if (p.username.toLowerCase() !== currentUser.username.toLowerCase()) {
            targetPeers.add(p.username);
          }
        });
        if (targetPeers.size === 0 && callState.callerUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
          targetPeers.add(callState.callerUsername);
        }

        for (const targetUser of targetPeers) {
          const pc = getOrCreatePeerConnection(targetUser);
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video') ||
                              senders.find((s) => s.track === null);
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, screenStream);
          }

          try {
            const offer = await pc.createOffer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true,
            });
            await pc.setLocalDescription(offer);
            socket?.emit('call:webrtc_offer', {
              chatId: callState.chatId,
              callId: callState.callId,
              targetUsername: targetUser,
              offer,
            });
          } catch (err) {
            console.warn('Renegotiation offer error for', targetUser, err);
          }
        }

        socket?.emit('call:toggle_media', {
          chatId: callState.chatId,
          callId: callState.callId,
          isVideoOff: false,
        });

        screenTrack.onended = () => {
          handleStopScreenShare();
        };
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    } else {
      handleStopScreenShare();
    }
  };

  const handleStopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setLocalStream(localStreamRef.current);

      const targetPeers = new Set<string>();
      callState.participants.forEach((p) => {
        if (p.username.toLowerCase() !== currentUser.username.toLowerCase()) {
          targetPeers.add(p.username);
        }
      });
      if (targetPeers.size === 0 && callState.callerUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
        targetPeers.add(callState.callerUsername);
      }

      for (const targetUser of targetPeers) {
        const pc = getOrCreatePeerConnection(targetUser);
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }
        try {
          const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true,
          });
          await pc.setLocalDescription(offer);
          socket?.emit('call:webrtc_offer', {
            chatId: callState.chatId,
            callId: callState.callId,
            targetUsername: targetUser,
            offer,
          });
        } catch (err) {
          console.warn('Renegotiation after screen share stop error:', err);
        }
      }
    }
  };

  // ========================================================
  // WEB STREAMING & CO-BROWSING METHODS
  // ========================================================
  const handleStartTabStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      const screenTrack = stream.getVideoTracks()[0];

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setLocalStream(stream);

      // Collect all peers in call
      const targetPeers = new Set<string>();
      callState.participants.forEach((p) => {
        if (p.username.toLowerCase() !== currentUser.username.toLowerCase()) {
          targetPeers.add(p.username);
        }
      });
      if (targetPeers.size === 0 && callState.callerUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
        targetPeers.add(callState.callerUsername);
      }

      for (const targetUser of targetPeers) {
        const pc = getOrCreatePeerConnection(targetUser);
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video') ||
                            senders.find((s) => s.track === null);
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, stream);
        }

        try {
          const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true,
          });
          await pc.setLocalDescription(offer);
          socket?.emit('call:webrtc_offer', {
            chatId: callState.chatId,
            callId: callState.callId,
            targetUsername: targetUser,
            offer,
          });
        } catch (err) {
          console.warn('Renegotiation offer error for', targetUser, err);
        }
      }

      socket?.emit('call:toggle_media', {
        chatId: callState.chatId,
        callId: callState.callId,
        isVideoOff: false,
      });

      const streamState: WebStreamState = {
        isActive: true,
        url: 'Live Browser Tab / Screen',
        title: 'Live Browser Tab Stream',
        streamerUsername: currentUser.username,
        streamerAvatar: currentUser.avatarUrl,
        startedAt: Date.now(),
        scrollY: 0,
        zoom: 100,
        mode: 'screen',
        allowCollaborativeControl: false,
      };

      setWebStream(streamState);
      setShowWebStreamDialog(false);

      socket?.emit('call:web_stream_start', {
        chatId: callState.chatId,
        callId: callState.callId,
        url: 'Live Browser Tab / Screen',
        title: 'Live Browser Tab Stream',
        mode: 'screen',
        allowCollaborativeControl: false,
      });

      screenTrack.onended = () => {
        handleStopScreenShare();
        handleStopWebStream();
      };
    } catch (err) {
      console.error('Error starting live tab stream:', err);
    }
  };

  const handleStartWebStream = (targetUrl: string, title?: string, mode: 'proxy' | 'direct' = streamEngineMode) => {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const streamState: WebStreamState = {
      isActive: true,
      url: cleanUrl,
      title: title || cleanUrl,
      streamerUsername: currentUser.username,
      streamerAvatar: currentUser.avatarUrl,
      startedAt: Date.now(),
      scrollY: 0,
      zoom: 100,
      mode,
      allowCollaborativeControl: true,
    };

    setWebStream(streamState);
    setStreamUrlInput(cleanUrl);
    setShowWebStreamDialog(false);

    socket?.emit('call:web_stream_start', {
      chatId: callState.chatId,
      callId: callState.callId,
      url: cleanUrl,
      title: title || cleanUrl,
      mode,
      allowCollaborativeControl: true,
    });
  };

  const handleUpdateWebStreamUrl = (newUrl: string) => {
    let cleanUrl = newUrl.trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    setWebStream((prev) => (prev ? { ...prev, url: cleanUrl } : null));
    setStreamUrlInput(cleanUrl);
    setIframeKey((prev) => prev + 1);

    socket?.emit('call:web_stream_update', {
      chatId: callState.chatId,
      callId: callState.callId,
      url: cleanUrl,
    });
  };

  const handleStopWebStream = () => {
    if (screenStreamRef.current || isScreenSharing) {
      handleStopScreenShare();
    }
    setWebStream(null);
    setLivePointer(null);
    socket?.emit('call:web_stream_stop', {
      chatId: callState.chatId,
      callId: callState.callId,
    });
  };

  const handleZoomChange = (delta: number) => {
    const nextZoom = Math.min(175, Math.max(60, webStreamZoom + delta));
    setWebStreamZoom(nextZoom);
    if (isCurrentStreamer || webStream?.allowCollaborativeControl) {
      socket?.emit('call:web_stream_update', {
        chatId: callState.chatId,
        callId: callState.callId,
        zoom: nextZoom,
      });
    }
  };

  const handlePointerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLaserPointerOn || !streamIframeContainerRef.current) return;
    const now = Date.now();
    if (now - pointerThrottleRef.current < 45) return; // 22 fps throttle
    pointerThrottleRef.current = now;

    const rect = streamIframeContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const pointerData = { x, y, active: true, username: currentUser.username };
    setLivePointer(pointerData);

    socket?.emit('call:web_stream_update', {
      chatId: callState.chatId,
      callId: callState.callId,
      pointer: pointerData,
    });
  };

  const handlePointerMouseLeave = () => {
    if (!isLaserPointerOn) return;
    setLivePointer(null);
    socket?.emit('call:web_stream_update', {
      chatId: callState.chatId,
      callId: callState.callId,
      pointer: null,
    });
  };

  const handleCopyStreamUrl = () => {
    if (webStream?.url) {
      navigator.clipboard.writeText(webStream.url);
      setIsUrlCopied(true);
      setTimeout(() => setIsUrlCopied(false), 2000);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Cycle PiP position
  const cyclePipPosition = () => {
    const positions: ('top-right' | 'top-left' | 'bottom-right' | 'bottom-left')[] = [
      'top-right',
      'bottom-right',
      'bottom-left',
      'top-left',
    ];
    const next = positions[(positions.indexOf(pipPosition) + 1) % positions.length];
    setPipPosition(next);
  };

  const remotePeerUsername = useMemo(() => {
    const peers = getTargetPeers();
    return peers[0] || callState.callerUsername || callState.chatName || '';
  }, [getTargetPeers, callState.callerUsername, callState.chatName]);

  const activeRemoteStream = useMemo(() => {
    if (remotePeerUsername && remoteStreams[remotePeerUsername]) {
      return remoteStreams[remotePeerUsername];
    }
    if (remotePeerUsername && remoteStreams[remotePeerUsername.toLowerCase()]) {
      return remoteStreams[remotePeerUsername.toLowerCase()];
    }
    const all = Object.values(remoteStreams);
    const withVideo = all.find((s) => s && s.getVideoTracks().length > 0);
    return withVideo || all[0] || null;
  }, [remotePeerUsername, remoteStreams]);

  const hasActiveRemoteVideoTrack = useMemo(() => {
    return Boolean(
      activeRemoteStream &&
      activeRemoteStream.getVideoTracks().length > 0 &&
      activeRemoteStream.getVideoTracks().some((t) => t.enabled)
    );
  }, [activeRemoteStream]);

  const isRemoteVideoOff = useMemo(() => {
    if (!isVideoMode) return true;
    if (remotePeerUsername && peerVideoStates[remotePeerUsername] !== undefined) {
      return peerVideoStates[remotePeerUsername];
    }
    if (remotePeerUsername && peerVideoStates[remotePeerUsername.toLowerCase()] !== undefined) {
      return peerVideoStates[remotePeerUsername.toLowerCase()];
    }
    if (callState.chatName && peerVideoStates[callState.chatName] !== undefined) {
      return peerVideoStates[callState.chatName];
    }
    return !hasActiveRemoteVideoTrack;
  }, [isVideoMode, remotePeerUsername, peerVideoStates, callState.chatName, hasActiveRemoteVideoTrack]);

  // Keep remoteVideoRef directly bound to active remote stream
  useEffect(() => {
    if (!isStreamActive && isVideoMode && remoteVideoRef.current) {
      if (activeRemoteStream && remoteVideoRef.current.srcObject !== activeRemoteStream) {
        remoteVideoRef.current.srcObject = activeRemoteStream;
      }
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [isStreamActive, isVideoMode, activeRemoteStream]);

  // Compute iframe source
  const getIframeSrc = () => {
    if (!webStream?.url) return '';
    if (webStream.mode === 'direct') {
      return webStream.url;
    }
    return `/api/web-stream/proxy?url=${encodeURIComponent(webStream.url)}`;
  };

  const filteredPresetSites = PRESET_WEBSITES.filter(
    (site) => streamFilterCategory === 'All' || site.category === streamFilterCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        ref={containerRef}
        className={`w-full ${
          isStreamActive
            ? 'max-w-6xl h-[94vh] max-h-[900px]'
            : isVideoMode
            ? 'max-w-4xl h-[92vh] max-h-[850px]'
            : 'max-w-md'
        } bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col items-center text-center select-none transition-all duration-300`}
      >
        {/* Top Header Bar */}
        <div className="w-full z-20 px-4 py-3 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-transparent flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono rounded-full backdrop-blur-md shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isStreamActive
                  ? 'E2EE Stream + Co-Browse'
                  : isVideoMode
                  ? 'E2EE HD Video Stream'
                  : 'E2EE Encrypted Audio'}
              </span>
            </div>

            {isStreamActive && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold rounded-full animate-pulse">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  @{webStream?.streamerUsername} is streaming {webStream?.title || 'a website'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {callState.status === 'connected' && (
              <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 backdrop-blur-md">
                {formatTimer(callDuration)}
              </span>
            )}

            {/* Fullscreen Button */}
            {(isVideoMode || isStreamActive) && (
              <button
                onClick={handleToggleFullscreen}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Main Stage */}
        <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center bg-slate-950">
          {/* ======================================================== */}
          {/* 1. SYNCHRONIZED LIVE WEBSITE STREAMING STAGE */}
          {/* ======================================================== */}
          {isStreamActive && webStream ? (
            <WebStreamStage
              webStream={webStream}
              currentUser={currentUser}
              participants={callState.participants}
              localStream={localStreamRef.current}
              remoteStreams={remoteStreams}
              peerVideoStates={peerVideoStates}
              peerAudioStates={peerAudioStates}
              isVideoOff={callState.isVideoOff}
              isMuted={callState.isMuted}
              isFrontCamera={isFrontCamera}
              isScreenSharing={isScreenSharing}
              screenStream={screenStreamRef.current}
              livePointer={livePointer}
              isLaserPointerOn={isLaserPointerOn}
              onToggleLaserPointer={() => setIsLaserPointerOn((p) => !p)}
              onPointerMove={handlePointerMouseMove}
              onPointerLeave={handlePointerMouseLeave}
              onUpdateUrl={handleUpdateWebStreamUrl}
              onZoomChange={handleZoomChange}
              zoom={webStreamZoom}
              onStopStream={handleStopWebStream}
              onChangeSiteClick={() => setShowWebStreamDialog(true)}
              onStartTabShare={handleStartTabStream}
            />
          ) : isVideoMode ? (
            /* ======================================================== */
            /* 2. STANDARD VIDEO CALL STAGE (When no web stream is active) */
            /* ======================================================== */
            <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
              {/* Remote Video Element */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-2xl ${
                  isRemoteVideoOff ? 'hidden' : 'block'
                }`}
              />

              {/* Remote Video Disabled or Connecting Avatar Fallback */}
              {(isRemoteVideoOff || callState.status !== 'connected') && (
                <div className="flex flex-col items-center justify-center space-y-4 p-6 z-10">
                  <div className="relative">
                    {callState.status === 'connected' && (
                      <div className="absolute -inset-3 bg-emerald-500/20 rounded-full animate-ping opacity-60" />
                    )}
                    <img
                      src={
                        callState.chatAvatar ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${callState.chatName}`
                      }
                      alt={callState.chatName}
                      className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-slate-800 object-cover shadow-2xl relative z-10"
                    />
                    {callState.isGroup && (
                      <div className="absolute -bottom-1 -right-1 z-20 bg-emerald-600 text-white p-2 rounded-full border-2 border-slate-900 shadow">
                        <Users className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-center">
                    <h3 className="text-xl font-bold text-slate-100">{callState.chatName}</h3>
                    <p className="text-xs text-slate-400">
                      {callState.status === 'incoming' && (
                        <span className="text-emerald-400 font-semibold animate-pulse flex items-center justify-center gap-1">
                          <Radio className="w-3.5 h-3.5" /> Incoming Video Call...
                        </span>
                      )}
                      {callState.status === 'outgoing' && (
                        <span className="text-emerald-400 font-semibold animate-pulse">
                          Calling {callState.chatName}...
                        </span>
                      )}
                      {callState.status === 'connected' && isRemoteVideoOff && (
                        <span className="text-slate-400 flex items-center justify-center gap-1.5">
                          <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Participant camera is turned off</span>
                        </span>
                      )}
                      {callState.status === 'ended' && (
                        <span className="text-rose-400 font-semibold">Call Ended</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Local Video Picture-in-Picture (PiP) Window */}
              {callState.status === 'connected' && (
                <div
                  onClick={cyclePipPosition}
                  className={`absolute z-30 transition-all duration-300 cursor-pointer group ${
                    pipPosition === 'top-right'
                      ? 'top-4 right-4'
                      : pipPosition === 'top-left'
                      ? 'top-4 left-4'
                      : pipPosition === 'bottom-right'
                      ? 'bottom-20 right-4'
                      : 'bottom-20 left-4'
                  }`}
                  title="Click to move video preview"
                >
                  <div className="w-28 sm:w-36 aspect-[3/4] bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
                    {callState.isVideoOff ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <img
                          src={
                            currentUser.avatarUrl ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
                          }
                          alt="You"
                          className="w-10 h-10 rounded-full border border-slate-700 object-cover mb-1"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">Camera Off</span>
                      </div>
                    ) : (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${
                          isFrontCamera && !isScreenSharing ? 'scale-x-[-1]' : ''
                        }`}
                      />
                    )}
                    <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 bg-slate-950/70 text-[9px] font-bold text-slate-300 rounded border border-slate-800 backdrop-blur-sm">
                      You
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Error Message */}
              {hasCameraError && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-rose-500/90 text-white text-xs font-semibold shadow-lg backdrop-blur-md">
                  {hasCameraError}
                </div>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* 3. VOICE MODE STAGE */
            /* ======================================================== */
            <div className="flex flex-col items-center justify-center p-8 space-y-6">
              <div className="relative mt-2">
                {callState.status === 'connected' && (
                  <div className="absolute -inset-3 bg-emerald-500/20 rounded-full animate-ping opacity-75" />
                )}
                <img
                  src={
                    callState.chatAvatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${callState.chatName}`
                  }
                  alt={callState.chatName}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-slate-800 object-cover shadow-2xl relative z-10"
                />
                {callState.isGroup && (
                  <div className="absolute -bottom-1 -right-1 z-20 bg-emerald-600 text-white p-1.5 rounded-full border-2 border-slate-900 shadow">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="space-y-1 w-full text-center">
                <h3 className="text-lg font-bold text-slate-100 truncate">{callState.chatName}</h3>

                <div className="text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
                  {callState.status === 'incoming' && (
                    <span className="text-emerald-400 font-semibold animate-pulse flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5" /> Incoming Voice Call...
                    </span>
                  )}
                  {callState.status === 'outgoing' && (
                    <span className="text-emerald-400 font-semibold animate-pulse">Ringing...</span>
                  )}
                  {callState.status === 'connected' && (
                    <span className="text-emerald-400 font-mono font-bold text-sm bg-slate-950/60 px-3 py-0.5 rounded-full border border-slate-800">
                      {formatTimer(callDuration)}
                    </span>
                  )}
                  {callState.status === 'ended' && (
                    <span className="text-rose-400 font-semibold">Call Ended</span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  {callState.isGroup
                    ? `Group Audio Call • ${callState.participants.length} Participants`
                    : `Encrypted Voice Call with @${callState.chatName}`}
                </p>
              </div>

              {callState.status === 'connected' && (
                <div className="flex items-center gap-1.5 h-6 justify-center my-2">
                  <span className="w-1 bg-emerald-500 rounded-full h-3 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 bg-emerald-400 rounded-full h-5 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 bg-emerald-500 rounded-full h-2 animate-bounce [animation-delay:300ms]" />
                  <span className="w-1 bg-emerald-400 rounded-full h-6 animate-bounce [animation-delay:450ms]" />
                  <span className="w-1 bg-emerald-500 rounded-full h-3 animate-bounce [animation-delay:600ms]" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Action Controls Bar */}
        <div className="w-full z-20 px-4 py-3 sm:py-4 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-center gap-2 sm:gap-4">
          {callState.status === 'incoming' ? (
            /* Incoming Call Actions: Accept or Reject */
            <div className="flex items-center gap-10">
              <button
                onClick={onRejectCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform hover:scale-105 active:scale-95"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                onClick={onAcceptCall}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition transform hover:scale-105 active:scale-95 animate-bounce"
                title={isVideoMode ? 'Accept Video Call' : 'Accept Voice Call'}
              >
                {isVideoMode ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
            </div>
          ) : (
            /* Connected / Outgoing Call Controls */
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {/* Mic Mute / Unmute */}
              <button
                onClick={onToggleMute}
                className={`p-2.5 sm:p-3 rounded-2xl border transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px] ${
                  callState.isMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                title={callState.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {callState.isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                <span className="text-[9px] sm:text-[10px] font-medium">{callState.isMuted ? 'Muted' : 'Mic'}</span>
              </button>

              {/* Video Camera On / Off (if Video call) */}
              {isVideoMode && (
                <button
                  onClick={onToggleVideo}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px] ${
                    callState.isVideoOff
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={callState.isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {callState.isVideoOff ? (
                    <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="text-[9px] sm:text-[10px] font-medium">{callState.isVideoOff ? 'Cam Off' : 'Camera'}</span>
                </button>
              )}

              {/* Flip Camera (Front / Back) */}
              {isVideoMode && !callState.isVideoOff && (
                <button
                  onClick={handleFlipCamera}
                  className="p-2.5 sm:p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px]"
                  title="Flip Front / Rear Camera"
                >
                  <SwitchCamera className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[9px] sm:text-[10px] font-medium">{isFrontCamera ? 'Front' : 'Rear'}</span>
                </button>
              )}

              {/* STREAM ANY WEBSITE BUTTON (Key User Feature) */}
              {callState.status === 'connected' && (
                <button
                  onClick={() => setShowWebStreamDialog(true)}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px] ${
                    isStreamActive
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-2 ring-emerald-500/30'
                      : 'bg-gradient-to-br from-emerald-600/30 to-cyan-600/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40'
                  }`}
                  title={isStreamActive ? 'Configure / Change Streamed Website' : 'Stream Any Website to Everyone in Video Call'}
                >
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  <span className="text-[9px] sm:text-[10px] font-bold">
                    {isStreamActive ? 'Streaming' : 'Stream Site'}
                  </span>
                </button>
              )}

              {/* Screen Sharing (Video mode) */}
              {isVideoMode && callState.status === 'connected' && (
                <button
                  onClick={handleToggleScreenShare}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px] ${
                    isScreenSharing
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen Tab'}
                >
                  <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[9px] sm:text-[10px] font-medium">{isScreenSharing ? 'Sharing' : 'Screen'}</span>
                </button>
              )}

              {/* End Call Button (Prominent) */}
              <button
                onClick={onEndCall}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform hover:scale-105 active:scale-95"
                title="End Call"
              >
                <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Speaker On / Off */}
              <button
                onClick={onToggleSpeaker}
                className={`p-2.5 sm:p-3 rounded-2xl border transition flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[56px] ${
                  !callState.isSpeakerOn
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                title={callState.isSpeakerOn ? 'Mute Speaker' : 'Speaker On'}
              >
                {!callState.isSpeakerOn ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="text-[9px] sm:text-[10px] font-medium">{callState.isSpeakerOn ? 'Speaker' : 'Muted'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* STREAM WEBSITE PICKER & CO-BROWSE MODAL DIALOG */}
        {/* ======================================================== */}
        {showWebStreamDialog && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 text-left flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">Stream Any Website</h4>
                    <p className="text-xs text-slate-400">
                      Co-browse and stream any live webpage to everyone in this video call
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWebStreamDialog(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* 0. Live HD Tab / Screen Stream Option (Best for any site without embedding restrictions) */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <MonitorUp className="w-5 h-5 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-slate-100">Live Browser Tab / Screen (HD 60 FPS)</h5>
                        <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Stream ANY website (YouTube, Google Docs, Figma, Reddit, Games) with 0 white screen issues.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleStartTabStream}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition shrink-0"
                  >
                    <Cast className="w-3.5 h-3.5" />
                    <span>Stream Tab</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    OR Interactive Embedded Co-Browse
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* 1. Custom URL Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Enter Any Website URL</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition">
                      <Globe className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={streamUrlInput}
                        onChange={(e) => setStreamUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleStartWebStream(streamUrlInput);
                        }}
                        placeholder="https://en.wikipedia.org or any URL..."
                        className="w-full bg-transparent border-none outline-none text-slate-100 text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <button
                      onClick={() => handleStartWebStream(streamUrlInput)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition shrink-0"
                    >
                      <Cast className="w-4 h-4" />
                      <span>Start Co-Browse</span>
                    </button>
                  </div>
                </div>

                {/* 2. Mode Selector */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setStreamEngineMode('proxy')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center gap-0.5 transition ${
                      streamEngineMode === 'proxy'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Synced Co-Browse (Recommended)</span>
                    <span className="text-[10px] opacity-80">Bypasses CSP & synchs URL / pointers</span>
                  </button>
                  <button
                    onClick={() => setStreamEngineMode('direct')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center gap-0.5 transition ${
                      streamEngineMode === 'direct'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Direct Embed</span>
                    <span className="text-[10px] opacity-80">For standard iframe-friendly sites</span>
                  </button>
                </div>

                {/* 3. Preset Curated Websites */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Or pick popular instant destinations:</span>
                    <div className="flex gap-1">
                      {['All', 'Popular', 'Tech & Docs', 'Interactive'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setStreamFilterCategory(cat)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                            streamFilterCategory === cat
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredPresetSites.map((site) => (
                      <div
                        key={site.title}
                        onClick={() => {
                          setStreamUrlInput(site.url);
                          handleStartWebStream(site.url, site.title);
                        }}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{site.icon}</span>
                          <div className="min-w-0">
                            <h5 className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition truncate">
                              {site.title}
                            </h5>
                            <p className="text-[10px] text-slate-400 truncate">{site.description}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition shrink-0 ml-1" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  All video call participants will see this website live
                </span>
                <button
                  onClick={() => setShowWebStreamDialog(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Persistent Remote Audio Elements in DOM */}
        <div className="hidden" aria-hidden="true">
          {Object.entries(remoteStreams).map(([peerKey, stream]) => {
            if (!stream) return null;
            return (
              <audio
                key={`remote-audio-dom-${peerKey}`}
                autoPlay
                playsInline
                muted={!callState.isSpeakerOn}
                ref={(el) => {
                  if (el && el.srcObject !== stream) {
                    el.srcObject = stream;
                    if (callState.isSpeakerOn) {
                      el.play().catch(() => {});
                    }
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
