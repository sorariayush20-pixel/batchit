import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Chat, Message, FileAttachment, ActiveCallState } from './types';
import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  saveKeysToStorage,
  loadKeysFromStorage,
  importPrivateKey,
  StoredCryptoKeys,
  KeyPairPem,
} from './crypto/e2ee';
import { OnboardingModal } from './components/OnboardingModal';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { UserProfileModal } from './components/UserProfileModal';
import { SecurityKeyModal } from './components/SecurityKeyModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { AboutModal } from './components/AboutModal';
import { CallModal } from './components/CallModal';
import { CreateStoryModal } from './components/CreateStoryModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import { MissedNotificationsModal, MissedCallItem } from './components/MissedNotificationsModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { GroupInfoModal } from './components/GroupInfoModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AnnouncementBanner, AnnouncementItem } from './components/AnnouncementBanner';
import { PostsFeed } from './components/PostsFeed';
import { FollowListModal } from './components/FollowListModal';
import { Story, UserStoryGroup, StoryView } from './types';
import { Shield, Sparkles, Lock, Key, Users, Globe, Plus, Flame } from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // User & Encryption State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cryptoKeys, setCryptoKeys] = useState<StoredCryptoKeys | null>(null);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // Application Data State
  const [chats, setChats] = useState<Chat[]>([]);
  const [publicUsers, setPublicUsers] = useState<User[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isFeedActive, setIsFeedActive] = useState(false);
  const [followListTarget, setFollowListTarget] = useState<{
    username: string;
    type: 'followers' | 'following';
  } | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCallItem[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementItem | null>(null);

  // Modal Control States
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAndroidInstallModal, setShowAndroidInstallModal] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [activeStoryViewerIndex, setActiveStoryViewerIndex] = useState<number | null>(null);
  const [showMissedNotifications, setShowMissedNotifications] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<FileAttachment | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const activeChatIdRef = useRef<string | null>(activeChatId);
  const currentUserRef = useRef<User | null>(currentUser);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Auto-Initialize Client E2EE Key Pair & Restore Session Data on Mount
  useEffect(() => {
    // Restore user session & cached chats immediately on mount
    const savedUserJson =
      localStorage.getItem('batchit_user') ||
      localStorage.getItem('baatcheet_user') ||
      localStorage.getItem('ciphertalk_user');
    if (savedUserJson) {
      try {
        const parsedUser: User = JSON.parse(savedUserJson);
        if (parsedUser && parsedUser.username && typeof parsedUser.username === 'string') {
          setCurrentUser(parsedUser);

          const uname = parsedUser.username.toLowerCase();
          const savedChats = localStorage.getItem(`batchit_chats_${uname}`);
          if (savedChats) {
            const chatsArr = JSON.parse(savedChats);
            if (Array.isArray(chatsArr) && chatsArr.length > 0) {
              setChats(chatsArr);
            }
          }

          const savedActiveChat = localStorage.getItem(`batchit_active_chat_${uname}`);
          if (savedActiveChat) {
            setActiveChatId(savedActiveChat);
            const savedMsgs = localStorage.getItem(`batchit_msgs_${uname}_${savedActiveChat}`);
            if (savedMsgs) {
              const msgsArr = JSON.parse(savedMsgs);
              if (Array.isArray(msgsArr) && msgsArr.length > 0) {
                setActiveMessages(msgsArr);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to restore initial session from cache:', e);
      }
    }

    const savedPem = loadKeysFromStorage();
    if (savedPem && savedPem.privateKeyPem) {
      importPrivateKey(savedPem.privateKeyPem)
        .then((privKey) => {
          setCryptoKeys({
            publicKey: null as any,
            privateKey: privKey,
            pem: savedPem,
          });
        })
        .catch((err) => {
          console.warn('Could not import existing key, generating fresh pair:', err);
          setIsGeneratingKeys(true);
          generateKeyPair()
            .then((keys) => {
              setCryptoKeys(keys);
              saveKeysToStorage(keys.pem);
            })
            .catch((e) => console.error('Failed to generate keypair fallback:', e))
            .finally(() => setIsGeneratingKeys(false));
        });
    } else {
      setIsGeneratingKeys(true);
      generateKeyPair()
        .then((keys) => {
          setCryptoKeys(keys);
          saveKeysToStorage(keys.pem);
        })
        .catch((err) => console.error('Failed to generate initial keypair', err))
        .finally(() => setIsGeneratingKeys(false));
    }
  }, []);

  // Listen for browser PWA / Android installation prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setDeferredInstallPrompt(null);
        }
      });
    } else {
      setShowAndroidInstallModal(true);
    }
  };

  // Sync chats list to localStorage for returning session
  useEffect(() => {
    if (currentUser?.username && chats.length > 0) {
      const uname = currentUser.username.toLowerCase();
      localStorage.setItem(`batchit_chats_${uname}`, JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  // Sync activeChatId and load cached messages on chat switch
  useEffect(() => {
    if (currentUser?.username && activeChatId) {
      const uname = currentUser.username.toLowerCase();
      localStorage.setItem(`batchit_active_chat_${uname}`, activeChatId);

      const savedMsgs = localStorage.getItem(`batchit_msgs_${uname}_${activeChatId}`);
      if (savedMsgs) {
        try {
          const msgsArr = JSON.parse(savedMsgs);
          if (Array.isArray(msgsArr) && msgsArr.length > 0) {
            setActiveMessages(msgsArr);
          }
        } catch (e) {}
      }
    }
  }, [activeChatId, currentUser]);

  // Sync activeMessages to localStorage
  useEffect(() => {
    if (currentUser?.username && activeChatId) {
      const uname = currentUser.username.toLowerCase();
      localStorage.setItem(`batchit_msgs_${uname}_${activeChatId}`, JSON.stringify(activeMessages));
    }
  }, [activeMessages, activeChatId, currentUser]);

  // Search Public Directory Users
  const handleSearchUsers = (query: string = '') => {
    if (socketRef.current) {
      socketRef.current.emit('user:search', query, (users: User[]) => {
        if (users) {
          setPublicUsers(users);
        }
      });
    }
  };

  // Robust Unified Stories Fetcher (Socket + REST Fallback)
  const fetchStories = React.useCallback((targetUsername?: string) => {
    const uname = (targetUsername !== undefined ? targetUsername : currentUser?.username || '').trim();

    // 1. Socket fetch
    if (socketRef.current) {
      socketRef.current.emit('story:list', { username: uname }, (storyList: Story[]) => {
        if (Array.isArray(storyList)) {
          setStories(storyList);
        }
      });
    }

    // 2. REST API Fallback
    fetch(`/api/stories?username=${encodeURIComponent(uname)}`)
      .then((res) => res.json())
      .then((storyList: Story[]) => {
        if (Array.isArray(storyList)) {
          setStories((prev) => {
            const map = new Map<string, Story>();
            for (const s of prev) map.set(s.id, s);
            for (const s of storyList) map.set(s.id, s);
            return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      })
      .catch((err) => console.warn('[Stories] Fallback fetch warning:', err));
  }, [currentUser?.username]);

  // Periodic Story Sync every 15s to keep offline/online clients in sync
  useEffect(() => {
    fetchStories();
    const interval = setInterval(() => {
      fetchStories();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchStories]);

  // 1. Initialize Socket.io Connection
  useEffect(() => {
    // Request notification permissions for offline/background messages
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server');
      setIsConnected(true);

      // Re-register user if returning session exists
      const savedUserJson = localStorage.getItem('batchit_user') || localStorage.getItem('baatcheet_user') || localStorage.getItem('ciphertalk_user');
      if (savedUserJson) {
        try {
          const parsedUser: User = JSON.parse(savedUserJson);
          const savedPem = loadKeysFromStorage();
          if (savedPem) {
            newSocket.emit('user:register', {
              username: parsedUser.username,
              avatarUrl: parsedUser.avatarUrl,
              statusText: parsedUser.statusText,
              bio: parsedUser.bio,
              publicKeyPem: savedPem.publicKeyPem,
              keyFingerprint: savedPem.fingerprint,
            });
          }
        } catch (e) {
          console.error('Failed to restore saved session', e);
        }
      }

      // Fetch public users & chats list on connection
      let uname = '';
      if (savedUserJson) {
        try {
          const parsedUser: User = JSON.parse(savedUserJson);
          uname = parsedUser.username || '';
        } catch (e) {}
      }

      newSocket.emit('user:search', '', (users: User[]) => {
        if (users) setPublicUsers(users);
      });

      newSocket.emit('chats:list', { username: uname }, (chatList: Chat[]) => {
        if (Array.isArray(chatList) && chatList.length > 0) {
          setChats(chatList);
          // Check if there are unread messages to show in startup pop-up
          const unread = chatList.filter((c) => (c.unreadCount || 0) > 0);
          if (unread.length > 0) {
            setShowMissedNotifications(true);
          }
        }
      });

      // Load active 24-hour stories immediately
      fetchStories(uname);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    // Handle user registration response
    newSocket.on('user:registered', (user: User) => {
      setCurrentUser(user);
      localStorage.setItem('batchit_user', JSON.stringify(user));

      // Fetch chats list & directory
      newSocket.emit('chats:list', { username: user.username }, (chatList: Chat[]) => {
        setChats(chatList || []);
        if (chatList && chatList.length > 0 && !activeChatId) {
          setActiveChatId(chatList[0].id);
        }
        const unread = (chatList || []).filter((c) => (c.unreadCount || 0) > 0);
        if (unread.length > 0) {
          setShowMissedNotifications(true);
        }
      });

      newSocket.emit('user:search', '', (users: User[]) => {
        setPublicUsers(users || []);
      });

      // Fetch stories for registered user
      fetchStories(user.username);
    });

    // Handle Directory Updates
    newSocket.on('directory:user_updated', (updatedUser: User) => {
      setPublicUsers((prev) => {
        const index = prev.findIndex((u) => u.username?.toLowerCase() === updatedUser.username?.toLowerCase());
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = updatedUser;
          return updated;
        }
        return [...prev, updatedUser];
      });
    });

    // Handle User Status Changes
    newSocket.on('user:status_changed', (data: { username: string; isOnline: boolean; lastSeen: number }) => {
      setPublicUsers((prev) =>
        prev.map((u) =>
          u.username?.toLowerCase() === data.username?.toLowerCase()
            ? { ...u, isOnline: data.isOnline, lastSeen: data.lastSeen }
            : u
        )
      );
    });

    // Handle User Account Deletion
    newSocket.on('directory:user_deleted', (data: { username: string }) => {
      setPublicUsers((prev) => prev.filter((u) => u.username?.toLowerCase() !== data.username?.toLowerCase()));
    });

    // Handle New Chat Room / Group Invitation
    newSocket.on('chat:new', (newChat: Chat) => {
      setChats((prev) => {
        if (prev.some((c) => c.id === newChat.id)) return prev;
        return [newChat, ...prev];
      });
      setActiveChatId((prev) => prev || newChat.id);
    });

    // Handle Typing Statuses
    newSocket.on('typing:status', (data: { chatId: string; username: string; isTyping: boolean }) => {
      if (data.chatId === activeChatId) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            return prev.includes(data.username) ? prev : [...prev, data.username];
          } else {
            return prev.filter((u) => u !== data.username);
          }
        });
      }
    });

    // Handle Voice & Video Call Signaling Events
    newSocket.on('call:incoming', (data: { callId: string; chatId: string; chatName: string; isGroup: boolean; callType?: 'voice' | 'video'; caller: User; participants?: User[] }) => {
      // Ignore if this user was the caller
      if (currentUserRef.current && data.caller.username.toLowerCase() === currentUserRef.current.username.toLowerCase()) {
        return;
      }
      setActiveCall({
        callId: data.callId,
        chatId: data.chatId,
        chatName: data.isGroup ? (data.chatName || 'Group Call') : data.caller.username,
        chatAvatar: data.caller.avatarUrl,
        isGroup: data.isGroup,
        callType: data.callType || 'voice',
        callerUsername: data.caller.username,
        participants: data.participants && data.participants.length > 0 ? data.participants : [data.caller],
        status: 'incoming',
        isMuted: false,
        isVideoOff: false,
        isFrontCamera: true,
        isSpeakerOn: true,
      });
    });

    newSocket.on('call:accepted', (data: { callId: string; chatId: string; username: string }) => {
      setActiveCall((prev) => {
        if (prev && prev.callId === data.callId) {
          return {
            ...prev,
            status: 'connected',
            startTime: Date.now(),
          };
        }
        return prev;
      });
    });

    newSocket.on('call:rejected', (data: { callId: string; chatId: string; username: string }) => {
      setActiveCall((prev) => {
        if (prev && prev.callId === data.callId) {
          return { ...prev, status: 'ended' };
        }
        return prev;
      });
      setTimeout(() => setActiveCall(null), 1500);
    });

    newSocket.on('call:ended', (data: { callId: string; chatId: string }) => {
      setActiveCall((prev) => {
        if (prev && prev.callId === data.callId) {
          return { ...prev, status: 'ended', webStream: null };
        }
        return prev;
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    // Handle Co-browsing & Web Streaming Events
    newSocket.on('call:web_stream_started', (data: { chatId: string; callId: string; streamState: any }) => {
      setActiveCall((prev) => {
        if (prev && prev.chatId === data.chatId) {
          return { ...prev, webStream: data.streamState };
        }
        return prev;
      });
    });

    newSocket.on('call:web_stream_updated', (data: { chatId: string; callId: string; streamState: any }) => {
      setActiveCall((prev) => {
        if (prev && prev.chatId === data.chatId) {
          return { ...prev, webStream: data.streamState };
        }
        return prev;
      });
    });

    newSocket.on('call:web_stream_stopped', (data: { chatId: string; callId: string }) => {
      setActiveCall((prev) => {
        if (prev && prev.chatId === data.chatId) {
          return { ...prev, webStream: null };
        }
        return prev;
      });
    });

    // Handle Missed Call Event
    newSocket.on(
      'call:missed',
      (data: { id?: string; callerUsername: string; callerAvatar?: string; timestamp?: number; chatId: string; callType?: 'voice' | 'video' }) => {
        const item: MissedCallItem = {
          id: data.id || `missed_${Date.now()}`,
          callerUsername: data.callerUsername,
          callerAvatar: data.callerAvatar,
          timestamp: data.timestamp || Date.now(),
          chatId: data.chatId,
          callType: data.callType || 'voice',
        };
        setMissedCalls((prev) => [item, ...prev]);
        setShowMissedNotifications(true);
      }
    );

    // Handle Real-Time 24-Hour Stories Events
    newSocket.on('story:new', (newStory: Story) => {
      setStories((prev) => {
        if (prev.some((s) => s.id === newStory.id)) return prev;
        return [newStory, ...prev];
      });
    });

    newSocket.on('story:viewed', (data: { storyId: string; view: StoryView; totalViews: number }) => {
      setStories((prev) =>
        prev.map((s) => {
          if (s.id === data.storyId) {
            const views = s.views || [];
            if (!views.some((v) => v.username.toLowerCase() === data.view.username.toLowerCase())) {
              return { ...s, views: [...views, data.view] };
            }
          }
          return s;
        })
      );
    });

    newSocket.on('story:deleted', (data: { storyId: string }) => {
      setStories((prev) => prev.filter((s) => s.id !== data.storyId));
    });

    // Real-Time System Announcements
    newSocket.on('system:announcement', (ann: AnnouncementItem) => {
      setActiveAnnouncement(ann);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 2. Handle Incoming Real-Time Messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async (msg: Message) => {
      // Decrypt message text if encrypted
      let decryptedText = msg.text;
      if (
        msg.encryptedPayload &&
        msg.encryptedPayload.ciphertext &&
        cryptoKeys?.privateKey &&
        msg.senderUsername?.toLowerCase() !== currentUser?.username?.toLowerCase()
      ) {
        try {
          decryptedText = await decryptMessage(
            msg.encryptedPayload.ciphertext,
            msg.encryptedPayload.iv,
            msg.encryptedPayload.encryptedSymmetricKey,
            cryptoKeys.privateKey
          );
        } catch (e) {
          console.warn('E2EE decryption fallback to plain text:', e);
        }
      }

      const processedMsg: Message = {
        ...msg,
        text: decryptedText,
      };

      const isCurrentActive = msg.chatId === activeChatId;

      // Trigger Desktop Browser Notification if app is in background or message is in another chat
      if (
        msg.senderUsername?.toLowerCase() !== currentUser?.username?.toLowerCase() &&
        (document.hidden || !isCurrentActive)
      ) {
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`New message from @${msg.senderUsername}`, {
              body: decryptedText || 'Sent a file attachment',
              icon: currentUser?.avatarUrl,
            });
          } catch (e) {}
        }
      }

      // Update active messages if message belongs to open chat
      if (isCurrentActive) {
        setActiveMessages((prev) => {
          if (prev.some((m) => m.id === processedMsg.id)) return prev;
          return [...prev, processedMsg];
        });

        // Mark as read if user is viewing this active chat
        if (!document.hidden) {
          socket.emit('chat:mark_read', activeChatId);
        }
      }

      // Update lastMessage and unread counts in chat list
      setChats((prev) => {
        const exists = prev.some((c) => c.id === msg.chatId);
        if (exists) {
          return prev.map((c) => {
            if (c.id === msg.chatId) {
              const newUnread = isCurrentActive && !document.hidden ? 0 : (c.unreadCount || 0) + 1;
              return { ...c, lastMessage: processedMsg, unreadCount: newUnread };
            }
            return c;
          });
        } else {
          // Re-fetch chats list from server so new chat room instantly appears with unread badge
          socket.emit('chats:list', (chatList: Chat[]) => {
            if (chatList) setChats(chatList);
          });
          return prev;
        }
      });

      // Auto-activate chat if no active chat selected
      setActiveChatId((prev) => prev || msg.chatId);
    };

    const handleUpdatedMessage = (updatedMsg: Message) => {
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
      );
    };

    const handleMessageDeleted = (data: { chatId: string; messageId: string; lastMessage?: Message }) => {
      if (data.chatId === activeChatIdRef.current) {
        setActiveMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
      setChats((prev) =>
        prev.map((c) => (c.id === data.chatId ? { ...c, lastMessage: data.lastMessage } : c))
      );
    };

    const handleChatCleared = (data: { chatId: string }) => {
      if (data.chatId === activeChatIdRef.current) {
        setActiveMessages([]);
      }
      setChats((prev) =>
        prev.map((c) => (c.id === data.chatId ? { ...c, lastMessage: undefined } : c))
      );
    };

    const handleChatDeleted = (data: { chatId: string }) => {
      if (data.chatId === activeChatIdRef.current) {
        setActiveChatId(null);
        setActiveMessages([]);
      }
      setChats((prev) => prev.filter((c) => c.id !== data.chatId));
    };

    const handleChatUpdated = (updatedChat: Chat) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.id === updatedChat.id);
        if (exists) {
          return prev.map((c) =>
            c.id === updatedChat.id ? { ...c, ...updatedChat, unreadCount: c.unreadCount } : c
          );
        }
        return [updatedChat, ...prev];
      });
    };

    const handleChatNew = (newChat: Chat) => {
      setChats((prev) => {
        if (prev.some((c) => c.id === newChat.id)) return prev;
        return [newChat, ...prev];
      });
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleUpdatedMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('chat:cleared', handleChatCleared);
    socket.on('chat:deleted', handleChatDeleted);
    socket.on('chat:updated', handleChatUpdated);
    socket.on('chat:new', handleChatNew);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleUpdatedMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('chat:cleared', handleChatCleared);
      socket.off('chat:deleted', handleChatDeleted);
      socket.off('chat:updated', handleChatUpdated);
      socket.off('chat:new', handleChatNew);
    };
  }, [socket, activeChatId, cryptoKeys, currentUser]);

  // 3. Load Active Chat Messages when activeChatId changes
  useEffect(() => {
    if (!activeChatId) return;

    // Mark chat as read on server & clear unread badge in UI
    if (socket && isConnected) {
      socket.emit('chat:mark_read', activeChatId);
    }
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, unreadCount: 0 } : c))
    );

    // Fetch messages from REST endpoint
    fetch(`/api/chats/${activeChatId}/messages`)
      .then((res) => res.json())
      .then(async (msgs: Message[]) => {
        if (!Array.isArray(msgs)) return;
        const decryptedList = await Promise.all(
          msgs.map(async (msg) => {
            if (
              msg.encryptedPayload &&
              msg.encryptedPayload.ciphertext &&
              cryptoKeys?.privateKey &&
              msg.senderUsername?.toLowerCase() !== currentUser?.username?.toLowerCase()
            ) {
              try {
                const text = await decryptMessage(
                  msg.encryptedPayload.ciphertext,
                  msg.encryptedPayload.iv,
                  msg.encryptedPayload.encryptedSymmetricKey,
                  cryptoKeys.privateKey
                );
                return { ...msg, text };
              } catch (e) {
                console.warn('Decryption fallback to plain text for message:', msg.id, e);
                return msg;
              }
            }
            return msg;
          })
        );
        setActiveMessages(decryptedList);
        if (currentUser?.username) {
          const uname = currentUser.username.toLowerCase();
          localStorage.setItem(`batchit_msgs_${uname}_${activeChatId}`, JSON.stringify(decryptedList));
        }
      })
      .catch((err) => console.error('Error fetching chat messages', err));
  }, [activeChatId, cryptoKeys, currentUser, socket, isConnected]);

  // 4. Automatic Synchronization on App Tab Focus or Network Reconnection
  useEffect(() => {
    const syncOfflineMessages = () => {
      if (socket && isConnected) {
        socket.emit('chats:list', { username: currentUser?.username }, (chatList: Chat[]) => {
          if (Array.isArray(chatList) && chatList.length > 0) {
            setChats(chatList);
          }
        });

        if (activeChatId) {
          socket.emit('chat:mark_read', activeChatId);
          fetch(`/api/chats/${activeChatId}/messages`)
            .then((res) => res.json())
            .then(async (msgs: Message[]) => {
              if (!Array.isArray(msgs)) return;
              const decryptedList = await Promise.all(
                msgs.map(async (msg) => {
                  if (
                    msg.encryptedPayload &&
                    msg.encryptedPayload.ciphertext &&
                    cryptoKeys?.privateKey &&
                    msg.senderUsername?.toLowerCase() !== currentUser?.username?.toLowerCase()
                  ) {
                    try {
                      const text = await decryptMessage(
                        msg.encryptedPayload.ciphertext,
                        msg.encryptedPayload.iv,
                        msg.encryptedPayload.encryptedSymmetricKey,
                        cryptoKeys.privateKey
                      );
                      return { ...msg, text };
                    } catch (e) {
                      console.warn('Re-sync decryption warning:', e);
                      return msg;
                    }
                  }
                  return msg;
                })
              );
              setActiveMessages(decryptedList);
            })
            .catch((err) => console.error('Error re-syncing chat messages', err));
        }
      }
    };

    const handleOnlineOrVisible = () => {
      syncOfflineMessages();
      fetchStories();
    };

    window.addEventListener('online', handleOnlineOrVisible);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleOnlineOrVisible();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnlineOrVisible);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, isConnected, activeChatId, cryptoKeys, currentUser, fetchStories]);

  // Fallback REST fetch for user chats if socket list is empty or reconnecting
  useEffect(() => {
    if (currentUser?.username && chats.length === 0) {
      const uname = currentUser.username.toLowerCase();
      fetch(`/api/chats?username=${encodeURIComponent(currentUser.username)}`)
        .then((res) => res.json())
        .then((chatList: Chat[]) => {
          if (Array.isArray(chatList) && chatList.length > 0) {
            setChats(chatList);
            localStorage.setItem(`batchit_chats_${uname}`, JSON.stringify(chatList));
          }
        })
        .catch((err) => console.warn('REST fallback chat fetch warning:', err));
    }
  }, [currentUser, chats.length]);

  // Handle Successful Authentication (Login or Register)
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('batchit_user', JSON.stringify(user));

    if (socket) {
      // Fetch chats list & directory
      socket.emit('chats:list', { username: user.username }, (chatList: Chat[]) => {
        setChats(chatList || []);
        if (chatList && chatList.length > 0 && !activeChatId) {
          setActiveChatId(chatList[0].id);
        }
      });

      socket.emit('user:search', '', (users: User[]) => {
        setPublicUsers(users || []);
      });

      // Instantly load stories for newly authenticated/registered user
      fetchStories(user.username);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    if (currentUser?.username) {
      const uname = currentUser.username.toLowerCase();
      localStorage.removeItem(`batchit_chats_${uname}`);
      localStorage.removeItem(`batchit_active_chat_${uname}`);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`batchit_msgs_${uname}_`)) {
          localStorage.removeItem(key);
        }
      });
    }
    localStorage.removeItem('batchit_user');
    localStorage.removeItem('baatcheet_user');
    localStorage.removeItem('ciphertalk_user');
    setCurrentUser(null);
    setChats([]);
    setActiveChatId(null);
    setActiveMessages([]);
  };

  // Handle Account Deletion
  const handleDeleteAccount = () => {
    if (socketRef.current) {
      socketRef.current.emit('user:delete_account', (res: { success: boolean; message?: string }) => {
        if (res?.success) {
          if (currentUser?.username) {
            const uname = currentUser.username.toLowerCase();
            localStorage.removeItem(`batchit_chats_${uname}`);
            localStorage.removeItem(`batchit_active_chat_${uname}`);
            Object.keys(localStorage).forEach((key) => {
              if (key.startsWith(`batchit_msgs_${uname}_`)) {
                localStorage.removeItem(key);
              }
            });
          }
          localStorage.removeItem('batchit_user');
          localStorage.removeItem('batchit_keypair');
          localStorage.removeItem('baatcheet_user');
          localStorage.removeItem('ciphertalk_user');
          localStorage.removeItem('ciphertalk_keypair');
          setCurrentUser(null);
          setChats([]);
          setActiveChatId(null);
          setActiveMessages([]);
          setSelectedProfileUser(null);
          alert('Your account has been permanently deleted from the system.');
        } else {
          alert(res?.message || 'Failed to delete account.');
        }
      });
    }
  };

  // Handle Open Profile by Username string
  const handleOpenProfileByUsername = (targetUsername: string) => {
    if (!targetUsername) return;
    const existing = publicUsers.find(
      (u) => u.username.toLowerCase() === targetUsername.toLowerCase()
    );
    if (existing) {
      setSelectedProfileUser(existing);
    } else if (
      currentUser &&
      currentUser.username.toLowerCase() === targetUsername.toLowerCase()
    ) {
      setSelectedProfileUser(currentUser);
    } else if (socket) {
      socket.emit('user:get_profile', { targetUsername }, (res: any) => {
        if (res && res.username) {
          setSelectedProfileUser(res);
        } else {
          setSelectedProfileUser({
            id: targetUsername,
            username: targetUsername,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUsername}`,
            isOnline: false,
            lastSeen: Date.now(),
            joinedAt: Date.now(),
            publicKeyPem: '',
            keyFingerprint: '',
          });
        }
      });
    }
  };

  // Handle Start DM Chat with User
  const handleStartDm = (targetUsername: string) => {
    if (!socket) return;
    setIsFeedActive(false);
    socket.emit('chat:start_dm', targetUsername, (res: { chat?: Chat; messages?: Message[] }) => {
      if (res?.chat) {
        setChats((prev) => {
          if (prev.some((c) => c.id === res.chat!.id)) return prev;
          return [res.chat!, ...prev];
        });
        setActiveChatId(res.chat.id);
        setActiveMessages(res.messages || []);
      }
    });
  };

  // Handle Send Encrypted Message
  const handleSendMessage = async (
    text: string,
    attachment?: FileAttachment,
    replyTo?: Message
  ) => {
    if (!socket || !activeChatId || !currentUser) return;

    const currentChat = chats.find((c) => c.id === activeChatId);
    let encryptedPayload: any = undefined;

    // Encrypt DM message if recipient's public key is known
    if (currentChat && currentChat.type === 'direct') {
      const partner = currentChat.participants.find((p) => p.username !== currentUser.username);
      if (partner && partner.publicKeyPem) {
        try {
          const encResult = await encryptMessage(text, partner.publicKeyPem);
          encryptedPayload = encResult;
        } catch (e) {
          console.error('Failed to encrypt message payload', e);
        }
      }
    }

    socket.emit('message:send', {
      chatId: activeChatId,
      text,
      encryptedPayload,
      attachment,
      replyTo: replyTo
        ? { id: replyTo.id, senderUsername: replyTo.senderUsername, text: replyTo.text }
        : undefined,
    });
  };

  // Handle Emoji Reaction
  const handleSendReaction = (messageId: string, emoji: string) => {
    if (!socket || !activeChatId) return;
    socket.emit('message:react', { chatId: activeChatId, messageId, emoji });
  };

  // Handle Delete Message
  const handleDeleteMessage = (messageId: string) => {
    if (!socket || !activeChatId) return;
    socket.emit('message:delete', { chatId: activeChatId, messageId }, (res: any) => {
      if (res?.success) {
        setActiveMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    });
  };

  // Handle Clear Chat
  const handleClearChat = (chatId?: string) => {
    const targetId = chatId || activeChatId;
    if (!socket || !targetId) return;
    if (window.confirm('Are you sure you want to clear all messages in this conversation?')) {
      socket.emit('chat:clear', targetId, (res: any) => {
        if (res?.success) {
          if (targetId === activeChatId) {
            setActiveMessages([]);
          }
          setChats((prev) =>
            prev.map((c) => (c.id === targetId ? { ...c, lastMessage: undefined } : c))
          );
        }
      });
    }
  };

  // Handle Delete Chat
  const handleDeleteChat = (chatId?: string) => {
    const targetId = chatId || activeChatId;
    if (!socket || !targetId) return;
    if (window.confirm('Are you sure you want to delete this entire conversation?')) {
      socket.emit('chat:delete', targetId, (res: any) => {
        if (res?.success) {
          if (targetId === activeChatId) {
            setActiveChatId(null);
            setActiveMessages([]);
          }
          setChats((prev) => prev.filter((c) => c.id !== targetId));
        }
      });
    }
  };

  // Handle Profile Update
  const handleUpdateSelfProfile = (updates: {
    avatarUrl?: string;
    statusText?: string;
    bio?: string;
  }) => {
    if (!currentUser || !socket) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem('ciphertalk_user', JSON.stringify(updated));
    socket.emit('user:update_profile', updates);
  };

  // Handle Create Group
  const handleCreateGroup = (data: {
    name: string;
    description: string;
    memberUsernames: string[];
  }) => {
    if (!socket) return;
    socket.emit('group:create', data, (res: { group?: Chat; messages?: Message[] }) => {
      if (res?.group) {
        setChats((prev) => [res.group!, ...prev]);
        setActiveChatId(res.group.id);
        setActiveMessages(res.messages || []);
      }
    });
  };

  // Handle Update Group Details (Name, Description, Avatar)
  const handleUpdateGroupInfo = (data: {
    chatId: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
  }) => {
    if (!socket) return;
    socket.emit('group:update_info', data, (res: any) => {
      if (res?.group) {
        setChats((prev) =>
          prev.map((c) => (c.id === res.group.id ? { ...c, ...res.group } : c))
        );
      }
    });
  };

  // Handle Add Members to Group
  const handleAddGroupMembers = (data: {
    chatId: string;
    memberUsernames: string[];
  }) => {
    if (!socket) return;
    socket.emit('group:add_members', data, (res: any) => {
      if (res?.group) {
        setChats((prev) =>
          prev.map((c) => (c.id === res.group.id ? { ...c, ...res.group } : c))
        );
      }
    });
  };

  // Handle Remove Member from Group
  const handleRemoveGroupMember = (data: {
    chatId: string;
    targetUsername: string;
  }) => {
    if (!socket) return;
    socket.emit('group:remove_member', data, (res: any) => {
      if (res?.group) {
        setChats((prev) =>
          prev.map((c) => (c.id === res.group.id ? { ...c, ...res.group } : c))
        );
      }
    });
  };

  // Handle Toggle Group Admin Role
  const handleToggleGroupAdmin = (data: {
    chatId: string;
    targetUsername: string;
    makeAdmin: boolean;
  }) => {
    if (!socket) return;
    socket.emit('group:toggle_admin', data, (res: any) => {
      if (res?.group) {
        setChats((prev) =>
          prev.map((c) => (c.id === res.group.id ? { ...c, ...res.group } : c))
        );
      }
    });
  };

  // Handle Voice & Video Call Initiation & Handlers
  const handleInitiateCall = (chat: Chat, callType: 'voice' | 'video' = 'voice') => {
    if (!chat || !currentUser || !socket) return;
    const callId = `call_${Date.now()}`;
    const isGroup = chat.type === 'group';
    const partner = chat.participants.find((p) => p.username !== currentUser.username);
    const chatName = isGroup ? (chat.name || 'Group Chat') : (partner?.username || chat.name || 'Direct Chat');

    const callState: ActiveCallState = {
      callId,
      chatId: chat.id,
      chatName,
      chatAvatar: isGroup ? chat.avatarUrl : (partner?.avatarUrl || chat.avatarUrl),
      isGroup,
      callType,
      callerUsername: currentUser.username,
      participants: chat.participants,
      status: 'outgoing',
      isMuted: false,
      isVideoOff: false,
      isFrontCamera: true,
      isSpeakerOn: true,
    };

    setActiveCall(callState);

    socket.emit('call:initiate', {
      chatId: chat.id,
      callId,
      isGroup,
      chatName,
      callType,
      participants: chat.participants,
    });
  };

  const handleStartVoiceCall = () => {
    if (activeChat) {
      handleInitiateCall(activeChat, 'voice');
    }
  };

  const handleStartVideoCall = () => {
    if (activeChat) {
      handleInitiateCall(activeChat, 'video');
    }
  };

  const handleStartUserCall = (targetUser: User, callType: 'voice' | 'video') => {
    if (!socket || !currentUser) return;
    socket.emit('chats:get_or_create_dm', { targetUsername: targetUser.username }, (res: { chat?: Chat }) => {
      if (res?.chat) {
        setChats((prev) => {
          if (prev.some((c) => c.id === res.chat!.id)) return prev;
          return [res.chat!, ...prev];
        });
        setActiveChatId(res.chat.id);
        handleInitiateCall(res.chat, callType);
      }
    });
  };

  const handleAcceptCall = () => {
    if (!activeCall || !socket) return;
    setActiveCall((prev) => (prev ? { ...prev, status: 'connected', startTime: Date.now() } : null));
    socket.emit('call:accept', { chatId: activeCall.chatId, callId: activeCall.callId });
  };

  const handleRejectCall = () => {
    if (!activeCall || !socket) return;
    socket.emit('call:reject', { chatId: activeCall.chatId, callId: activeCall.callId });
    setActiveCall(null);
  };

  const handleEndCall = () => {
    if (!activeCall || !socket) return;
    socket.emit('call:end', { chatId: activeCall.chatId, callId: activeCall.callId });
    setActiveCall(null);
  };

  const handleToggleMuteCall = () => {
    setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null));
  };

  const handleToggleVideoCall = () => {
    setActiveCall((prev) => (prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null));
  };

  const handleToggleSpeakerCall = () => {
    setActiveCall((prev) => (prev ? { ...prev, isSpeakerOn: !prev.isSpeakerOn } : null));
  };

  const handleSwitchCamera = () => {
    setActiveCall((prev) => (prev ? { ...prev, isFrontCamera: !prev.isFrontCamera } : null));
  };

  // Memoized 24-Hour User Story Groups
  const userStoryGroups: UserStoryGroup[] = React.useMemo(() => {
    if (!currentUser) return [];
    const now = Date.now();
    const activeStories = stories.filter((s) => s.expiresAt > now);
    const currentUnameLower = (currentUser.username || '').toLowerCase().trim();

    // Group stories by normalized lowercase username
    const groupsMap = new Map<string, { originalUname: string; stories: Story[] }>();
    for (const s of activeStories) {
      const lower = (s.username || '').toLowerCase().trim();
      if (!lower) continue;
      if (!groupsMap.has(lower)) {
        groupsMap.set(lower, { originalUname: s.username, stories: [] });
      }
      groupsMap.get(lower)!.stories.push(s);
    }

    const result: UserStoryGroup[] = [];

    // 1. Current user group first (if exists)
    if (groupsMap.has(currentUnameLower)) {
      const ownData = groupsMap.get(currentUnameLower)!;
      ownData.stories.sort((a, b) => a.createdAt - b.createdAt);
      result.push({
        username: currentUser.username,
        userAvatar: currentUser.avatarUrl,
        isCurrentUser: true,
        hasUnseenStories: false,
        stories: ownData.stories,
        lastUpdated: ownData.stories[ownData.stories.length - 1].createdAt,
      });
      groupsMap.delete(currentUnameLower);
    }

    // 2. Other users' groups
    for (const [unameLower, data] of groupsMap.entries()) {
      data.stories.sort((a, b) => a.createdAt - b.createdAt);
      const publicUser = publicUsers.find(
        (u) => (u.username || '').toLowerCase().trim() === unameLower
      );
      const hasUnseen = data.stories.some(
        (s) =>
          !s.views?.some(
            (v) => (v.username || '').toLowerCase().trim() === currentUnameLower
          )
      );

      result.push({
        username: data.originalUname || unameLower,
        userAvatar:
          publicUser?.avatarUrl ||
          data.stories[0].userAvatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${data.originalUname || unameLower}`,
        isCurrentUser: false,
        hasUnseenStories: hasUnseen,
        stories: data.stories,
        lastUpdated: data.stories[data.stories.length - 1].createdAt,
      });
    }

    // Sort others: Unseen stories first, then most recently updated
    result.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      if (a.hasUnseenStories && !b.hasUnseenStories) return -1;
      if (!a.hasUnseenStories && b.hasUnseenStories) return 1;
      return b.lastUpdated - a.lastUpdated;
    });

    return result;
  }, [stories, currentUser, publicUsers]);

  // Story Actions Handlers
  const handleCreateStory = async (storyData: {
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
  }) => {
    if (!socket || !currentUser) throw new Error('Not connected');
    return new Promise<void>((resolve, reject) => {
      socket.emit('story:create', storyData, (res: { success: boolean; story?: Story; error?: string }) => {
        if (res?.success && res.story) {
          setStories((prev) => [res.story!, ...prev]);
          resolve();
        } else {
          reject(new Error(res?.error || 'Failed to create story'));
        }
      });
    });
  };

  const handleViewStory = (storyId: string) => {
    if (!socket) return;
    socket.emit('story:view', { storyId });
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!socket) return;
    return new Promise<void>((resolve, reject) => {
      socket.emit('story:delete', { storyId }, (res: { success: boolean; error?: string }) => {
        if (res?.success) {
          setStories((prev) => prev.filter((s) => s.id !== storyId));
          resolve();
        } else {
          reject(new Error(res?.error || 'Failed to delete story'));
        }
      });
    });
  };

  const handleReplyToStory = async (storyId: string, authorUsername: string, text: string) => {
    if (!socket) return;
    return new Promise<void>((resolve, reject) => {
      socket.emit(
        'story:reply',
        { storyId, authorUsername, text },
        (res: { success: boolean; message?: Message; chatId?: string; error?: string }) => {
          if (res?.success && res.chatId) {
            resolve();
          } else {
            reject(new Error(res?.error || 'Failed to send reply'));
          }
        }
      );
    });
  };

  const unreadChats = chats.filter((c) => (c.unreadCount || 0) > 0);
  const activeChat = chats.find((c) => c.id === activeChatId);

  return (
    <div className="w-screen h-[100dvh] bg-slate-950 font-sans text-slate-100 flex overflow-hidden antialiased">
      {/* About & Contact Us Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* Missed Calls & Unread Messages Startup Modal */}
      <MissedNotificationsModal
        isOpen={showMissedNotifications}
        missedCalls={missedCalls}
        unreadChats={unreadChats}
        onClose={() => setShowMissedNotifications(false)}
        onSelectChat={(chatId) => {
          setShowMissedNotifications(false);
          setActiveChatId(chatId);
        }}
        onCallBack={(callerUsername, type) => {
          setShowMissedNotifications(false);
          const target = publicUsers.find((u) => u.username.toLowerCase() === callerUsername.toLowerCase());
          if (target) {
            handleStartUserCall(target, type || 'voice');
          } else {
            handleStartDm(callerUsername);
          }
        }}
      />

      {/* 1. Onboarding Screen if User Not Registered */}
      {!currentUser ? (
        <OnboardingModal
          socket={socket}
          onAuthSuccess={handleAuthSuccess}
          isGeneratingKey={isGeneratingKeys}
          generatedFingerprint={cryptoKeys?.pem.fingerprint}
          generatedPem={cryptoKeys?.pem}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenAndroidInstall={() => setShowAndroidInstallModal(true)}
        />
      ) : (
        <>
          {/* 2. Main Sidebar Navigation with 24h Stories Tray */}
          <Sidebar
            currentUser={currentUser}
            chats={chats}
            publicUsers={publicUsers}
            userStoryGroups={userStoryGroups}
            onOpenCreateStory={() => setShowCreateStoryModal(true)}
            onOpenStoryViewer={(idx) => setActiveStoryViewerIndex(idx)}
            activeChatId={activeChatId || undefined}
            onSelectChat={(id) => {
              setIsFeedActive(false);
              setActiveChatId(id);
            }}
            onStartDm={handleStartDm}
            onOpenCreateGroup={() => setShowCreateGroup(true)}
            onOpenProfile={(u) => setSelectedProfileUser(u)}
            onOpenSecurityModal={() => setShowSecurityModal(true)}
            onOpenAboutModal={() => setShowAboutModal(true)}
            onOpenAndroidInstallModal={() => setShowAndroidInstallModal(true)}
            onOpenAdminPanel={() => setShowAdminPanel(true)}
            onLogout={handleLogout}
            onSearchUsers={handleSearchUsers}
            isSocketConnected={isConnected}
            onDeleteChat={handleDeleteChat}
            onOpenFeed={() => {
              setIsFeedActive(true);
              setActiveChatId(null);
            }}
            isFeedActive={isFeedActive}
          />

          {/* 3. Main Chat View Area OR Community Posts Feed */}
          {activeChat ? (
            <ChatArea
              chat={activeChat}
              messages={activeMessages}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onSendReaction={handleSendReaction}
              onStartTyping={() => socket?.emit('typing:start', activeChatId)}
              onStopTyping={() => socket?.emit('typing:stop', activeChatId)}
              typingUsers={typingUsers}
              onOpenProfile={(u) => setSelectedProfileUser(u)}
              onOpenGroupInfo={() => setShowGroupInfoModal(true)}
              onOpenSecurityModal={() => setShowSecurityModal(true)}
              onPreviewFile={(att) => setPreviewAttachment(att)}
              onStartVoiceCall={handleStartVoiceCall}
              onStartVideoCall={handleStartVideoCall}
              onBack={() => setActiveChatId(null)}
              onDeleteMessage={handleDeleteMessage}
              onClearChat={() => handleClearChat()}
              onDeleteChat={() => handleDeleteChat()}
            />
          ) : isFeedActive ? (
            <PostsFeed
              currentUser={currentUser}
              socket={socket}
              onOpenProfile={handleOpenProfileByUsername}
              onOpenFollowModal={(username, type) => setFollowListTarget({ username, type })}
              onStartChat={(username) => {
                setIsFeedActive(false);
                handleStartDm(username);
              }}
              onBack={() => setIsFeedActive(false)}
            />
          ) : (
            <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-slate-900 text-center space-y-4 select-none">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">End-to-End Encrypted Real-Time Workspace</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Select a conversation, browse the Public Directory, post a 24-hour story with images/videos, explore community posts, or create an encrypted group.
              </p>
              <div className="flex flex-wrap gap-3 pt-2 justify-center">
                <button
                  id="empty-state-feed-btn"
                  onClick={() => setIsFeedActive(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <Flame className="w-4 h-4" />
                  Explore Community Feed
                </button>
                <button
                  onClick={() => setShowCreateStoryModal(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition border border-slate-700/80 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add 24h Story
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition border border-slate-700/80"
                >
                  Create Encrypted Group
                </button>
              </div>
            </div>
          )}

          {/* 4. Create 24h Story Modal */}
          {showCreateStoryModal && (
            <CreateStoryModal
              isOpen={showCreateStoryModal}
              currentUser={currentUser}
              publicUsers={publicUsers}
              onClose={() => setShowCreateStoryModal(false)}
              onSubmitStory={handleCreateStory}
            />
          )}

          {/* 5. 24h Story Viewer Modal */}
          {activeStoryViewerIndex !== null && (
            <StoryViewerModal
              isOpen={activeStoryViewerIndex !== null}
              userStoryGroups={userStoryGroups}
              initialUserIndex={activeStoryViewerIndex}
              currentUser={currentUser}
              onClose={() => setActiveStoryViewerIndex(null)}
              onViewStory={handleViewStory}
              onDeleteStory={handleDeleteStory}
              onReplyToStory={handleReplyToStory}
            />
          )}

          {/* 6. User Profile Modal */}
          {selectedProfileUser && currentUser && (
            <UserProfileModal
              user={selectedProfileUser}
              isSelf={Boolean(
                selectedProfileUser.username &&
                  currentUser.username &&
                  selectedProfileUser.username.toLowerCase() === currentUser.username.toLowerCase()
              )}
              currentUser={currentUser}
              socket={socket}
              onClose={() => setSelectedProfileUser(null)}
              onUpdateSelf={handleUpdateSelfProfile}
              onStartDm={handleStartDm}
              onStartVoiceCall={(u) => handleStartUserCall(u, 'voice')}
              onStartVideoCall={(u) => handleStartUserCall(u, 'video')}
              onDeleteAccount={handleDeleteAccount}
              onOpenFollowList={(username, type) => setFollowListTarget({ username, type })}
              onViewPosts={() => {
                setIsFeedActive(true);
                setActiveChatId(null);
              }}
            />
          )}

          {/* 6.5 Connections (Followers & Following) Modal */}
          {followListTarget && (
            <FollowListModal
              isOpen={Boolean(followListTarget)}
              targetUsername={followListTarget.username}
              initialType={followListTarget.type}
              currentUser={currentUser}
              socket={socket}
              onClose={() => setFollowListTarget(null)}
              onStartChat={(username) => {
                setFollowListTarget(null);
                setIsFeedActive(false);
                handleStartDm(username);
              }}
            />
          )}

          {/* 7. Security & Key Vault Modal */}
          {showSecurityModal && cryptoKeys?.pem && (
            <SecurityKeyModal
              keyPairPem={cryptoKeys.pem}
              onClose={() => setShowSecurityModal(false)}
              onRegenerateKeys={async () => {
                const newKeys = await generateKeyPair();
                setCryptoKeys(newKeys);
                saveKeysToStorage(newKeys.pem);
                if (socket && currentUser) {
                  socket.emit('user:update_profile', {
                    publicKeyPem: newKeys.pem.publicKeyPem,
                    keyFingerprint: newKeys.pem.fingerprint,
                  });
                }
              }}
            />
          )}

          {/* 8. Create Group Modal */}
          {showCreateGroup && (
            <CreateGroupModal
              publicUsers={publicUsers}
              currentUsername={currentUser.username}
              onClose={() => setShowCreateGroup(false)}
              onCreateGroup={handleCreateGroup}
            />
          )}

          {/* 8.5 Group Info & Admin Management Modal */}
          {showGroupInfoModal && activeChat && activeChat.type === 'group' && (
            <GroupInfoModal
              chat={activeChat}
              currentUser={currentUser}
              publicUsers={publicUsers}
              onClose={() => setShowGroupInfoModal(false)}
              onUpdateGroupInfo={handleUpdateGroupInfo}
              onAddMembers={handleAddGroupMembers}
              onRemoveMember={handleRemoveGroupMember}
              onToggleAdmin={handleToggleGroupAdmin}
              onLeaveGroup={(chatId) =>
                handleRemoveGroupMember({ chatId, targetUsername: currentUser.username })
              }
              onDeleteGroup={handleDeleteChat}
              onOpenUserProfile={(u) => setSelectedProfileUser(u)}
              onStartDm={handleStartDm}
            />
          )}

          {/* 9. File Lightbox / Preview Modal */}
          {previewAttachment && (
            <FilePreviewModal
              attachment={previewAttachment}
              onClose={() => setPreviewAttachment(null)}
            />
          )}

          {/* 10. Active Voice & Video Call Modal */}
          {activeCall && (
            <CallModal
              callState={activeCall}
              currentUser={currentUser}
              socket={socket}
              onAcceptCall={handleAcceptCall}
              onRejectCall={handleRejectCall}
              onEndCall={handleEndCall}
              onToggleMute={handleToggleMuteCall}
              onToggleVideo={handleToggleVideoCall}
              onToggleSpeaker={handleToggleSpeakerCall}
              onSwitchCamera={handleSwitchCamera}
            />
          )}
        </>
      )}

      {/* 11. Android App & APK Installation Modal */}
      {showAndroidInstallModal && (
        <AndroidInstallModal
          isOpen={showAndroidInstallModal}
          onClose={() => setShowAndroidInstallModal(false)}
          deferredPrompt={deferredInstallPrompt}
          onInstallApp={handleInstallApp}
        />
      )}

      {/* 12. Superadmin Control Panel Modal */}
      {showAdminPanel && (
        <AdminPanelModal
          socket={socket}
          currentUser={currentUser}
          onClose={() => setShowAdminPanel(false)}
          onStartDm={handleStartDm}
          onSelectChat={(chatId) => setActiveChatId(chatId)}
        />
      )}

      {/* 13. Global Real-Time Announcement Banner */}
      <AnnouncementBanner
        announcement={activeAnnouncement}
        onDismiss={() => setActiveAnnouncement(null)}
      />
    </div>
  );
}
