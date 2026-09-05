import React, { useState, useRef, useEffect } from 'react';
import { WebStreamState, User } from '../types';
import { ParticipantVideoCard } from './ParticipantVideoCard';
import {
  Globe,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Layers,
  X,
  ArrowUpRight,
  Compass,
  MonitorUp,
  Cast,
  Users,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface WebStreamStageProps {
  webStream: WebStreamState;
  currentUser: User;
  participants: User[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerVideoStates: Record<string, boolean>;
  peerAudioStates: Record<string, boolean>;
  isVideoOff: boolean;
  isMuted: boolean;
  isFrontCamera: boolean;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  livePointer: { x: number; y: number; username: string; active?: boolean } | null;
  isLaserPointerOn: boolean;
  onToggleLaserPointer: () => void;
  onPointerMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onUpdateUrl: (url: string) => void;
  onZoomChange: (delta: number) => void;
  zoom: number;
  onStopStream: () => void;
  onChangeSiteClick: () => void;
  onStartTabShare: () => void;
}

export const WebStreamStage: React.FC<WebStreamStageProps> = ({
  webStream,
  currentUser,
  participants,
  localStream,
  remoteStreams,
  peerVideoStates,
  peerAudioStates,
  isVideoOff,
  isMuted,
  isFrontCamera,
  isScreenSharing,
  screenStream,
  livePointer,
  isLaserPointerOn,
  onToggleLaserPointer,
  onPointerMove,
  onPointerLeave,
  onUpdateUrl,
  onZoomChange,
  zoom,
  onStopStream,
  onChangeSiteClick,
  onStartTabShare,
}) => {
  const [layoutMode, setLayoutMode] = useState<'split-right' | 'bottom-bar' | 'cinema'>('split-right');
  const [urlInput, setUrlInput] = useState(webStream.url);
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const isCurrentStreamer =
    webStream.streamerUsername.toLowerCase() === currentUser.username.toLowerCase();

  // Helper to reliably find the active MediaStream for the streamer
  const getStreamerMediaStream = (): MediaStream | null => {
    if (isCurrentStreamer) {
      return screenStream || localStream || null;
    }
    // 1. Exact key match
    if (remoteStreams[webStream.streamerUsername]) {
      return remoteStreams[webStream.streamerUsername];
    }
    // 2. Case-insensitive key match
    const match = Object.entries(remoteStreams).find(
      ([key]) => key.toLowerCase() === webStream.streamerUsername.toLowerCase()
    );
    if (match && match[1]) {
      return match[1];
    }
    // 3. Fallback to any remote stream with video tracks
    const all = Object.values(remoteStreams);
    const withVideo = all.find((s) => s && s.getVideoTracks().length > 0);
    if (withVideo) return withVideo;
    if (all.length > 0 && all[0]) return all[0];
    return null;
  };

  const streamerStream = getStreamerMediaStream();

  // Sync urlInput when webStream.url changes
  useEffect(() => {
    setUrlInput(webStream.url);
    setIsIframeLoading(true);
    setLoadError(false);
  }, [webStream.url]);

  // Listen for iframe navigation events to update URL and sync with call
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'WEB_STREAM_NAVIGATE' && event.data.url) {
        onUpdateUrl(event.data.url);
      }
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [onUpdateUrl]);

  // If screen sharing mode is active, bind the video track
  useEffect(() => {
    if (webStream.mode === 'screen' && screenVideoRef.current) {
      const activeStream = getStreamerMediaStream();
      if (activeStream) {
        screenVideoRef.current.srcObject = activeStream;
        const playPromise = screenVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            if (screenVideoRef.current) {
              screenVideoRef.current.muted = true;
              screenVideoRef.current.play().catch(() => {});
            }
          });
        }
      }
    }
  }, [webStream.mode, webStream.streamerUsername, isCurrentStreamer, screenStream, remoteStreams, localStream]);

  const handleCopyUrl = () => {
    if (webStream.url) {
      navigator.clipboard.writeText(webStream.url);
      setIsUrlCopied(true);
      setTimeout(() => setIsUrlCopied(false), 2000);
    }
  };

  const getIframeSrc = () => {
    if (!webStream.url) return '';
    if (webStream.mode === 'direct') {
      return webStream.url;
    }
    return `/api/web-stream/proxy?url=${encodeURIComponent(webStream.url)}`;
  };

  // Compile full participant list including current user
  const allMembers = [
    {
      user: currentUser,
      isCurrentUser: true,
      stream: localStream,
      isVideoOff,
      isMuted,
    },
    ...participants
      .filter((p) => p.username.toLowerCase() !== currentUser.username.toLowerCase())
      .map((p) => ({
        user: p,
        isCurrentUser: false,
        stream: remoteStreams[p.username] || null,
        isVideoOff: Boolean(peerVideoStates[p.username]),
        isMuted: Boolean(peerAudioStates[p.username]),
      })),
  ];

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden text-left select-none">
      {/* Top Stream Control Bar */}
      <div className="w-full px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-30 shadow-md">
        {/* Left: Stream Host Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700">
            <Cast className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="truncate max-w-[130px] sm:max-w-[180px]">
              @{webStream.streamerUsername}
            </span>
          </div>

          <span
            className={`hidden md:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
              webStream.mode === 'screen'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {webStream.mode === 'screen' ? 'Live Tab Stream' : 'Interactive Co-Browse'}
          </span>
        </div>

        {/* Center: Live URL & Navigation */}
        <div className="flex-1 max-w-md min-w-[200px] flex items-center gap-1.5">
          <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus-within:border-emerald-500">
            <Globe className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUpdateUrl(urlInput);
              }}
              placeholder="Enter website URL..."
              className="w-full bg-transparent border-none outline-none text-slate-200 text-xs truncate placeholder:text-slate-500"
            />
            <button
              onClick={() => onUpdateUrl(urlInput)}
              className="p-1 text-slate-400 hover:text-emerald-400 transition"
              title="Load URL"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reload Button */}
          <button
            onClick={() => {
              setIsIframeLoading(true);
              setIframeKey((k) => k + 1);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Web Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyUrl}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Copy Website Link"
          >
            {isUrlCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Open in external tab */}
          <a
            href={webStream.url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Open website in new browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Right Controls: Laser Pointer, Zoom, Layout Switcher, Stop */}
        <div className="flex items-center gap-1.5">
          {/* Laser Pointer */}
          <button
            onClick={onToggleLaserPointer}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              isLaserPointerOn
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 ring-2 ring-rose-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={isLaserPointerOn ? 'Laser pointer active (hover to point)' : 'Turn On Laser Pointer'}
          >
            <MousePointer className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline text-[11px]">Pointer</span>
          </button>

          {/* Zoom In / Out */}
          <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
            <button
              onClick={() => onZoomChange(-10)}
              className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="px-1 text-[11px] font-mono font-bold">{zoom}%</span>
            <button
              onClick={() => onZoomChange(10)}
              className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Layout Mode Selector (Side vs Bottom vs Cinema) */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode('split-right')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                layoutMode === 'split-right'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Side Video Panel"
            >
              Side
            </button>
            <button
              onClick={() => setLayoutMode('bottom-bar')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                layoutMode === 'bottom-bar'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Bottom Video Strip"
            >
              Bottom
            </button>
            <button
              onClick={() => setLayoutMode('cinema')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                layoutMode === 'cinema'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cinema Full Screen"
            >
              Cinema
            </button>
          </div>

          {/* Change Site Dialog Button */}
          <button
            onClick={onChangeSiteClick}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
            title="Stream another website"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Change Site</span>
          </button>

          {/* Stop Streaming Button */}
          <button
            onClick={onStopStream}
            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 hover:text-white text-rose-400 text-xs font-semibold flex items-center gap-1 transition"
            title="Stop Streaming Website"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stop</span>
          </button>
        </div>
      </div>

      {/* Main Body: Web Stream Stage + Member Video Gallery */}
      <div
        className={`flex-1 w-full relative flex overflow-hidden ${
          layoutMode === 'bottom-bar' ? 'flex-col' : 'flex-row'
        }`}
      >
        {/* ======================================================== */}
        {/* 1. THE MAIN WEBSITE STREAM VIEWPORT */}
        {/* ======================================================== */}
        <div
          onMouseMove={onPointerMove}
          onMouseLeave={onPointerLeave}
          className="flex-1 h-full relative bg-slate-950 overflow-hidden flex items-center justify-center"
        >
          {/* A. Screen / Tab Live HD Stream Mode */}
          {webStream.mode === 'screen' ? (
            <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted={true}
                className="w-full h-full object-contain bg-slate-950"
              />
              {!streamerStream && !isCurrentStreamer && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/80 p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
                    <MonitorUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      Receiving @{webStream.streamerUsername}'s Live Screen...
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Connecting live 60 FPS HD stream.
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute top-3 left-3 z-30 px-3 py-1 bg-slate-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold rounded-full backdrop-blur-md flex items-center gap-2 shadow-lg">
                <MonitorUp className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Live Browser Tab Stream • 60 FPS HD</span>
              </div>
            </div>
          ) : (
            /* B. Interactive Embedded Co-Browse View */
            <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
              {/* Loading Spinner Overlay */}
              {isIframeLoading && (
                <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-100">Connecting to Website Stream...</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{webStream.url}</p>
                  </div>
                </div>
              )}

              {/* Iframe with Zoom Container */}
              <div
                className="w-full h-full origin-top-left transition-transform duration-150"
                style={{
                  transform: `scale(${zoom / 100})`,
                  width: `${(100 / zoom) * 100}%`,
                  height: `${(100 / zoom) * 100}%`,
                }}
              >
                <iframe
                  key={iframeKey}
                  src={getIframeSrc()}
                  title={`Streamed Website - ${webStream.title || webStream.url}`}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                  allow="fullscreen; clipboard-read; clipboard-write; autoplay"
                  onLoad={() => setIsIframeLoading(false)}
                  onError={() => {
                    setIsIframeLoading(false);
                    setLoadError(true);
                  }}
                  className="w-full h-full border-0 bg-slate-950"
                />
              </div>

              {/* Fallback Action Banner if user wants direct tab stream */}
              <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2">
                <button
                  onClick={onStartTabShare}
                  className="px-3 py-1.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-emerald-500 text-slate-200 hover:text-white text-xs font-semibold rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg transition"
                  title="Share browser tab directly for 100% video/audio streaming"
                >
                  <MonitorUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Stream via Live Tab (Zero Restrictions)</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Laser Pointer Visual */}
          {livePointer && livePointer.active && (
            <div
              className="absolute z-40 pointer-events-none transition-all duration-75 flex flex-col items-center"
              style={{
                left: `${livePointer.x}%`,
                top: `${livePointer.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-5 h-5 rounded-full bg-rose-500/80 border-2 border-white shadow-[0_0_15px_#f43f5e] animate-ping" />
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-lg -mt-4" />
              <span className="mt-1 px-2 py-0.5 bg-slate-950/90 text-white text-[10px] font-bold rounded-md border border-slate-700 shadow-md whitespace-nowrap">
                📍 @{livePointer.username}
              </span>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 2. CALL MEMBERS VIDEO GALLERY (Visible in All Layouts!) */}
        {/* ======================================================== */}

        {/* A. Side Split Strip Layout */}
        {layoutMode === 'split-right' && (
          <div className="w-56 sm:w-64 bg-slate-900/95 border-l border-slate-800 p-2.5 flex flex-col gap-2.5 overflow-y-auto shrink-0 z-20 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Members ({allMembers.length})</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">● LIVE</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {allMembers.map((member) => (
                <ParticipantVideoCard
                  key={member.user.username}
                  username={member.user.username}
                  avatarUrl={member.user.avatarUrl}
                  stream={member.stream}
                  isVideoOff={member.isVideoOff}
                  isMuted={member.isMuted}
                  isCurrentUser={member.isCurrentUser}
                  isStreamer={
                    member.user.username.toLowerCase() === webStream.streamerUsername.toLowerCase()
                  }
                  isFrontCamera={isFrontCamera}
                  isScreenSharing={isScreenSharing}
                  compact={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* B. Bottom Bar Layout */}
        {layoutMode === 'bottom-bar' && (
          <div className="w-full bg-slate-900/95 border-t border-slate-800 p-2.5 flex flex-col gap-1.5 shrink-0 z-20 shadow-lg max-h-48 overflow-hidden">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Members Video Gallery ({allMembers.length})</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Synced</span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {allMembers.map((member) => (
                <div key={member.user.username} className="w-40 shrink-0">
                  <ParticipantVideoCard
                    username={member.user.username}
                    avatarUrl={member.user.avatarUrl}
                    stream={member.stream}
                    isVideoOff={member.isVideoOff}
                    isMuted={member.isMuted}
                    isCurrentUser={member.isCurrentUser}
                    isStreamer={
                      member.user.username.toLowerCase() === webStream.streamerUsername.toLowerCase()
                    }
                    isFrontCamera={isFrontCamera}
                    isScreenSharing={isScreenSharing}
                    compact={true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* C. Cinema Layout (Floating Video Cards) */}
        {layoutMode === 'cinema' && (
          <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2 max-w-[180px] pointer-events-auto">
            {allMembers.slice(0, 3).map((member) => (
              <div
                key={member.user.username}
                className="w-36 aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-950"
              >
                <ParticipantVideoCard
                  username={member.user.username}
                  avatarUrl={member.user.avatarUrl}
                  stream={member.stream}
                  isVideoOff={member.isVideoOff}
                  isMuted={member.isMuted}
                  isCurrentUser={member.isCurrentUser}
                  isStreamer={
                    member.user.username.toLowerCase() === webStream.streamerUsername.toLowerCase()
                  }
                  isFrontCamera={isFrontCamera}
                  isScreenSharing={isScreenSharing}
                  compact={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
