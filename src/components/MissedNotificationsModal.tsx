import React from 'react';
import { Chat, User } from '../types';
import {
  PhoneMissed,
  MessageSquare,
  X,
  PhoneCall,
  Video,
  ChevronRight,
  Clock,
  Shield,
  Bell,
  CheckCheck,
} from 'lucide-react';

export interface MissedCallItem {
  id: string;
  callerUsername: string;
  callerAvatar?: string;
  timestamp: number;
  chatId: string;
  callType?: 'voice' | 'video';
}

interface MissedNotificationsModalProps {
  isOpen: boolean;
  missedCalls: MissedCallItem[];
  unreadChats: Chat[];
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onCallBack: (callerUsername: string, callType?: 'voice' | 'video') => void;
}

export const MissedNotificationsModal: React.FC<MissedNotificationsModalProps> = ({
  isOpen,
  missedCalls,
  unreadChats,
  onClose,
  onSelectChat,
  onCallBack,
}) => {
  if (!isOpen) return null;

  const totalUnreadMessages = unreadChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const hasMissedCalls = missedCalls.length > 0;
  const hasUnreadMessages = unreadChats.length > 0;

  if (!hasMissedCalls && !hasUnreadMessages) return null;

  const formatTimeAgo = (timestamp: number) => {
    const diffMin = Math.round((Date.now() - timestamp) / (60 * 1000));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Earlier today';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-bold shadow-md shadow-rose-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                While You Were Away
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {missedCalls.length + totalUnreadMessages} New
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Missed calls and new encrypted messages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Missed Calls Section */}
          {hasMissedCalls && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-400 px-1">
                <span className="flex items-center gap-1.5">
                  <PhoneMissed className="w-3.5 h-3.5" />
                  Missed Voice Calls ({missedCalls.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {missedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/20 flex items-center justify-between hover:border-rose-500/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={
                            call.callerAvatar ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${call.callerUsername}`
                          }
                          alt={call.callerUsername}
                          className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-950">
                          {call.callType === 'video' ? (
                            <Video className="w-2.5 h-2.5" />
                          ) : (
                            <PhoneMissed className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          @{call.callerUsername}
                        </div>
                        <div className="text-[10px] text-rose-400/90 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {call.callType === 'video' ? 'Missed video call' : 'Missed voice call'} • {formatTimeAgo(call.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onClose();
                          onCallBack(call.callerUsername, 'voice');
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 transition"
                        title="Voice Call Back"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onCallBack(call.callerUsername, 'video');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-md transition"
                        title="Video Call Back"
                      >
                        <Video className="w-3 h-3" />
                        <span>Call</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Messages Section */}
          {hasUnreadMessages && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 px-1">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  New Messages ({totalUnreadMessages} in {unreadChats.length} chats)
                </span>
              </div>

              <div className="space-y-1.5">
                {unreadChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      onClose();
                      onSelectChat(chat.id);
                    }}
                    className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-between cursor-pointer group transition"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={
                          chat.avatarUrl ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${chat.name || 'chat'}`
                        }
                        alt={chat.name || 'Chat'}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition truncate">
                          {chat.name || 'Direct Chat'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {chat.lastMessage?.text || 'Sent an attachment / encrypted message'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                        {chat.unreadCount || 1}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted notifications</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            Continue to App
          </button>
        </div>
      </div>
    </div>
  );
};
