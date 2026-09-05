import React, { useState, useRef } from 'react';
import { User, Chat } from '../types';
import {
  X,
  Users,
  ShieldCheck,
  Crown,
  UserPlus,
  UserMinus,
  Shield,
  ShieldAlert,
  Edit2,
  Check,
  Search,
  MessageSquare,
  LogOut,
  Trash2,
  Lock,
  Camera,
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface GroupInfoModalProps {
  chat: Chat;
  currentUser: User;
  publicUsers: User[];
  onClose: () => void;
  onUpdateGroupInfo: (data: { chatId: string; name?: string; description?: string; avatarUrl?: string }) => void;
  onAddMembers: (data: { chatId: string; memberUsernames: string[] }) => void;
  onRemoveMember: (data: { chatId: string; targetUsername: string }) => void;
  onToggleAdmin: (data: { chatId: string; targetUsername: string; makeAdmin: boolean }) => void;
  onLeaveGroup: (chatId: string) => void;
  onDeleteGroup?: (chatId: string) => void;
  onOpenUserProfile: (user: User) => void;
  onStartDm: (username: string) => void;
}

const PRESET_AVATAR_SEEDS = [
  'CipherGroup',
  'DevGuild',
  'SecurityCore',
  'NexusSquad',
  'PulseTeam',
  'AlphaNode',
  'QuantumHub',
  'VanguardHQ',
];

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  chat,
  currentUser,
  publicUsers,
  onClose,
  onUpdateGroupInfo,
  onAddMembers,
  onRemoveMember,
  onToggleAdmin,
  onLeaveGroup,
  onDeleteGroup,
  onOpenUserProfile,
  onStartDm,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'add_members' | 'edit_info' | 'settings'>('members');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  
  // Group editing state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [groupName, setGroupName] = useState(chat.name || 'Group Chat');
  const [groupDescription, setGroupDescription] = useState(chat.description || '');
  const [avatarUrl, setAvatarUrl] = useState(chat.avatarUrl || '');
  const [selectedPresetSeed, setSelectedPresetSeed] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Admin status check
  const adminIds = Array.isArray(chat.adminIds) && chat.adminIds.length > 0
    ? chat.adminIds
    : chat.participants.length > 0
    ? [chat.participants[0].username]
    : [];

  const isCurrentUserAdmin = adminIds.some(
    (adminUsername) => adminUsername.toLowerCase() === currentUser.username.toLowerCase()
  );

  const creatorUsername = adminIds[0] || chat.participants[0]?.username || 'Unknown';

  // Filter existing participants
  const filteredParticipants = (chat.participants || []).filter((p) => {
    if (!p || !p.username) return false;
    if (!memberSearchQuery) return true;
    return (
      p.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      p.statusText?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      p.bio?.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  });

  // Non-member users available to add
  const existingUsernames = new Set((chat.participants || []).map((p) => p.username.toLowerCase()));
  const availableUsersToAdd = (publicUsers || []).filter((u) => {
    if (!u || !u.username) return false;
    if (existingUsernames.has(u.username.toLowerCase())) return false;
    if (!addSearchQuery) return true;
    return (
      u.username.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
      u.statusText?.toLowerCase().includes(addSearchQuery.toLowerCase())
    );
  });

  const toggleSelectNewMember = (username: string) => {
    if (selectedNewMembers.includes(username)) {
      setSelectedNewMembers(selectedNewMembers.filter((u) => u !== username));
    } else {
      setSelectedNewMembers([...selectedNewMembers, username]);
    }
  };

  const handleAddMembersSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNewMembers.length === 0) return;
    onAddMembers({
      chatId: chat.id,
      memberUsernames: selectedNewMembers,
    });
    setSelectedNewMembers([]);
    setAddSearchQuery('');
    setActiveTab('members');
    setSaveSuccessMsg(`Added ${selectedNewMembers.length} member(s) to group!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleSaveGroupInfo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!groupName.trim()) {
      setActionError('Group name cannot be empty.');
      return;
    }
    const finalAvatar = selectedPresetSeed
      ? `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(selectedPresetSeed)}`
      : avatarUrl || chat.avatarUrl;

    onUpdateGroupInfo({
      chatId: chat.id,
      name: groupName.trim(),
      description: groupDescription.trim(),
      avatarUrl: finalAvatar,
    });

    setIsEditingInfo(false);
    setSaveSuccessMsg('Group details updated successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar image exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      setSelectedPresetSeed('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMember = (targetUsername: string) => {
    const isSelf = targetUsername.toLowerCase() === currentUser.username.toLowerCase();
    const confirmText = isSelf
      ? 'Are you sure you want to leave this group?'
      : `Are you sure you want to remove @${targetUsername} from the group?`;

    if (window.confirm(confirmText)) {
      if (isSelf) {
        onLeaveGroup(chat.id);
        onClose();
      } else {
        onRemoveMember({
          chatId: chat.id,
          targetUsername,
        });
      }
    }
  };

  const handleToggleAdminStatus = (targetUsername: string, makeAdmin: boolean) => {
    const confirmText = makeAdmin
      ? `Promote @${targetUsername} to Group Admin? They will have full permissions to manage members and group info.`
      : `Dismiss @${targetUsername} as Group Admin?`;

    if (window.confirm(confirmText)) {
      onToggleAdmin({
        chatId: chat.id,
        targetUsername,
        makeAdmin,
      });
    }
  };

  const handleDeleteGroupClick = () => {
    if (
      window.confirm(
        '⚠️ Are you sure you want to delete and disband this group for EVERYONE? All messages will be permanently deleted.'
      )
    ) {
      if (onDeleteGroup) {
        onDeleteGroup(chat.id);
      }
      onClose();
    }
  };

  const currentDisplayedAvatar = selectedPresetSeed
    ? `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(selectedPresetSeed)}`
    : avatarUrl || chat.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(chat.name || 'group')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header / Banner */}
        <div className="relative bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-slate-800 p-5 pt-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 transition border border-slate-800/80 z-10"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            {/* Group Avatar */}
            <div className="relative group/avatar flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden shadow-xl p-0.5">
                <img
                  src={currentDisplayedAvatar}
                  alt={chat.name}
                  className="w-full h-full rounded-[14px] object-cover"
                />
              </div>

              {isCurrentUserAdmin && (
                <button
                  onClick={() => {
                    setActiveTab('edit_info');
                    setIsEditingInfo(true);
                  }}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition"
                  title="Change Group Icon"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Group Title and Info */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                  {chat.name}
                </h2>
                {isCurrentUserAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-medium">
                    <Users className="w-3 h-3 text-slate-400" />
                    Member
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {chat.description || 'Encrypted group conversation'}
              </p>

              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Lock className="w-3 h-3" />
                  E2EE Protected
                </span>
                <span>•</span>
                <span>{chat.participants?.length || 0} Members</span>
              </div>
            </div>
          </div>

          {/* Banner Admin Badge Info Bar */}
          {isCurrentUserAdmin && (
            <div className="mt-4 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>You have full administrative privileges for this group.</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('edit_info');
                  setIsEditingInfo(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] transition flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Edit Info
              </button>
            </div>
          )}
        </div>

        {/* Notifications & Feedback Alerts */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {actionError && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({chat.participants?.length || 0})</span>
          </button>

          {isCurrentUserAdmin && (
            <button
              onClick={() => setActiveTab('add_members')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'add_members'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Members</span>
            </button>
          )}

          {isCurrentUserAdmin && (
            <button
              onClick={() => setActiveTab('edit_info')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'edit_info'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Group</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Group Details</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: MEMBERS LIST */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              {/* Header and Search */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search group members..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  />
                </div>

                {isCurrentUserAdmin && (
                  <button
                    onClick={() => setActiveTab('add_members')}
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Members List */}
              <div className="space-y-2">
                {filteredParticipants.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
                    No matching members found in this group.
                  </div>
                ) : (
                  filteredParticipants.map((member) => {
                    const isMemberAdmin = adminIds.some(
                      (a) => a.toLowerCase() === member.username.toLowerCase()
                    );
                    const isCreator =
                      member.username.toLowerCase() === creatorUsername.toLowerCase();
                    const isSelf =
                      member.username.toLowerCase() === currentUser.username.toLowerCase();

                    return (
                      <div
                        key={member.username}
                        className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700/80 transition"
                      >
                        {/* Member User Info */}
                        <div
                          onClick={() => onOpenUserProfile(member)}
                          className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={
                                member.avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${member.username}`
                              }
                              alt={member.username}
                              className="w-10 h-10 rounded-full border border-slate-800 object-cover"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                                member.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-100 truncate">
                                @{member.username}
                              </span>

                              {isSelf && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (You)
                                </span>
                              )}

                              {isCreator ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold">
                                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                                  Creator
                                </span>
                              ) : isMemberAdmin ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold">
                                  <Shield className="w-2.5 h-2.5 text-emerald-400" />
                                  Admin
                                </span>
                              ) : null}
                            </div>

                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {member.statusText || member.bio || 'Encrypted network user'}
                            </p>
                          </div>
                        </div>

                        {/* Actions for this member */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!isSelf && (
                            <button
                              onClick={() => {
                                onStartDm(member.username);
                                onClose();
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition"
                              title={`Direct Message @${member.username}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Admin Controls on Member */}
                          {isCurrentUserAdmin && !isSelf && (
                            <>
                              {/* Toggle Admin Role */}
                              <button
                                onClick={() => handleToggleAdminStatus(member.username, !isMemberAdmin)}
                                className={`p-1.5 rounded-lg border transition ${
                                  isMemberAdmin
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-800'
                                }`}
                                title={
                                  isMemberAdmin
                                    ? `Dismiss @${member.username} as Admin`
                                    : `Make @${member.username} a Group Admin`
                                }
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </button>

                              {/* Remove Member Button */}
                              <button
                                onClick={() => handleRemoveMember(member.username)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                                title={`Remove @${member.username} from group`}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Self Leave Option on Self Row */}
                          {isSelf && (
                            <button
                              onClick={() => handleRemoveMember(currentUser.username)}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-[11px] font-medium transition flex items-center gap-1"
                              title="Leave Group"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>Leave</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ADD MEMBERS (Admin only) */}
          {activeTab === 'add_members' && isCurrentUserAdmin && (
            <form onSubmit={handleAddMembersSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Select Users to Add ({selectedNewMembers.length} selected)
                  </label>
                  {selectedNewMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedNewMembers([])}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    placeholder="Search public directory for users..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Directory List of Non-Members */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {availableUsersToAdd.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800/50">
                      No additional users found to add. All registered contacts are already in this group.
                    </div>
                  ) : (
                    availableUsersToAdd.map((user) => {
                      const isSelected = selectedNewMembers.includes(user.username);
                      return (
                        <div
                          key={user.username}
                          onClick={() => toggleSelectNewMember(user.username)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-slate-100'
                              : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                user.avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`
                              }
                              alt={user.username}
                              className="w-8 h-8 rounded-full border border-slate-800 object-cover"
                            />
                            <div>
                              <div className="text-xs font-semibold">@{user.username}</div>
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {user.statusText || 'Active user'}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-700 bg-slate-900'
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

              <button
                type="submit"
                disabled={selectedNewMembers.length === 0}
                className={`w-full py-2.5 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg ${
                  selectedNewMembers.length > 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Add {selectedNewMembers.length} Member{selectedNewMembers.length === 1 ? '' : 's'} to Group
              </button>
            </form>
          )}

          {/* TAB 3: EDIT GROUP INFO (Admin only) */}
          {activeTab === 'edit_info' && isCurrentUserAdmin && (
            <form onSubmit={handleSaveGroupInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setActionError('');
                  }}
                  placeholder="Group Name"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Group Description / Topic
                </label>
                <textarea
                  rows={2}
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Set topic or rules for this group"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none resize-none"
                />
              </div>

              {/* Group Avatar Customization */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Choose Group Avatar
                </label>

                {/* Preset Seed Badges */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                  {PRESET_AVATAR_SEEDS.map((seed) => {
                    const isSelected = selectedPresetSeed === seed;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => {
                          setSelectedPresetSeed(seed);
                          setAvatarUrl('');
                        }}
                        className={`p-1 rounded-xl border flex flex-col items-center gap-1 transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/20'
                            : 'border-slate-800 bg-slate-950 hover:bg-slate-800/60'
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed)}`}
                          alt={seed}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Custom Image Upload */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={avatarFileInputRef}
                    onChange={handleCustomAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload Custom Image</span>
                  </button>

                  {avatarUrl && (
                    <span className="text-[11px] text-emerald-400">Custom image selected</span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  Save Group Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupName(chat.name || '');
                    setGroupDescription(chat.description || '');
                    setAvatarUrl(chat.avatarUrl || '');
                    setSelectedPresetSeed('');
                    setActiveTab('members');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: GROUP DETAILS & DANGER ZONE */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Group ID:</span>
                  <span className="font-mono text-slate-200 text-[11px]">{chat.id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Created by:</span>
                  <span className="font-semibold text-amber-300">@{creatorUsername}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Encryption:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted (AES-GCM)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Active Admins:</span>
                  <span className="text-slate-300">
                    {adminIds.map((a) => `@${a}`).join(', ')}
                  </span>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-3">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Danger Zone
                </h4>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleRemoveMember(currentUser.username)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave This Group
                  </button>

                  {isCurrentUserAdmin && onDeleteGroup && (
                    <button
                      onClick={handleDeleteGroupClick}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete & Disband Group for Everyone
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
