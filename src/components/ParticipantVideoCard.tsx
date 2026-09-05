import React, { useEffect, useRef } from 'react';
import { MicOff, Video, VideoOff, Crown } from 'lucide-react';

export interface ParticipantVideoCardProps {
  username: string;
  avatarUrl?: string;
  stream?: MediaStream | null;
  isVideoOff?: boolean;
  isMuted?: boolean;
  isCurrentUser?: boolean;
  isStreamer?: boolean;
  isFrontCamera?: boolean;
  isScreenSharing?: boolean;
  compact?: boolean;
  className?: string;
}

export const ParticipantVideoCard: React.FC<ParticipantVideoCardProps> = ({
  username,
  avatarUrl,
  stream,
  isVideoOff,
  isMuted,
  isCurrentUser,
  isStreamer,
  isFrontCamera,
  isScreenSharing,
  compact = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hasActiveVideoTrack = Boolean(
    !isVideoOff &&
      stream &&
      stream.getVideoTracks().length > 0 &&
      stream.getVideoTracks().some((t) => t.enabled)
  );

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isVideoOff, hasActiveVideoTrack]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-md group flex items-center justify-center transition-all duration-200 ${
        compact ? 'aspect-[4/3] w-full min-h-[100px]' : 'aspect-video w-full min-h-[120px]'
      } ${className}`}
    >
      {hasActiveVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className={`w-full h-full object-cover ${
            isCurrentUser && isFrontCamera && !isScreenSharing ? 'scale-x-[-1]' : ''
          }`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-slate-900 to-slate-950">
          <div className="relative">
            <img
              src={
                avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
              }
              alt={username}
              className={`${
                compact ? 'w-9 h-9' : 'w-12 h-12'
              } rounded-full border-2 border-slate-700 object-cover shadow-md`}
            />
            {isMuted && (
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-rose-500 rounded-full text-white shadow">
                <MicOff className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
          <span className="text-[11px] font-semibold text-slate-200 mt-1.5 truncate max-w-[110px]">
            {isCurrentUser ? 'You' : username}
          </span>
          <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
            {isVideoOff ? (
              <>
                <VideoOff className="w-2.5 h-2.5 text-slate-500" /> Cam Off
              </>
            ) : (
              'Connecting...'
            )}
          </span>
        </div>
      )}

      {/* Name and Host Tag */}
      <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1">
        <span className="px-1.5 py-0.5 bg-slate-950/85 backdrop-blur-md text-slate-200 text-[10px] font-semibold rounded-md border border-slate-800 flex items-center gap-1 shadow truncate max-w-[120px]">
          {isCurrentUser ? 'You' : `@${username}`}
          {isStreamer && (
            <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[8px] font-bold rounded flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" /> HOST
            </span>
          )}
        </span>
      </div>

      {/* Status Icons on Top-Right */}
      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
        {isMuted && (
          <span className="p-1 bg-rose-500/90 text-white rounded-md shadow" title="Microphone Muted">
            <MicOff className="w-3 h-3" />
          </span>
        )}
        {hasActiveVideoTrack && (
          <span className="p-1 bg-emerald-500/80 text-white rounded-md shadow" title="Live Video">
            <Video className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
};
