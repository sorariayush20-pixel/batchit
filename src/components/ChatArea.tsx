import React, { useState, useRef, useEffect } from 'react';
import { User, Chat, Message, FileAttachment } from '../types';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  ShieldCheck,
  Lock,
  Search,
  Check,
  CheckCheck,
  Reply,
  FileText,
  Image as ImageIcon,
  Download,
  Info,
  X,
  Sparkles,
  Play,
  Pause,
  Phone,
  Video,
  ArrowLeft,
  Trash2,
  Copy,
  Users,
  Crown,
  Shield,
} from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { ChatMessageText } from './ChatMessageText';

interface ChatAreaProps {
  chat: Chat;
  messages: Message[];
  currentUser: User;
  onSendMessage: (text: string, attachment?: FileAttachment, replyTo?: Message) => void;
  onSendReaction: (messageId: string, emoji: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  typingUsers: string[];
  onOpenProfile: (user: User) => void;
  onOpenGroupInfo?: () => void;
  onOpenSecurityModal: () => void;
  onPreviewFile: (attachment: FileAttachment) => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  onBack?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
}

const EMOJI_OPTIONS = ['👍', '❤️', '🔥', '🚀', '🔒', '👏', '😂'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  messages,
  currentUser,
  onSendMessage,
  onSendReaction,
  onStartTyping,
  onStopTyping,
  typingUsers,
  onOpenProfile,
  onOpenGroupInfo,
  onOpenSecurityModal,
  onPreviewFile,
  onStartVoiceCall,
  onStartVideoCall,
  onBack,
  onDeleteMessage,
  onClearChat,
  onDeleteChat,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const handleCopyMessageText = (msgId: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }
    setCopiedMsgId(msgId);
    setTimeout(() => {
      setCopiedMsgId(null);
    }, 2000);
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onStartTyping();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim(), undefined, replyingTo || undefined);
    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    onStopTyping();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const attachment: FileAttachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: base64Data,
        isEncrypted: true,
      };

      onSendMessage(inputText.trim() || `Sent attachment: ${file.name}`, attachment, replyingTo || undefined);
      setInputText('');
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Find partner user for DM safely
  const partnerUser =
    chat.type === 'direct'
      ? (chat.participants || []).find((p) => p && p.username !== currentUser?.username) || (chat.participants || [])[0]
      : null;

  const isGroup = chat.type === 'group';
  const groupAdminIds = Array.isArray(chat.adminIds) && chat.adminIds.length > 0
    ? chat.adminIds
    : (chat.participants && chat.participants.length > 0)
    ? [chat.participants[0].username]
    : [];
  const isGroupAdmin = isGroup && groupAdminIds.some(
    (a) => a.toLowerCase() === currentUser.username.toLowerCase()
  );
  const groupCreator = groupAdminIds[0] || chat.participants?.[0]?.username || 'Admin';

  const handleHeaderClick = () => {
    if (isGroup) {
      onOpenGroupInfo?.();
    } else if (partnerUser) {
      onOpenProfile(partnerUser);
    }
  };

  // Filter messages by search query safely
  const displayedMessages = searchQuery
    ? (messages || []).filter((m) => Boolean(m && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())))
    : messages || [];

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-slate-900 overflow-hidden relative">
      {/* Top Chat Header */}
      <div className="p-3 sm:p-3.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center justify-center flex-shrink-0"
              title="Back to Conversations"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          <div
            onClick={handleHeaderClick}
            className="relative cursor-pointer flex-shrink-0 group/avatar"
            title={isGroup ? "View Group Members & Admin Settings" : "View User Profile"}
          >
            <img
              src={chat.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${chat.name}`}
              alt={chat.name}
              className="w-10 h-10 rounded-full border border-slate-800 object-cover group-hover/avatar:border-emerald-500 transition"
            />
            {chat.type === 'direct' && partnerUser && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                  partnerUser.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
            )}
            {isGroup && (
              <span
                className="absolute bottom-0 right-0 p-0.5 rounded-full bg-slate-900 border border-slate-700 text-emerald-400"
                title="Group Chat"
              >
                <Users className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          <div 
            onClick={handleHeaderClick}
            className="truncate cursor-pointer group/title"
            title={isGroup ? "View Group Members & Admin Settings" : undefined}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 group-hover/title:text-emerald-300 transition truncate">
                {chat.name}
              </h2>
              {isGroup && isGroupAdmin && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex-shrink-0">
                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                  Admin
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSecurityModal();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono transition flex-shrink-0"
                title="End-to-End Encrypted Session"
              >
                <Lock className="w-3 h-3" />
                <span>E2EE Active</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {chat.type === 'direct'
                ? partnerUser?.isOnline
                  ? '🟢 Online in network'
                  : '⚪ Offline'
                : `${chat.participants.length} members • ${isGroupAdmin ? '👑 You are Admin' : `Admin: @${groupCreator}`}`}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isGroup && onOpenGroupInfo && (
            <button
              onClick={onOpenGroupInfo}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-emerald-400 border border-slate-700/80 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Group Members & Admin Settings"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Group Info</span>
            </button>
          )}

          {onStartVoiceCall && (
            <button
              onClick={onStartVoiceCall}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-emerald-400 border border-slate-700/80 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Start Encrypted Voice Call"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Audio</span>
            </button>
          )}

          {onStartVideoCall && (
            <button
              onClick={onStartVideoCall}
              className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm shadow-emerald-500/10"
              title="Start Encrypted HD Video Call"
            >
              <Video className="w-4 h-4 fill-emerald-400/20" />
              <span className="hidden sm:inline">Video</span>
            </button>
          )}

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl transition ${
              showSearch ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Search in Chat"
          >
            <Search className="w-4 h-4" />
          </button>

          {partnerUser && (
            <button
              onClick={() => onOpenProfile(partnerUser)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              title="View Profile"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {isGroup && onOpenGroupInfo && (
            <button
              onClick={onOpenGroupInfo}
              className="sm:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              title="View Group Info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {onClearChat && (
            <button
              onClick={onClearChat}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar Overlay */}
      {showSearch && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages in this conversation..."
            className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
            autoFocus
          />
          <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 hover:text-slate-300">
            Clear
          </button>
          <button onClick={() => setShowSearch(false)} className="text-xs text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Security & Persistence E2EE Notice Banner */}
      <div className="bg-emerald-950/30 border-b border-emerald-900/30 px-4 py-2 flex items-center justify-center gap-2 text-[11px] text-emerald-300">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>
          End-to-End Encrypted • All sent and received messages are permanently saved until deleted by you.
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayedMessages.map((msg) => {
          const isOwn = Boolean(
            msg.senderUsername &&
              currentUser?.username &&
              msg.senderUsername.toLowerCase() === currentUser.username.toLowerCase()
          );

          if (msg.isSystem) {
            return (
              <div key={msg.id} className="my-3 text-center">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-950 border border-slate-800/80 text-[11px] text-emerald-400/90 font-mono shadow-sm">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group relative`}
            >
              {/* Sender Name in Group */}
              {!isOwn && chat.type === 'group' && (
                <span className="text-[10px] font-semibold text-emerald-400 mb-1 ml-1">
                  @{msg.senderUsername}
                </span>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl relative shadow-md ${
                  isOwn
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/50 rounded-bl-none'
                }`}
              >
                {/* Reply Context */}
                {msg.replyTo && (
                  <div className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-emerald-300 text-xs text-slate-200">
                    <span className="font-semibold text-emerald-300 block text-[10px]">
                      @{msg.replyTo.senderUsername}
                    </span>
                    <span className="line-clamp-1 text-[11px] opacity-90">{msg.replyTo.text}</span>
                  </div>
                )}

                {/* Text Message with Clickable & Copyable Links */}
                {msg.text && <ChatMessageText text={msg.text} isOwn={isOwn} />}

                {/* File Attachment */}
                {msg.attachment && (
                  <div className="mt-2">
                    {msg.attachment.type.startsWith('image/') ? (
                      <div
                        onClick={() => onPreviewFile(msg.attachment!)}
                        className="rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:opacity-90 transition max-w-xs"
                      >
                        <img
                          src={msg.attachment.dataUrl}
                          alt={msg.attachment.name}
                          className="w-full max-h-60 object-cover"
                        />
                      </div>
                    ) : msg.attachment.type.startsWith('audio/') ? (
                      <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center gap-3">
                        <audio controls src={msg.attachment.dataUrl} className="h-8 max-w-[200px]" />
                      </div>
                    ) : (
                      <div
                        onClick={() => onPreviewFile(msg.attachment!)}
                        className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center gap-3 cursor-pointer hover:bg-black/30 transition"
                      >
                        <FileText className="w-6 h-6 text-emerald-300" />
                        <div className="truncate text-xs">
                          <div className="font-semibold truncate">{msg.attachment.name}</div>
                          <div className="text-[10px] opacity-75">
                            {(msg.attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Meta (Timestamp + Encrypted Icon + Status) */}
                <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] opacity-80 font-mono">
                  <span title="E2EE Encrypted Payload">
                    <Lock className="w-2.5 h-2.5 text-emerald-300" />
                  </span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOwn && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions list */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(msg.reactions).map(([emoji, userList]) => {
                      const users = (userList || []) as string[];
                      return (
                        <span
                          key={emoji}
                          onClick={() => onSendReaction(msg.id, emoji)}
                          className={`px-1.5 py-0.5 rounded-full text-[11px] border cursor-pointer transition ${
                            users.includes(currentUser.username)
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-black/20 border-white/10 text-slate-300'
                          }`}
                        >
                          {emoji} {users.length}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Message Hover Toolbar (Reply, Copy, React, & Delete) */}
                <div
                  className={`absolute top-0 ${
                    isOwn ? '-left-28' : '-right-28'
                  } hidden group-hover:flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl shadow-lg z-10`}
                >
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  {msg.text && (
                    <button
                      onClick={() => handleCopyMessageText(msg.id, msg.text)}
                      className={`p-1 rounded-lg transition ${
                        copiedMsgId === msg.id
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                      title={copiedMsgId === msg.id ? 'Copied to clipboard!' : 'Copy message text / links'}
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => onSendReaction(msg.id, '👍')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition text-xs"
                    title="Thumbs up"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => onSendReaction(msg.id, '❤️')}
                    className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition text-xs"
                    title="Love"
                  >
                    ❤️
                  </button>
                  {onDeleteMessage && (
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                      title="Delete Message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-emerald-400 font-mono italic animate-pulse">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing encrypted message...
        </div>
      )}

      {/* Voice Recorder Overlay OR Input Box */}
      {isRecordingVoice ? (
        <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0">
          <VoiceRecorder
            onSendVoiceNote={(att) => {
              onSendMessage(`Voice Memo`, att, replyingTo || undefined);
              setIsRecordingVoice(false);
            }}
            onCancel={() => setIsRecordingVoice(false)}
          />
        </div>
      ) : (
        <div className="p-2 sm:p-3 bg-slate-950 border-t border-slate-800/80 space-y-2 flex-shrink-0 w-full">
          {/* Reply Banner Preview */}
          {replyingTo && (
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
              <div className="truncate">
                <span className="font-semibold text-emerald-400">Replying to @{replyingTo.senderUsername}: </span>
                <span className="text-slate-400 truncate">{replyingTo.text}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Emoji Picker Dropdown */}
          {showEmojiPicker && (
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex gap-1.5 overflow-x-auto">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-slate-800 rounded-lg text-base sm:text-lg transition flex-shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2 w-full">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition flex-shrink-0"
              title="Attach Image or Document"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Mic Voice Note Button */}
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition flex-shrink-0"
              title="Record Voice Memo"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Emoji Picker Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition flex-shrink-0"
              title="Emoji Picker"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900 border border-slate-800 focus:border-emerald-500/80 text-xs text-slate-100 rounded-xl outline-none transition placeholder-slate-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 sm:p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold transition shadow-lg shadow-emerald-500/20 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
