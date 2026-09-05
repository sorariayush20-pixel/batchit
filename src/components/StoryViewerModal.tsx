import React, { useState, useEffect, useRef } from 'react';
import { User, Story, StoryView, UserStoryGroup } from '../types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Send,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  Globe,
  Users,
  Lock,
  Heart,
  Flame,
  Laugh,
  Sparkles,
  Shield,
} from 'lucide-react';

interface StoryViewerModalProps {
  isOpen: boolean;
  userStoryGroups: UserStoryGroup[];
  initialUserIndex: number;
  currentUser: User;
  onClose: () => void;
  onViewStory: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onReplyToStory: (storyId: string, authorUsername: string, text: string) => Promise<void>;
}

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮', '🔒'];

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  userStoryGroups,
  initialUserIndex,
  currentUser,
  onClose,
  onViewStory,
  onDeleteStory,
  onReplyToStory,
}) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySentConfirmation, setReplySentConfirmation] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<any>(null);

  // Sync index when initialUserIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentUserIndex(Math.min(initialUserIndex, Math.max(0, userStoryGroups.length - 1)));
      setCurrentStoryIndex(0);
      setProgress(0);
      setShowViewersList(false);
    }
  }, [isOpen, initialUserIndex]);

  const activeGroup = userStoryGroups[currentUserIndex];
  const activeStory = activeGroup?.stories[currentStoryIndex];

  // Mark story as viewed when activeStory changes
  useEffect(() => {
    if (activeStory && isOpen) {
      onViewStory(activeStory.id);
    }
  }, [activeStory?.id, isOpen]);

  // Story Progress Timer
  useEffect(() => {
    if (!isOpen || !activeStory || isPaused || showViewersList) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    // Default duration: 5 seconds for image/text, or actual video length
    const totalDurationSeconds =
      activeStory.type === 'video'
        ? Math.min(activeStory.videoDuration || 15, 60)
        : 5.5;

    const intervalMs = 50;
    const stepIncrement = (intervalMs / (totalDurationSeconds * 1000)) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isOpen, activeStory?.id, isPaused, showViewersList, currentUserIndex, currentStoryIndex]);

  if (!isOpen || !activeGroup || !activeStory) return null;

  const isOwner = activeStory.username.toLowerCase() === currentUser.username.toLowerCase();

  const handleNextStory = () => {
    setProgress(0);
    if (currentStoryIndex < activeGroup.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else if (currentUserIndex < userStoryGroups.length - 1) {
      setCurrentUserIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    setProgress(0);
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex((prev) => prev - 1);
      setCurrentStoryIndex(userStoryGroups[currentUserIndex - 1].stories.length - 1);
    }
  };

  const handleSendReply = async (textToSend: string) => {
    if (!textToSend.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      await onReplyToStory(activeStory.id, activeStory.username, textToSend.trim());
      setReplyText('');
      setReplySentConfirmation(true);
      setTimeout(() => setReplySentConfirmation(false), 2000);
    } catch (e) {
      console.warn('Failed to reply to story:', e);
    } finally {
      setIsSendingReply(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diffMin = Math.round((Date.now() - timestamp) / (60 * 1000));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return '24h ago';
  };

  const calculateHoursRemaining = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return `${hours}h left`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in select-none">
      {/* Outer Click to Next/Prev for Desktop Nav */}
      <button
        onClick={handlePrevStory}
        disabled={currentUserIndex === 0 && currentStoryIndex === 0}
        className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 items-center justify-center transition shadow-2xl disabled:opacity-30 disabled:pointer-events-none z-20"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={handleNextStory}
        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 items-center justify-center transition shadow-2xl z-20"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main Story Phone Canvas */}
      <div
        className="relative w-full max-w-sm md:max-w-md h-[94dvh] max-h-[820px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Segment Bars */}
        <div className="absolute top-0 left-0 right-0 p-3.5 z-30 space-y-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex gap-1.5 w-full">
            {activeGroup.stories.map((s, idx) => {
              let fillPercent = 0;
              if (idx < currentStoryIndex) fillPercent = 100;
              else if (idx === currentStoryIndex) fillPercent = progress;
              return (
                <div
                  key={s.id}
                  className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  activeStory.userAvatar ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${activeStory.username}`
                }
                alt={activeStory.username}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 shadow-md bg-slate-800"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-tight">
                    @{activeStory.username}
                  </span>
                  {isOwner && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono border border-emerald-500/30">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-300">
                  <span>{formatTimeAgo(activeStory.createdAt)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {activeStory.privacy === 'public' ? (
                      <>
                        <Globe className="w-2.5 h-2.5 text-emerald-400" /> Public
                      </>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5 text-teal-400" /> Selected
                      </>
                    )}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-mono">
                    {calculateHoursRemaining(activeStory.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-1.5 z-40">
              {activeStory.type === 'video' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-md"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              {isOwner && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this story?')) {
                      await onDeleteStory(activeStory.id);
                      if (activeGroup.stories.length <= 1) {
                        onClose();
                      } else {
                        handleNextStory();
                      }
                    }
                  }}
                  className="p-2 rounded-full bg-black/40 text-rose-400 hover:bg-rose-600 hover:text-white transition backdrop-blur-md"
                  title="Delete Story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tap Hotspots for Left/Right Story Navigation */}
        <div
          onClick={handlePrevStory}
          className="absolute left-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
        />
        <div
          onClick={handleNextStory}
          className="absolute right-0 top-16 bottom-20 w-2/3 z-20 cursor-pointer"
        />

        {/* Main Story Content Body */}
        <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative">
          {activeStory.type === 'image' && activeStory.mediaUrl && (
            <img
              src={activeStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover animate-in zoom-in-95 duration-200"
            />
          )}

          {activeStory.type === 'video' && activeStory.mediaUrl && (
            <video
              ref={videoRef}
              src={activeStory.mediaUrl}
              autoPlay
              playsInline
              loop
              muted={isMuted}
              className="w-full h-full object-cover"
            />
          )}

          {activeStory.type === 'text' && (
            <div
              className={`w-full h-full flex items-center justify-center p-8 text-center bg-gradient-to-tr ${
                activeStory.textStyle?.backgroundGradient || 'from-emerald-600 to-teal-800'
              }`}
            >
              <p
                className={`font-semibold text-white drop-shadow-lg break-words max-w-full leading-relaxed ${
                  activeStory.textStyle?.fontSize === 'sm'
                    ? 'text-base'
                    : activeStory.textStyle?.fontSize === 'base'
                    ? 'text-lg'
                    : activeStory.textStyle?.fontSize === 'xl'
                    ? 'text-2xl md:text-3xl'
                    : 'text-xl md:text-2xl'
                }`}
              >
                {activeStory.caption || ''}
              </p>
            </div>
          )}

          {/* Caption Overlay for Image/Video stories */}
          {activeStory.type !== 'text' && activeStory.caption && (
            <div className="absolute bottom-20 left-4 right-4 z-20 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs text-center drop-shadow-md">
              {activeStory.caption}
            </div>
          )}
        </div>

        {/* Bottom Interactive Bar */}
        <div className="relative z-30 p-3.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          {isOwner ? (
            /* Author Controls: Viewers Counter & Drawer */
            <div className="flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewersList(!showViewersList);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold backdrop-blur-md transition shadow-lg"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>
                  {activeStory.views.length}{' '}
                  {activeStory.views.length === 1 ? 'Viewer' : 'Viewers'}
                </span>
              </button>

              <div className="text-[11px] text-slate-400 font-mono">
                {currentStoryIndex + 1} of {activeGroup.stories.length}
              </div>
            </div>
          ) : (
            /* Viewer Controls: Quick Emojis & Direct Reply */
            <div className="space-y-2">
              {/* Quick Emojis */}
              <div className="flex items-center justify-around px-2">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendReply(emoji);
                    }}
                    className="text-xl hover:scale-125 active:scale-95 transition transform duration-150 p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Direct Reply Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendReply(replyText);
                    }
                  }}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={`Reply to @${activeStory.username}...`}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 backdrop-blur-md"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendReply(replyText);
                  }}
                  disabled={!replyText.trim() || isSendingReply}
                  className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {replySentConfirmation && (
                <div className="text-center text-[11px] text-emerald-400 font-semibold animate-in fade-in">
                  ✓ Reply sent to DM!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewers List Drawer (for Story Author) */}
        {isOwner && showViewersList && (
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl rounded-t-2xl z-40 p-4 flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-100">
                  Story Viewers ({activeStory.views.length})
                </h4>
              </div>
              <button
                onClick={() => setShowViewersList(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-2 space-y-2 custom-scrollbar">
              {activeStory.views.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No views yet. When people view your story, they'll appear here.
                </div>
              ) : (
                activeStory.views.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          v.userAvatar ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${v.username}`
                        }
                        alt={v.username}
                        className="w-7 h-7 rounded-full object-cover bg-slate-800"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        @{v.username}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatTimeAgo(v.viewedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
