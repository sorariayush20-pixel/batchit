import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { User, FollowStats } from '../types';
import {
  X,
  ShieldCheck,
  Edit2,
  Check,
  Globe,
  Trash2,
  AlertTriangle,
  Phone,
  Video,
  MessageSquare,
  UserCheck,
  UserPlus,
  Loader2,
  Flame,
  Users,
} from 'lucide-react';

interface UserProfileModalProps {
  user: User;
  isSelf: boolean;
  currentUser?: User | null;
  socket?: Socket | null;
  onClose: () => void;
  onUpdateSelf?: (updates: { avatarUrl?: string; statusText?: string; bio?: string }) => void;
  onStartDm?: (username: string) => void;
  onStartVoiceCall?: (user: User) => void;
  onStartVideoCall?: (user: User) => void;
  onDeleteAccount?: () => void;
  onOpenFollowList?: (username: string, type: 'followers' | 'following') => void;
  onViewPosts?: (username: string) => void;
}

const AVATAR_SEEDS = ['CyberNova', 'AlexDev', 'SophiaKey', 'Zenith', 'EchoVibe', 'AstroMind', 'QuantumX', 'PixelArt'];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isSelf,
  currentUser,
  socket,
  onClose,
  onUpdateSelf,
  onStartDm,
  onStartVoiceCall,
  onStartVideoCall,
  onDeleteAccount,
  onOpenFollowList,
  onViewPosts,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [statusText, setStatusText] = useState(user.statusText || '');
  const [bio, setBio] = useState(user.bio || '');
  const [selectedSeed, setSelectedSeed] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmUsernameInput, setConfirmUsernameInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Live follow stats & status
  const [followersCount, setFollowersCount] = useState<number>(user.followersCount || 0);
  const [followingCount, setFollowingCount] = useState<number>(user.followingCount || 0);
  const [postsCount, setPostsCount] = useState<number>(user.postsCount || 0);
  const [isFollowing, setIsFollowing] = useState<boolean>(Boolean(user.isFollowing));
  const [followLoading, setFollowLoading] = useState<boolean>(false);

  // Fetch fresh follow stats from socket
  useEffect(() => {
    if (socket && user.username) {
      socket.emit('follow:get_stats', { targetUsername: user.username }, (stats: FollowStats) => {
        if (stats) {
          setFollowersCount(stats.followersCount);
          setFollowingCount(stats.followingCount);
          setIsFollowing(Boolean(stats.isFollowing));
        }
      });
      socket.emit('post:list', { filter: 'user', targetUsername: user.username }, (posts: any[]) => {
        if (Array.isArray(posts)) {
          setPostsCount(posts.length);
        }
      });
    }
  }, [socket, user.username]);

  const handleToggleFollow = () => {
    if (!socket || !currentUser || followLoading || isSelf) return;
    setFollowLoading(true);

    const event = isFollowing ? 'unfollow:user' : 'follow:user';
    socket.emit(event, { targetUsername: user.username }, (res: any) => {
      setFollowLoading(false);
      if (res?.success) {
        setIsFollowing(!isFollowing);
        setFollowersCount((prev) => Math.max(0, prev + (isFollowing ? -1 : 1)));
      }
    });
  };

  const handleSave = () => {
    if (onUpdateSelf) {
      onUpdateSelf({
        statusText,
        bio,
        avatarUrl: selectedSeed
          ? `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedSeed}`
          : user.avatarUrl,
      });
    }
    setIsEditing(false);
  };

  const handleDeleteAccount = () => {
    if (confirmUsernameInput.trim().toLowerCase() !== user.username.toLowerCase()) {
      return;
    }
    setIsDeleting(true);
    if (onDeleteAccount) {
      onDeleteAccount();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Cover Banner */}
        <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 relative" />

        {/* Profile Content */}
        <div className="p-6 pt-0 relative">
          {/* Avatar Header */}
          <div className="flex justify-between items-end -mt-12 mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-slate-900 bg-slate-950 p-1 shadow-xl overflow-hidden">
                <img
                  src={
                    selectedSeed
                      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedSeed}`
                      : user.avatarUrl
                  }
                  alt={user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div
                className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-slate-900 ${
                  user.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
            </div>

            {isSelf ? (
              <button
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              >
                {isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                {/* Follow / Unfollow Button */}
                {currentUser && (
                  <button
                    id={`profile-follow-btn-${user.username}`}
                    disabled={followLoading}
                    onClick={handleToggleFollow}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                      isFollowing
                        ? 'bg-slate-800 text-slate-200 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}

                {onStartVoiceCall && (
                  <button
                    onClick={() => {
                      onClose();
                      onStartVoiceCall(user);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-emerald-400 border border-slate-700 transition flex items-center gap-1 text-xs font-semibold"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                )}
                {onStartVideoCall && (
                  <button
                    onClick={() => {
                      onClose();
                      onStartVideoCall(user);
                    }}
                    className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition flex items-center gap-1 text-xs font-semibold"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    onClose();
                    if (onStartDm) onStartDm(user.username);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-100">@{user.username}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                  <Globe className="w-3 h-3" />
                  Public Directory
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {user.isOnline
                  ? '🟢 Online now'
                  : `⚪ Last active ${new Date(user.lastSeen).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
              </p>
            </div>

            {/* Social Followers / Following / Posts Counts Row */}
            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
              <button
                type="button"
                id="view-followers-btn"
                onClick={() => onOpenFollowList?.(user.username, 'followers')}
                className="p-1 hover:bg-slate-900 rounded-lg transition-colors group"
              >
                <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                  {followersCount}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Followers</div>
              </button>

              <button
                type="button"
                id="view-following-btn"
                onClick={() => onOpenFollowList?.(user.username, 'following')}
                className="p-1 hover:bg-slate-900 rounded-lg transition-colors group"
              >
                <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                  {followingCount}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Following</div>
              </button>

              <button
                type="button"
                id="view-posts-btn"
                onClick={() => {
                  onClose();
                  onViewPosts?.(user.username);
                }}
                className="p-1 hover:bg-slate-900 rounded-lg transition-colors group"
              >
                <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                  {postsCount}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Posts</div>
              </button>
            </div>

            {/* Editing Avatar */}
            {isEditing && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-2">
                  Change Avatar Style
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {AVATAR_SEEDS.map((seed) => (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setSelectedSeed(seed)}
                      className="p-1 rounded-lg border border-slate-800 hover:border-emerald-500 bg-slate-900 flex-shrink-0"
                    >
                      <img
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`}
                        alt={seed}
                        className="w-7 h-7 rounded-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status Text */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Status
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none focus:border-emerald-500"
                />
              ) : (
                <div className="p-2.5 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl">
                  {user.statusText || 'No status set'}
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                About
              </label>
              {isEditing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none focus:border-emerald-500"
                />
              ) : (
                <div className="p-2.5 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl">
                  {user.bio || 'No bio provided.'}
                </div>
              )}
            </div>

            {/* Security / Public Key Info */}
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  E2EE Safety Fingerprint
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">RSA-2048</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 break-all select-all">
                {user.keyFingerprint || 'SHA256: 3F:A9:B2:11:88:EC:99:AA'}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Compare this safety number with the recipient to verify identity and end-to-end encryption integrity.
              </p>
            </div>

            {/* Danger Zone: Delete Account (Only for self) */}
            {isSelf && onDeleteAccount && (
              <div className="pt-2 border-t border-rose-950/40">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account Permanently</span>
                  </button>
                ) : (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-start gap-2 text-rose-400">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-300">Confirm Account Deletion</h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                          This will permanently delete your account (<span className="font-bold text-rose-400">@{user.username}</span>), credentials, and cryptographic keys. This action cannot be undone.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Type <span className="font-bold text-slate-200">{user.username}</span> to confirm:
                      </label>
                      <input
                        type="text"
                        value={confirmUsernameInput}
                        onChange={(e) => setConfirmUsernameInput(e.target.value)}
                        placeholder={user.username}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-rose-500/40 text-slate-100 text-xs rounded-lg outline-none focus:border-rose-500 placeholder-slate-600"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setConfirmUsernameInput('');
                        }}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={confirmUsernameInput.trim().toLowerCase() !== user.username.toLowerCase() || isDeleting}
                        className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
