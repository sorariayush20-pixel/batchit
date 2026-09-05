import React, { useState } from 'react';
import { User, Chat, UserStoryGroup } from '../types';
import { StoriesTray } from './StoriesTray';
import {
  Search,
  MessageSquare,
  Users,
  Shield,
  Plus,
  Lock,
  Globe,
  Circle,
  Key,
  UserCheck,
  ChevronRight,
  Sparkles,
  LogOut,
  Info,
  Trash2,
  Smartphone,
  Download,
  Crown,
  ShieldAlert,
  Flame,
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  chats: Chat[];
  publicUsers: User[];
  userStoryGroups?: UserStoryGroup[];
  onOpenCreateStory?: () => void;
  onOpenStoryViewer?: (groupIndex: number) => void;
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  onStartDm: (targetUsername: string) => void;
  onOpenCreateGroup: () => void;
  onOpenProfile: (user: User) => void;
  onOpenSecurityModal: () => void;
  onOpenAboutModal?: () => void;
  onOpenAndroidInstallModal?: () => void;
  onOpenAdminPanel?: () => void;
  onLogout?: () => void;
  onSearchUsers?: (query: string) => void;
  isSocketConnected: boolean;
  onDeleteChat?: (chatId: string) => void;
  onOpenFeed?: () => void;
  isFeedActive?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  chats,
  publicUsers,
  userStoryGroups = [],
  onOpenCreateStory,
  onOpenStoryViewer,
  activeChatId,
  onSelectChat,
  onStartDm,
  onOpenCreateGroup,
  onOpenProfile,
  onOpenSecurityModal,
  onOpenAboutModal,
  onOpenAndroidInstallModal,
  onOpenAdminPanel,
  onLogout,
  onSearchUsers,
  isSocketConnected,
  onDeleteChat,
  onOpenFeed,
  isFeedActive,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'directory' | 'groups'>('chats');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (onSearchUsers) {
      onSearchUsers(val);
    }
  };

  const handleTabChange = (tab: 'chats' | 'directory' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'directory' && onSearchUsers) {
      onSearchUsers(searchQuery);
    }
  };

  // Filter public directory users safely
  const filteredUsers = (publicUsers || []).filter((u) => {
    if (!u || !u.username || !currentUser?.username) return false;
    if (u.username.toLowerCase() === currentUser.username.toLowerCase()) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const unameMatch = u.username.toLowerCase().includes(q);
    const statusMatch = Boolean(u.statusText && u.statusText.toLowerCase().includes(q));
    const bioMatch = Boolean(u.bio && u.bio.toLowerCase().includes(q));
    return unameMatch || statusMatch || bioMatch;
  });

  // Filter chats safely
  const filteredChats = (chats || []).filter((c) => {
    if (!c) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = Boolean(c.name && c.name.toLowerCase().includes(q));
    const msgMatch = Boolean(c.lastMessage?.text && c.lastMessage.text.toLowerCase().includes(q));
    return nameMatch || msgMatch;
  });

  const groupChats = filteredChats.filter((c) => c.type === 'group');

  return (
    <div
      className={`w-full md:w-80 lg:w-96 bg-slate-950 border-r border-slate-800/80 flex-col h-full select-none ${
        activeChatId || isFeedActive ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          {/* App Branding */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 fill-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                <span>Batchit</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  E2EE
                </span>
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{isSocketConnected ? 'Real-time Connected' : 'Reconnecting...'}</span>
              </div>
            </div>
          </div>

          {/* Key Vault Trigger, Admin Panel, About, Android APK & Logout */}
          <div className="flex items-center gap-1.5">
            {onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 transition border border-amber-500/30 shadow-sm shadow-amber-500/10 flex items-center gap-1"
                title="Open Batchit Superadmin Control Panel"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold hidden xl:inline text-amber-300">Admin</span>
              </button>
            )}

            {onOpenAndroidInstallModal && (
              <button
                onClick={onOpenAndroidInstallModal}
                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition border border-emerald-500/30 shadow-sm shadow-emerald-500/10 flex items-center gap-1"
                title="Android App & APK Download / Install"
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px] font-bold hidden sm:inline">APK</span>
              </button>
            )}

            {onOpenAboutModal && (
              <button
                onClick={onOpenAboutModal}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition border border-slate-700/60"
                title="About Us & Contact"
              >
                <Info className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenSecurityModal}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition border border-slate-700/60"
              title="View Security & E2EE Vault"
            >
              <Key className="w-4 h-4" />
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 transition border border-slate-700/60"
                title="Log Out of Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* Current User Pill */}
        <div
          onClick={() => onOpenProfile(currentUser)}
          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex-shrink-0">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="w-8 h-8 rounded-full border border-slate-800 object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-200 truncate">@{currentUser.username}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser.statusText || 'Online & Public'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search users, chats, or public directory..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500/80 text-xs text-slate-200 rounded-xl outline-none transition placeholder-slate-500"
          />
        </div>
      </div>

      {/* 24-Hour Stories Tray */}
      {onOpenCreateStory && onOpenStoryViewer && (
        <StoriesTray
          currentUser={currentUser}
          userStoryGroups={userStoryGroups}
          onOpenCreateStory={onOpenCreateStory}
          onOpenStoryViewer={onOpenStoryViewer}
        />
      )}

      {/* Tabs */}
      <div className="px-3 pt-1 pb-2 grid grid-cols-4 gap-1 border-b border-slate-800/60">
        <button
          id="tab-chats-btn"
          onClick={() => handleTabChange('chats')}
          className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
            activeTab === 'chats' && !isFeedActive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Chats</span>
          {chats.length > 0 && (
            <span className="px-1 py-0.2 rounded-full bg-slate-800 text-[10px]">
              {chats.length}
            </span>
          )}
        </button>

        <button
          id="tab-feed-btn"
          onClick={() => {
            if (onOpenFeed) onOpenFeed();
          }}
          className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
            isFeedActive
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-emerald-400" />
          <span>Feed</span>
        </button>

        <button
          id="tab-directory-btn"
          onClick={() => handleTabChange('directory')}
          className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
            activeTab === 'directory' && !isFeedActive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="truncate">Users</span>
        </button>

        <button
          id="tab-groups-btn"
          onClick={() => handleTabChange('groups')}
          className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
            activeTab === 'groups' && !isFeedActive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Groups</span>
        </button>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* TAB 1: CHATS */}
        {activeTab === 'chats' && (
          <>
            {filteredChats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs">No active chats yet.</p>
                <p className="text-[11px] text-slate-400">
                  Search for a username or check the Public Directory tab to start a secure E2EE chat!
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <div
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isActive
                        ? 'border-emerald-500/50 bg-slate-900 text-slate-100 shadow-md'
                        : 'border-transparent hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            chat.avatarUrl ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${chat.name}`
                          }
                          alt={chat.name}
                          className="w-10 h-10 rounded-full border border-slate-800 object-cover"
                        />
                        {chat.type === 'direct' && (
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                              chat.participants.some(
                                (p) => p.username !== currentUser.username && p.isOnline
                              )
                                ? 'bg-emerald-500'
                                : 'bg-slate-500'
                            }`}
                          />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {chat.name}
                          </span>
                          <Lock className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {chat.lastMessage?.text || 'Encrypted conversation started'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right ml-2">
                      {chat.lastMessage && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        {chat.unreadCount && chat.unreadCount > 0 ? (
                          <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full shadow-sm animate-pulse">
                            {chat.unreadCount} new
                          </span>
                        ) : null}
                        {onDeleteChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(chat.id);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TAB 2: PUBLIC DIRECTORY */}
        {activeTab === 'directory' && (
          <div className="space-y-1.5">
            <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
              <span>Public Directory ({filteredUsers.length})</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Live
              </span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No matching public users found. Open another browser tab with a different username to test instant chatting!
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.username}
                  className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 flex items-center justify-between transition group"
                >
                  <div
                    onClick={() => onOpenProfile(user)}
                    className="flex items-center gap-2.5 overflow-hidden cursor-pointer flex-1"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-9 h-9 rounded-full border border-slate-800 object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                          user.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition truncate flex items-center gap-1.5">
                        <span>@{user.username}</span>
                        {typeof user.followersCount === 'number' && (
                          <span className="text-[10px] text-emerald-400/90 font-normal">
                            · {user.followersCount} {user.followersCount === 1 ? 'follower' : 'followers'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {user.statusText || 'Batchit user'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartDm(user.username)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 text-xs font-semibold transition ml-2 flex-shrink-0"
                  >
                    Chat
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: GROUPS */}
        {activeTab === 'groups' && (
          <div className="space-y-2">
            <button
              onClick={onOpenCreateGroup}
              className="w-full py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Encrypted Group</span>
            </button>

            {groupChats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                You are not in any group chats yet. Click above to create one!
              </div>
            ) : (
              groupChats.map((group) => {
                const adminList = Array.isArray(group.adminIds) && group.adminIds.length > 0
                  ? group.adminIds
                  : group.participants.length > 0
                  ? [group.participants[0].username]
                  : [];
                const isGroupAdmin = adminList.some(
                  (a) => a.toLowerCase() === currentUser.username.toLowerCase()
                );

                return (
                  <div
                    key={group.id}
                    onClick={() => onSelectChat(group.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      group.id === activeChatId
                        ? 'border-emerald-500/50 bg-slate-900 text-slate-100'
                        : 'border-slate-800/80 bg-slate-900/30 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={group.avatarUrl}
                        alt={group.name}
                        className="w-9 h-9 rounded-full border border-slate-800 object-cover flex-shrink-0"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200 truncate">{group.name}</span>
                          {isGroupAdmin && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 text-[9px] font-semibold">
                              <Crown className="w-2.5 h-2.5 text-amber-400" />
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {group.participants.length} members • {group.description || 'E2EE Group'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
