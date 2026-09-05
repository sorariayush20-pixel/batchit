import React, { useState } from 'react';
import { User } from '../types';
import { Users, X, Search, Check, ShieldCheck, Plus } from 'lucide-react';

interface CreateGroupModalProps {
  publicUsers: User[];
  currentUsername: string;
  onClose: () => void;
  onCreateGroup: (data: { name: string; description: string; memberUsernames: string[] }) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  publicUsers,
  currentUsername,
  onClose,
  onCreateGroup,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Filter out self and search query
  const availableUsers = publicUsers.filter((u) => {
    if (u.username === currentUsername) return false;
    if (!searchQuery) return true;
    return (
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.statusText?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const toggleSelectUser = (username: string) => {
    if (selectedUsernames.includes(username)) {
      setSelectedUsernames(selectedUsernames.filter((u) => u !== username));
    } else {
      setSelectedUsernames([...selectedUsernames, username]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name.');
      return;
    }
    if (selectedUsernames.length === 0) {
      setError('Please select at least one group member.');
      return;
    }

    onCreateGroup({
      name: name.trim(),
      description: description.trim(),
      memberUsernames: selectedUsernames,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Create Encrypted Group</h3>
              <p className="text-xs text-slate-400">Add members from public directory</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Security Research Guild"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Topic / Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs rounded-xl outline-none"
            />
          </div>

          {/* Member Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Members ({selectedUsernames.length})
              </label>
            </div>

            {/* Member search bar */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public directory..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {availableUsers.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800/50">
                  No other public users found. Open another tab to test multi-user chat!
                </div>
              ) : (
                availableUsers.map((user) => {
                  const isSelected = selectedUsernames.includes(user.username);
                  return (
                    <div
                      key={user.username}
                      onClick={() => toggleSelectUser(user.username)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-slate-100'
                          : 'border-slate-800 bg-slate-950/80 hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-8 h-8 rounded-full border border-slate-800 object-cover"
                        />
                        <div>
                          <div className="text-xs font-semibold">@{user.username}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">
                            {user.statusText || 'CipherTalk user'}
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

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Group messages are encrypted end-to-end for all participants.</span>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Create Group Chat
          </button>
        </form>
      </div>
    </div>
  );
};
