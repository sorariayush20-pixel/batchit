import React, { useState, useRef } from 'react';
import { User, Story } from '../types';
import {
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  Type,
  Globe,
  Users,
  Check,
  Search,
  Sparkles,
  Clock,
  AlertCircle,
  Play,
  Pause,
  Upload,
  Lock,
  ChevronRight,
  Smile,
} from 'lucide-react';

interface CreateStoryModalProps {
  isOpen: boolean;
  currentUser: User;
  publicUsers: User[];
  onClose: () => void;
  onSubmitStory: (storyData: {
    type: 'image' | 'text' | 'video';
    mediaUrl?: string;
    videoDuration?: number;
    caption?: string;
    textStyle?: {
      backgroundGradient: string;
      textColor?: string;
      fontSize?: 'sm' | 'base' | 'lg' | 'xl';
    };
    privacy: 'public' | 'selected';
    allowedUsernames?: string[];
  }) => Promise<void>;
}

const GRADIENT_PRESETS = [
  { id: 'sunset', name: 'Sunset Glow', class: 'from-amber-500 via-rose-500 to-purple-600' },
  { id: 'aurora', name: 'Emerald Aurora', class: 'from-emerald-600 via-teal-600 to-cyan-700' },
  { id: 'midnight', name: 'Midnight Violet', class: 'from-indigo-900 via-purple-900 to-slate-950' },
  { id: 'cyber', name: 'Cyber Teal', class: 'from-cyan-500 via-blue-600 to-indigo-900' },
  { id: 'berry', name: 'Neon Berry', class: 'from-fuchsia-600 via-pink-600 to-rose-700' },
  { id: 'dark', name: 'Titanium Dark', class: 'from-slate-900 via-slate-950 to-black' },
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  currentUser,
  publicUsers,
  onClose,
  onSubmitStory,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'text'>('image');
  const [caption, setCaption] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0].class);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');
  
  // Media state
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audience / Privacy state
  const [privacy, setPrivacy] = useState<'public' | 'selected'>('public');
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  // Filter available contacts for selection
  const availableUsers = (publicUsers || []).filter(
    (u) => u && u.username && u.username.toLowerCase() !== currentUser.username.toLowerCase()
  );

  const filteredUsers = availableUsers.filter((u) => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.statusText && u.statusText.toLowerCase().includes(q))
    );
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError(null);

    if (activeTab === 'image') {
      if (!file.type.startsWith('image/')) {
        setVideoError('Please upload a valid image file (PNG, JPEG, WebP, GIF)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setMediaPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (activeTab === 'video') {
      if (!file.type.startsWith('video/')) {
        setVideoError('Please upload a valid video file (MP4, WebM, MOV)');
        return;
      }

      // Check file size (max ~20MB)
      if (file.size > 25 * 1024 * 1024) {
        setVideoError('Video file size exceeds 25MB limit. Please choose a shorter or compressed video.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setMediaPreview(dataUrl);

        // Check video duration via hidden video element
        const tempVideo = document.createElement('video');
        tempVideo.src = dataUrl;
        tempVideo.onloadedmetadata = () => {
          const duration = Math.round(tempVideo.duration);
          setVideoDuration(duration);
          if (duration > 60) {
            setVideoError(`Video duration is ${duration}s. Stories support a maximum of 60 seconds (1 minute).`);
          } else {
            setVideoError(null);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleUserSelection = (username: string) => {
    setSelectedUsernames((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleSelectAllUsers = () => {
    setSelectedUsernames(availableUsers.map((u) => u.username));
  };

  const handleDeselectAllUsers = () => {
    setSelectedUsernames([]);
  };

  const handleSubmit = async () => {
    if (activeTab === 'image' && !mediaPreview) {
      setVideoError('Please select or upload an image for your story');
      return;
    }

    if (activeTab === 'video') {
      if (!mediaPreview) {
        setVideoError('Please upload a video for your story');
        return;
      }
      if (videoDuration > 60) {
        setVideoError('Videos must be 60 seconds or less.');
        return;
      }
    }

    if (activeTab === 'text' && !textContent.trim()) {
      setVideoError('Please type some text for your status story');
      return;
    }

    if (privacy === 'selected' && selectedUsernames.length === 0) {
      setVideoError('Please choose at least 1 person to share this private story with');
      setShowAudiencePicker(true);
      return;
    }

    setIsSubmitting(true);
    setVideoError(null);

    try {
      if (activeTab === 'text') {
        await onSubmitStory({
          type: 'text',
          caption: textContent.trim(),
          textStyle: {
            backgroundGradient: selectedGradient,
            textColor: '#FFFFFF',
            fontSize,
          },
          privacy,
          allowedUsernames: privacy === 'selected' ? selectedUsernames : [],
        });
      } else {
        await onSubmitStory({
          type: activeTab,
          mediaUrl: mediaPreview || undefined,
          videoDuration: activeTab === 'video' ? videoDuration : undefined,
          caption: caption.trim() || undefined,
          privacy,
          allowedUsernames: privacy === 'selected' ? selectedUsernames : [],
        });
      }
      onClose();
    } catch (err: any) {
      setVideoError(err.message || 'Failed to post story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Create 24h Story
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 24 Hours
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Share a moment visible to your audience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Format Tabs: Image / Video / Text */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('image');
                setMediaPreview(null);
                setVideoError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'image'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Photo
            </button>
            <button
              onClick={() => {
                setActiveTab('video');
                setMediaPreview(null);
                setVideoError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'video'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5" />
              Video (Max 1m)
            </button>
            <button
              onClick={() => {
                setActiveTab('text');
                setMediaPreview(null);
                setVideoError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'text'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text Status
            </button>
          </div>

          {/* Error / Alert banner */}
          {videoError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-400 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{videoError}</span>
            </div>
          )}

          {/* Mode 1 & 2: Image or Video Upload Canvas */}
          {(activeTab === 'image' || activeTab === 'video') && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept={activeTab === 'image' ? 'image/*' : 'video/mp4,video/webm,video/quicktime'}
                className="hidden"
                onChange={handleFileUpload}
              />

              {mediaPreview ? (
                <div className="relative rounded-xl overflow-hidden bg-black/60 border border-slate-800 aspect-[9/14] max-h-72 flex items-center justify-center group mx-auto">
                  {activeTab === 'image' ? (
                    <img
                      src={mediaPreview}
                      alt="Story Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      src={mediaPreview}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                  <button
                    onClick={() => {
                      setMediaPreview(null);
                      setVideoDuration(0);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 text-rose-400 hover:bg-rose-500 hover:text-white transition shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {activeTab === 'video' && videoDuration > 0 && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                      Duration: {videoDuration}s / 60s
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/70 transition rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Click or Drag to Upload {activeTab === 'image' ? 'Photo' : 'Video'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activeTab === 'image'
                      ? 'Supports PNG, JPG, GIF, WebP'
                      : 'Supports MP4, WebM up to 60 seconds (1 min)'}
                  </p>
                </div>
              )}

              {/* Caption Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Add Caption (Optional)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Type a caption for your story..."
                  maxLength={160}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          )}

          {/* Mode 3: Text Status Story Canvas */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              {/* Preview Canvas */}
              <div
                className={`relative rounded-xl overflow-hidden aspect-[9/13] max-h-64 p-6 flex items-center justify-center text-center bg-gradient-to-tr ${selectedGradient} shadow-inner mx-auto`}
              >
                <p
                  className={`font-semibold text-white break-words max-w-full drop-shadow-md ${
                    fontSize === 'sm'
                      ? 'text-sm'
                      : fontSize === 'base'
                      ? 'text-base'
                      : fontSize === 'lg'
                      ? 'text-lg'
                      : 'text-xl'
                  }`}
                >
                  {textContent || 'Type your status below...'}
                </p>
              </div>

              {/* Text Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Status Text
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="What's on your mind?..."
                  maxLength={280}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              {/* Gradient Themes */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Background Theme
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedGradient(preset.class)}
                      className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${preset.class} flex-shrink-0 border-2 transition ${
                        selectedGradient === preset.class
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Font Size Selector */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Text Size:</span>
                <div className="flex gap-1.5">
                  {(['sm', 'base', 'lg', 'xl'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFontSize(s)}
                      className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold transition ${
                        fontSize === s
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audience / Privacy Selector */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Who can view this story?
              </span>
              {privacy === 'selected' && (
                <button
                  onClick={() => setShowAudiencePicker(!showAudiencePicker)}
                  className="text-[11px] text-emerald-400 hover:underline font-medium"
                >
                  {showAudiencePicker ? 'Hide Contacts' : `Choose People (${selectedUsernames.length})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPrivacy('public');
                  setShowAudiencePicker(false);
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                  privacy === 'public'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">Public</div>
                  <div className="text-[10px] text-slate-400">All users in app</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrivacy('selected');
                  setShowAudiencePicker(true);
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                  privacy === 'selected'
                    ? 'border-teal-500/50 bg-teal-500/10 text-teal-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">Selected People</div>
                  <div className="text-[10px] text-slate-400">
                    {selectedUsernames.length > 0
                      ? `${selectedUsernames.length} selected`
                      : 'Choose contacts'}
                  </div>
                </div>
              </button>
            </div>

            {/* Expanded Audience Picker */}
            {privacy === 'selected' && showAudiencePicker && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Select contacts who can view:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      className="text-emerald-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllUsers}
                      className="text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search Contacts */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users to add..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* User List */}
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-500">
                      No contacts found
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUsernames.includes(u.username);
                      return (
                        <div
                          key={u.username}
                          onClick={() => handleToggleUserSelection(u.username)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-slate-900/40 hover:bg-slate-900 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                u.avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`
                              }
                              alt={u.username}
                              className="w-6 h-6 rounded-full object-cover bg-slate-800"
                            />
                            <span className="text-xs text-slate-200 font-medium">
                              @{u.username}
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Posting Story...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Share Story (24h)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
