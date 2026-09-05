import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { X, Search, UserCheck, UserPlus, MessageSquare, Users, Loader2 } from 'lucide-react';
import { User } from '../types';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername: string;
  initialType?: 'followers' | 'following';
  currentUser: User | null;
  socket: Socket | null;
  onStartChat?: (username: string) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  targetUsername,
  initialType = 'followers',
  currentUser,
  socket,
  onStartChat,
}) => {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialType);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followActionLoading, setFollowActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
    }
  }, [isOpen, initialType]);

  const loadList = React.useCallback(() => {
    if (!socket || !targetUsername) return;
    setLoading(true);

    socket.emit('follow:get_list', { targetUsername, type: activeTab }, (res: User[]) => {
      setLoading(false);
      if (Array.isArray(res)) {
        setUsers(res);
      } else {
        setUsers([]);
      }
    });
  }, [socket, targetUsername, activeTab]);

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen, activeTab, loadList]);

  const handleToggleFollow = (uname: string, currentStatus: boolean) => {
    if (!socket || !currentUser || followActionLoading) return;
    setFollowActionLoading(uname);

    const event = currentStatus ? 'unfollow:user' : 'follow:user';
    socket.emit(event, { targetUsername: uname }, (res: any) => {
      setFollowActionLoading(null);
      if (res?.success) {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.username.toLowerCase() === uname.toLowerCase()) {
              return {
                ...u,
                isFollowing: !currentStatus,
                followersCount: Math.max(0, (u.followersCount || 0) + (currentStatus ? -1 : 1)),
              };
            }
            return u;
          })
        );
      }
    });
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.statusText && u.statusText.toLowerCase().includes(q)) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        id="follow-list-modal"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-100">
              @{targetUsername}'s Connections
            </h3>
          </div>
          <button
            id="close-follow-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-2 bg-slate-950/60 border-b border-slate-800/80 gap-2">
          <button
            id="tab-followers-btn"
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'followers'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Followers
          </button>
          <button
            id="tab-following-btn"
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'following'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Following
          </button>
        </div>

        {/* Search filter */}
        <div className="p-3 border-b border-slate-800/60 bg-slate-900/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="follow-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/70 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <p className="text-xs">Loading connections...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
              <Users className="w-8 h-8 opacity-30" />
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No matching users found' : `No ${activeTab} yet`}
              </p>
              <p className="text-xs text-slate-500">
                {activeTab === 'followers'
                  ? `@${targetUsername} has no followers yet.`
                  : `@${targetUsername} is not following anyone yet.`}
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = currentUser?.username.toLowerCase() === u.username.toLowerCase();
              return (
                <div
                  key={u.username}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <img
                        src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                        alt={u.username}
                        className="w-10 h-10 rounded-full border border-slate-700 object-cover bg-slate-800"
                      />
                      {u.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          @{u.username}
                        </span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded-md">
                            You
                          </span>
                        )}
                      </div>
                      {u.statusText && (
                        <p className="text-xs text-slate-400 truncate max-w-[180px]">
                          {u.statusText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {!isSelf && onStartChat && (
                      <button
                        id={`msg-user-${u.username}`}
                        title="Send Message"
                        onClick={() => {
                          onStartChat(u.username);
                          onClose();
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {!isSelf && currentUser && (
                      <button
                        id={`follow-toggle-${u.username}`}
                        disabled={followActionLoading === u.username}
                        onClick={() => handleToggleFollow(u.username, Boolean(u.isFollowing))}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          u.isFollowing
                            ? 'bg-slate-800 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 border border-slate-700'
                            : 'bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 shadow-sm'
                        }`}
                      >
                        {followActionLoading === u.username ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : u.isFollowing ? (
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
