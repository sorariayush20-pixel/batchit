import React, { useState, useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { User, Chat } from '../types';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  MessageSquare,
  Lock,
  Key,
  Radio,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  X,
  Crown,
  UserCheck,
  UserX,
  UserPlus,
  AlertTriangle,
  Server,
  Activity,
  Check,
  Sparkles,
  Megaphone,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  totalGroups: number;
  totalDirectChats: number;
  totalMessages: number;
  totalStories: number;
  activeSockets: number;
  uptimeSeconds: number;
  memoryMB: number;
}

interface AdminUserRecord {
  id: string;
  username: string;
  avatarUrl: string;
  statusText?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen: number;
  joinedAt: number;
  publicKeyPem?: string;
  keyFingerprint?: string;
  hasPassword?: boolean;
  hasSecurityQuestion?: boolean;
}

interface AdminGroupRecord {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  participants: User[];
  adminIds: string[];
  createdAt: number;
  messageCount: number;
  lastMessage?: any;
}

interface AdminPanelModalProps {
  socket: Socket | null;
  currentUser: User | null;
  onClose: () => void;
  onStartDm?: (targetUsername: string) => void;
  onSelectChat?: (chatId: string) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  socket,
  currentUser,
  onClose,
  onStartDm,
  onSelectChat,
}) => {
  // Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('batchit_admin_token'));
  });
  const [adminToken, setAdminToken] = useState<string>(() => {
    return sessionStorage.getItem('batchit_admin_token') || '';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'groups' | 'broadcast' | 'audit'>('overview');

  // Admin Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [groupsList, setGroupsList] = useState<AdminGroupRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Search & Filter States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<AdminGroupRecord | null>(null);

  // Modals & Action States
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<AdminUserRecord | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [pwdResetSuccess, setPwdResetSuccess] = useState('');
  const [pwdResetError, setPwdResetError] = useState('');
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  // Edit User Profile State
  const [editStatusText, setEditStatusText] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Edit Group State
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupAvatar, setEditGroupAvatar] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');

  // Announcement State
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'alert'>('info');
  const [announcementSent, setAnnouncementSent] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  // Action status toast
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  // Load Admin Data from Server
  const fetchAdminData = () => {
    if (!socket || !adminToken) return;
    setIsLoadingData(true);
    socket.emit('admin:get_data', { token: adminToken }, (res: any) => {
      setIsLoadingData(false);
      if (res?.success) {
        setStats(res.stats);
        setUsersList(res.users || []);
        setGroupsList(res.groups || []);
        if (selectedGroup) {
          const updatedSelected = (res.groups || []).find((g: any) => g.id === selectedGroup.id);
          if (updatedSelected) {
            setSelectedGroup(updatedSelected);
          }
        }
      } else {
        if (res?.error?.includes('Unauthorized') || res?.error?.includes('Invalid token')) {
          sessionStorage.removeItem('batchit_admin_token');
          setIsAdminAuthenticated(false);
          setAdminToken('');
        }
      }
    });
  };

  useEffect(() => {
    if (isAdminAuthenticated && adminToken) {
      fetchAdminData();
    }
  }, [isAdminAuthenticated, adminToken]);

  // Handle Admin Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both username and password.');
      return;
    }

    setIsLoggingIn(true);

    if (socket) {
      socket.emit(
        'admin:login',
        { username: loginUsername.trim(), password: loginPassword },
        (res: any) => {
          setIsLoggingIn(false);
          if (res?.success && res.token) {
            setAdminToken(res.token);
            setIsAdminAuthenticated(true);
            sessionStorage.setItem('batchit_admin_token', res.token);
            showToast('Authenticated as Super Administrator');
          } else {
            setLoginError(res?.error || 'Invalid credentials. Access restricted.');
          }
        }
      );
    } else {
      // Direct REST fallback
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      })
        .then((r) => r.json())
        .then((data) => {
          setIsLoggingIn(false);
          if (data.success && data.token) {
            setAdminToken(data.token);
            setIsAdminAuthenticated(true);
            sessionStorage.setItem('batchit_admin_token', data.token);
            showToast('Authenticated as Super Administrator');
          } else {
            setLoginError(data.error || 'Invalid credentials. Access restricted.');
          }
        })
        .catch(() => {
          setIsLoggingIn(false);
          setLoginError('Server connection failed.');
        });
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('batchit_admin_token');
    setIsAdminAuthenticated(false);
    setAdminToken('');
    setLoginPassword('');
    showToast('Admin session terminated');
  };

  // Administrative User Password Reset
  const handlePerformPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser) return;
    setPwdResetError('');
    setPwdResetSuccess('');

    if (newPasswordInput.length < 4) {
      setPwdResetError('New password must be at least 4 characters long.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPwdResetError('Passwords do not match.');
      return;
    }

    setIsResettingPwd(true);
    if (!socket) return;

    socket.emit(
      'admin:reset_user_password',
      {
        token: adminToken,
        username: resetPwdUser.username,
        newPassword: newPasswordInput,
      },
      (res: any) => {
        setIsResettingPwd(false);
        if (res?.success) {
          setPwdResetSuccess(`Password for @${resetPwdUser.username} successfully changed!`);
          showToast(`Password reset for @${resetPwdUser.username}`);
          setTimeout(() => {
            setResetPwdUser(null);
            setNewPasswordInput('');
            setConfirmPasswordInput('');
            setPwdResetSuccess('');
          }, 1800);
          fetchAdminData();
        } else {
          setPwdResetError(res?.error || 'Failed to reset password.');
        }
      }
    );
  };

  // Edit User Profile Details
  const handleOpenEditUser = (u: AdminUserRecord) => {
    setEditingUser(u);
    setEditStatusText(u.statusText || '');
    setEditBio(u.bio || '');
    setEditAvatarUrl(u.avatarUrl || '');
  };

  const handleSaveUser = () => {
    if (!editingUser || !socket) return;
    setIsSavingUser(true);
    socket.emit(
      'admin:update_user',
      {
        token: adminToken,
        username: editingUser.username,
        statusText: editStatusText.trim(),
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl.trim(),
      },
      (res: any) => {
        setIsSavingUser(false);
        if (res?.success) {
          showToast(`Updated profile for @${editingUser.username}`);
          setEditingUser(null);
          fetchAdminData();
        } else {
          showToast(res?.error || 'Failed to update user', 'error');
        }
      }
    );
  };

  // Delete User Account
  const handleDeleteUser = (username: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE user @${username}? This action cannot be undone.`)) {
      return;
    }
    if (!socket) return;
    socket.emit('admin:delete_user', { token: adminToken, username }, (res: any) => {
      if (res?.success) {
        showToast(`User @${username} deleted successfully`);
        fetchAdminData();
      } else {
        showToast(res?.error || 'Failed to delete user', 'error');
      }
    });
  };

  // Group Moderation Handlers
  const handleSelectGroup = (g: AdminGroupRecord) => {
    setSelectedGroup(g);
    setEditGroupName(g.name);
    setEditGroupDesc(g.description || '');
    setEditGroupAvatar(g.avatarUrl || '');
    setAddMemberUsername('');
  };

  const handleSaveGroupInfo = () => {
    if (!selectedGroup || !socket) return;
    setIsSavingGroup(true);
    socket.emit(
      'admin:update_group',
      {
        token: adminToken,
        chatId: selectedGroup.id,
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
        avatarUrl: editGroupAvatar.trim(),
      },
      (res: any) => {
        setIsSavingGroup(false);
        if (res?.success) {
          showToast('Group settings updated successfully');
          fetchAdminData();
        } else {
          showToast(res?.error || 'Failed to update group', 'error');
        }
      }
    );
  };

  const handleToggleGroupAdminRole = (targetUsername: string, makeAdmin: boolean) => {
    if (!selectedGroup || !socket) return;
    socket.emit(
      'admin:toggle_group_admin',
      {
        token: adminToken,
        chatId: selectedGroup.id,
        targetUsername,
        makeAdmin,
      },
      (res: any) => {
        if (res?.success) {
          showToast(`@${targetUsername} ${makeAdmin ? 'promoted to Group Admin' : 'removed as Admin'}`);
          fetchAdminData();
        } else {
          showToast(res?.error || 'Failed to toggle group admin', 'error');
        }
      }
    );
  };

  const handleRemoveGroupMember = (targetUsername: string) => {
    if (!selectedGroup || !socket) return;
    if (!window.confirm(`Remove @${targetUsername} from group "${selectedGroup.name}"?`)) return;

    socket.emit(
      'admin:manage_group_member',
      {
        token: adminToken,
        chatId: selectedGroup.id,
        action: 'remove',
        username: targetUsername,
      },
      (res: any) => {
        if (res?.success) {
          showToast(`@${targetUsername} removed from group`);
          fetchAdminData();
        } else {
          showToast(res?.error || 'Failed to remove member', 'error');
        }
      }
    );
  };

  const handleAddMemberToGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !socket || !addMemberUsername.trim()) return;

    socket.emit(
      'admin:manage_group_member',
      {
        token: adminToken,
        chatId: selectedGroup.id,
        action: 'add',
        username: addMemberUsername.trim(),
      },
      (res: any) => {
        if (res?.success) {
          showToast(`Added @${addMemberUsername.trim()} to group`);
          setAddMemberUsername('');
          fetchAdminData();
        } else {
          showToast(res?.error || 'Failed to add member', 'error');
        }
      }
    );
  };

  const handleDeleteGroup = (chatId: string) => {
    if (!window.confirm('Are you sure you want to DISBAND and PERMANENTLY DELETE this group chat? All messages will be wiped.')) {
      return;
    }
    if (!socket) return;
    socket.emit('admin:delete_group', { token: adminToken, chatId }, (res: any) => {
      if (res?.success) {
        showToast('Group deleted successfully');
        setSelectedGroup(null);
        fetchAdminData();
      } else {
        showToast(res?.error || 'Failed to delete group', 'error');
      }
    });
  };

  // Broadcast System Announcement
  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMessage.trim() || !socket) return;

    setIsSendingAnnouncement(true);
    socket.emit(
      'admin:broadcast_announcement',
      {
        token: adminToken,
        title: announcementTitle.trim() || 'System Announcement',
        message: announcementMessage.trim(),
        type: announcementType,
      },
      (res: any) => {
        setIsSendingAnnouncement(false);
        if (res?.success) {
          setAnnouncementSent(true);
          showToast('Global announcement broadcasted to all users!');
          setAnnouncementTitle('');
          setAnnouncementMessage('');
          setTimeout(() => setAnnouncementSent(false), 3000);
        } else {
          showToast(res?.error || 'Failed to send broadcast', 'error');
        }
      }
    );
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userFilter === 'online' && !u.isOnline) return false;
      if (userFilter === 'offline' && u.isOnline) return false;
      if (!userSearchQuery) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        (u.statusText && u.statusText.toLowerCase().includes(q)) ||
        (u.bio && u.bio.toLowerCase().includes(q)) ||
        (u.keyFingerprint && u.keyFingerprint.toLowerCase().includes(q))
      );
    });
  }, [usersList, userSearchQuery, userFilter]);

  // Filtered Groups List
  const filteredGroups = useMemo(() => {
    return groupsList.filter((g) => {
      if (!groupSearchQuery) return true;
      const q = groupSearchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q)) ||
        g.participants.some((p) => p.username.toLowerCase().includes(q))
      );
    });
  }, [groupsList, groupSearchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      {/* Action Notice Toast */}
      {actionNotice && (
        <div
          className={`fixed top-5 right-5 z-[70] px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-slideDown ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{actionNotice.message}</span>
        </div>
      )}

      {/* Main Admin Modal Container */}
      <div className="w-full max-w-6xl h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              <ShieldAlert className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>Batchit Control Center</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    SUPERADMIN
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Authorized Platform Security, Accounts & Group Moderation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminAuthenticated && (
              <>
                <button
                  onClick={fetchAdminData}
                  disabled={isLoadingData}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
                  title="Refresh Platform Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition border border-rose-500/30"
                  title="Exit Superadmin Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isAdminAuthenticated ? (
          /* ========================================================= */
          /* 1. ADMIN AUTHENTICATION GATE SCREEN                       */
          /* ========================================================= */
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/60 overflow-y-auto">
            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
                  <Lock className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Superadmin Gatekeeper
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter master credentials to unlock the administrative console.
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Username
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="batchit"
                    autoCapitalize="none"
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500 font-mono transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500 font-mono transition pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Authenticate & Access Console</span>
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 text-center leading-relaxed">
                Superadmin features: Account management, Administrative password resets, Group moderation, and System broadcasting.
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* 2. AUTHENTICATED ADMIN CONSOLE WORKSPACE                  */
          /* ========================================================= */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Nav Bar Tabs */}
            <div className="w-full md:w-56 bg-slate-950/80 border-b md:border-b-0 md:border-r border-slate-800 p-3 flex md:flex-col gap-1.5 overflow-x-auto flex-shrink-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Overview & Health</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>User Accounts</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                  {usersList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('groups')}
                className={`flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition whitespace-nowrap ${
                  activeTab === 'groups'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Group Moderation</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                  {groupsList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('broadcast')}
                className={`flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition whitespace-nowrap ${
                  activeTab === 'broadcast'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Megaphone className="w-4 h-4 text-purple-400" />
                <span>Broadcast Alert</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition whitespace-nowrap ${
                  activeTab === 'audit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Security & Crypto</span>
              </button>

              {/* Status footer inside sidebar */}
              <div className="hidden md:block mt-auto p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Engine Live</span>
                </div>
                <div>Superadmin: @batchit</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Cloud SQL Database synced
                </div>
              </div>
            </div>

            {/* Right Main Content Area */}
            <div className="flex-1 bg-slate-900/50 p-4 md:p-6 overflow-y-auto">
              {/* TAB 1: OVERVIEW & SYSTEM METRICS */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="text-lg font-bold text-white">System Health & Live Metrics</h3>
                    <p className="text-xs text-slate-400">
                      Real-time telemetry of Batchit communication server, active sessions, and database clusters.
                    </p>
                  </div>

                  {/* 6 Core Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Registered Accounts</span>
                        <Users className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{stats?.totalUsers || usersList.length}</div>
                      <div className="text-[10px] text-slate-500 mt-1">E2EE Identity records</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Online Users</span>
                        <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">{stats?.onlineUsers || usersList.filter(u => u.isOnline).length}</div>
                      <div className="text-[10px] text-emerald-500/70 mt-1">Active connected sessions</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Active Groups</span>
                        <MessageSquare className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-bold text-amber-300">{stats?.totalGroups || groupsList.length}</div>
                      <div className="text-[10px] text-slate-500 mt-1">Multi-user E2EE rooms</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Total Messages</span>
                        <Database className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="text-2xl font-bold text-indigo-300">{stats?.totalMessages || 0}</div>
                      <div className="text-[10px] text-slate-500 mt-1">Encrypted payloads stored</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Server Memory</span>
                        <Server className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-purple-300">{stats?.memoryMB || 42} MB</div>
                      <div className="text-[10px] text-slate-500 mt-1">RSS Memory buffer</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium">Server Uptime</span>
                        <Activity className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="text-xl font-bold text-teal-300">
                        {Math.floor((stats?.uptimeSeconds || 360) / 60)}m {(stats?.uptimeSeconds || 360) % 60}s
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Continuous uptime</div>
                    </div>
                  </div>

                  {/* Quick Admin Action Center */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Administrator Quick Actions</span>
                    </h4>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={() => setActiveTab('users')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
                      >
                        <Users className="w-3.5 h-3.5 text-sky-400" />
                        <span>Manage User Accounts</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('groups')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Moderate Groups & Admins</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('broadcast')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-purple-400" />
                        <span>Broadcast Global Announcement</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">User Accounts Manager</h3>
                      <p className="text-xs text-slate-400">
                        View all registered users, perform administrative password resets, or moderate profiles.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Filter Buttons */}
                      <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1">
                        <button
                          onClick={() => setUserFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            userFilter === 'all'
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          All ({usersList.length})
                        </button>
                        <button
                          onClick={() => setUserFilter('online')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            userFilter === 'online'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Online ({usersList.filter((u) => u.isOnline).length})
                        </button>
                        <button
                          onClick={() => setUserFilter('offline')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            userFilter === 'offline'
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Offline
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search accounts by username, status, bio or key fingerprint..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* Users Grid / List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id || user.username}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={user.avatarUrl}
                                  alt={user.username}
                                  className="w-10 h-10 rounded-full border border-slate-800 object-cover bg-slate-900"
                                />
                                <span
                                  className={`w-3 h-3 rounded-full absolute bottom-0 right-0 border-2 border-slate-950 ${
                                    user.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                                  }`}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-white">@{user.username}</span>
                                  {user.username.toLowerCase() === 'batchit' && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                                      SUPERADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 line-clamp-1">
                                  {user.statusText || 'No status text'}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                user.isOnline
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {user.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>

                          {user.bio && (
                            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 mb-2">
                              {user.bio}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-900 pt-2 mb-3">
                            <span>Fingerprint: {user.keyFingerprint ? `${user.keyFingerprint.substring(0, 16)}...` : 'Generated'}</span>
                            <span>Joined: {new Date(user.joinedAt || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Action Buttons for this user */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                          <button
                            onClick={() => {
                              setResetPwdUser(user);
                              setNewPasswordInput('');
                              setConfirmPasswordInput('');
                              setPwdResetError('');
                              setPwdResetSuccess('');
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-amber-500/30 transition"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>Reset Password</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditUser(user)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
                            title="Edit Profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {onStartDm && (
                            <button
                              onClick={() => {
                                onStartDm(user.username);
                                onClose();
                              }}
                              className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition border border-emerald-500/30"
                              title="Start Direct Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {user.username.toLowerCase() !== 'batchit' && (
                            <button
                              onClick={() => handleDeleteUser(user.username)}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition border border-rose-500/30"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredUsers.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                        No user accounts match your search filter.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: GROUP MODERATION */}
              {activeTab === 'groups' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <h3 className="text-lg font-bold text-white">Group Moderation & Admin Control</h3>
                    <p className="text-xs text-slate-400">
                      Manage all platform groups, assign or dismiss group admins, and edit group configurations.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Groups List (4 cols) */}
                    <div className="lg:col-span-5 space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search groups..."
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition"
                        />
                      </div>

                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {filteredGroups.map((group) => {
                          const isSelected = selectedGroup?.id === group.id;
                          return (
                            <div
                              key={group.id}
                              onClick={() => handleSelectGroup(group)}
                              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                isSelected
                                  ? 'bg-amber-500/10 border-amber-500/50 text-white'
                                  : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-950 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <img
                                  src={group.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${group.name}`}
                                  alt={group.name}
                                  className="w-9 h-9 rounded-full border border-slate-800 object-cover flex-shrink-0"
                                />
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-100 truncate">{group.name}</div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {group.participants.length} members • {group.adminIds?.length || 1} admins
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            </div>
                          );
                        })}

                        {filteredGroups.length === 0 && (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            No groups found.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Selected Group Inspector & Settings (7 cols) */}
                    <div className="lg:col-span-7">
                      {selectedGroup ? (
                        <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-5">
                          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={selectedGroup.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedGroup.name}`}
                                alt={selectedGroup.name}
                                className="w-12 h-12 rounded-full border border-slate-700 object-cover"
                              />
                              <div>
                                <h4 className="text-base font-bold text-white">{selectedGroup.name}</h4>
                                <p className="text-xs text-slate-400">
                                  Group ID: <span className="font-mono text-[10px]">{selectedGroup.id}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {onSelectChat && (
                                <button
                                  onClick={() => {
                                    onSelectChat(selectedGroup.id);
                                    onClose();
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold transition border border-emerald-500/30"
                                >
                                  Open Chat
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteGroup(selectedGroup.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition border border-rose-500/30 flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Group</span>
                              </button>
                            </div>
                          </div>

                          {/* Edit Group Info Form */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                              Group Details & Settings
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Group Name</label>
                                <input
                                  type="text"
                                  value={editGroupName}
                                  onChange={(e) => setEditGroupName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Avatar URL</label>
                                <input
                                  type="text"
                                  value={editGroupAvatar}
                                  onChange={(e) => setEditGroupAvatar(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Topic / Description</label>
                              <input
                                type="text"
                                value={editGroupDesc}
                                onChange={(e) => setEditGroupDesc(e.target.value)}
                                placeholder="Describe the purpose of this group..."
                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <button
                              onClick={handleSaveGroupInfo}
                              disabled={isSavingGroup}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                            >
                              {isSavingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              <span>Save Group Settings</span>
                            </button>
                          </div>

                          {/* Member List & Admin Assignment */}
                          <div className="space-y-3 pt-4 border-t border-slate-800">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Group Members ({selectedGroup.participants.length})
                              </h5>
                            </div>

                            {/* Add User Input */}
                            <form onSubmit={handleAddMemberToGroup} className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Enter username to add to group..."
                                value={addMemberUsername}
                                onChange={(e) => setAddMemberUsername(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition border border-slate-700"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Add</span>
                              </button>
                            </form>

                            {/* Participants List */}
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                              {selectedGroup.participants.map((p) => {
                                const isGroupAdmin = (selectedGroup.adminIds || []).some(
                                  (a) => a.toLowerCase() === p.username.toLowerCase()
                                );
                                return (
                                  <div
                                    key={p.username}
                                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={p.avatarUrl}
                                        alt={p.username}
                                        className="w-7 h-7 rounded-full object-cover border border-slate-700"
                                      />
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-bold text-slate-200">@{p.username}</span>
                                          {isGroupAdmin && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-semibold border border-amber-500/30">
                                              <Crown className="w-2.5 h-2.5 text-amber-400" />
                                              Admin
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {/* Toggle Admin Role */}
                                      <button
                                        onClick={() => handleToggleGroupAdminRole(p.username, !isGroupAdmin)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition border ${
                                          isGroupAdmin
                                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                        }`}
                                        title={isGroupAdmin ? 'Dismiss Admin' : 'Make Group Admin'}
                                      >
                                        {isGroupAdmin ? 'Dismiss Admin' : 'Make Admin'}
                                      </button>

                                      {/* Remove Member */}
                                      <button
                                        onClick={() => handleRemoveGroupMember(p.username)}
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
                                        title="Remove Member"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-12 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
                          Select a group from the left list to view details, configure settings, and manage admin roles.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BROADCAST ANNOUNCEMENT */}
              {activeTab === 'broadcast' && (
                <div className="space-y-5 animate-fadeIn max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-white">System Broadcast Broadcaster</h3>
                    <p className="text-xs text-slate-400">
                      Send instantaneous high-priority alerts and system notices to all online users across the platform.
                    </p>
                  </div>

                  {announcementSent && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-400" />
                      <span>Global announcement dispatched successfully to all active websocket channels!</span>
                    </div>
                  )}

                  <form onSubmit={handleSendAnnouncement} className="space-y-4 p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Announcement Type & Priority
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setAnnouncementType('info')}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                            announcementType === 'info'
                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5 text-sky-400" />
                          <span>General Notice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnouncementType('warning')}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                            announcementType === 'warning'
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Maintenance</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnouncementType('alert')}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                            announcementType === 'alert'
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          <span>Security Alert</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Headline / Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Scheduled Maintenance at 12:00 AM UTC"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Announcement Message Body
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Type message text to broadcast to all users..."
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 transition resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingAnnouncement || !announcementMessage.trim()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition disabled:opacity-50"
                    >
                      {isSendingAnnouncement ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Megaphone className="w-4 h-4" />
                      )}
                      <span>Dispatch Global Broadcast Now</span>
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 5: AUDIT & SECURITY PROTOCOLS */}
              {activeTab === 'audit' && (
                <div className="space-y-5 animate-fadeIn max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-white">Security & Cryptographic Audit</h3>
                    <p className="text-xs text-slate-400">
                      Validation of end-to-end encryption suites and key infrastructure.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-slate-200">AES-GCM 256-Bit Symmetric Cipher</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Every direct message and group message is wrapped in an ephemeral 256-bit symmetric key, signed with IV headers.
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                      <Key className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-slate-200">RSA-OAEP 2048-Bit Key Exchange</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Public keys are registered upon browser initialization. Private keys remain exclusively in client device storage.
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-slate-200">Zero-Plaintext Server Policy</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          The server relay acts strictly as an encrypted routing pipeline. Passwords are securely hashed with SHA-256 cryptographic salts.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. RESET PASSWORD MODAL (SUB-MODAL)                       */}
      {/* ========================================================= */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Reset Password for @{resetPwdUser.username}
                  </h4>
                  <p className="text-[10px] text-slate-400">Administrative Override</p>
                </div>
              </div>
              <button
                onClick={() => setResetPwdUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwdResetError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {pwdResetError}
              </div>
            )}

            {pwdResetSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{pwdResetSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePerformPasswordReset} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (min 4 characters)"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPwd}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {isResettingPwd ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. EDIT USER PROFILE MODAL (SUB-MODAL)                    */}
      {/* ========================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <img
                  src={editAvatarUrl || editingUser.avatarUrl}
                  alt={editingUser.username}
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
                <div>
                  <h4 className="text-sm font-bold text-white">Edit Profile: @{editingUser.username}</h4>
                  <p className="text-[10px] text-slate-400">Administrative Profile Update</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status Text</label>
                <input
                  type="text"
                  value={editStatusText}
                  onChange={(e) => setEditStatusText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Avatar URL</label>
                <input
                  type="text"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  disabled={isSavingUser}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {isSavingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
