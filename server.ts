import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  createUserInDb,
  getUserByUsernameFromDb,
  getAllUsersFromDb,
  updateUserPasswordInDb,
  updateUserProfileInDb,
  updateUserCredentialsInDb,
  deleteUserFromDb,
} from './src/db/users.ts';
import {
  saveChatToDb,
  deleteChatFromDb,
  saveMessageToDb,
  deleteMessageFromDb,
  clearChatMessagesInDb,
  getAllChatsFromDb,
  getAllMessagesFromDb,
} from './src/db/chats.ts';
import {
  saveStoryToDb,
  deleteStoryFromDb,
  getAllActiveStoriesFromDb,
} from './src/db/stories.ts';

interface UserRecord {
  id: string;
  username: string;
  passwordHash?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  avatarUrl: string;
  statusText: string;
  bio: string;
  isOnline: boolean;
  lastSeen: number;
  publicKeyPem: string;
  keyFingerprint: string;
  joinedAt: number;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`batchit_salt_${password}`).digest('hex');
}

function verifyPassword(storedHash: string | undefined, inputPassword: string): boolean {
  if (!storedHash) return true;
  if (storedHash === inputPassword) return true;

  const candidateSalts = [
    `batchit_salt_${inputPassword}`,
    `baatcheet_salt_${inputPassword}`,
    `ciphertalk_salt_${inputPassword}`,
    `salt_${inputPassword}`,
    inputPassword,
  ];

  for (const str of candidateSalts) {
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    if (hash === storedHash) return true;
  }

  return false;
}

function hashSecurityAnswer(answer: string): string {
  const normalized = answer.trim().toLowerCase();
  return crypto.createHash('sha256').update(`batchit_qa_${normalized}`).digest('hex');
}

function verifySecurityAnswer(storedAnswerHash: string | undefined, inputAnswer: string): boolean {
  if (!storedAnswerHash) return true;
  const normalized = inputAnswer.trim().toLowerCase();
  const rawTrimmed = inputAnswer.trim();

  if (storedAnswerHash.trim().toLowerCase() === normalized) return true;

  const candidateStrings = [
    `batchit_qa_${normalized}`,
    `baatcheet_qa_${normalized}`,
    `ciphertalk_qa_${normalized}`,
    `qa_${normalized}`,
    normalized,
    `batchit_qa_${rawTrimmed}`,
    `baatcheet_qa_${rawTrimmed}`,
    `ciphertalk_qa_${rawTrimmed}`,
    `qa_${rawTrimmed}`,
    rawTrimmed,
  ];

  for (const str of candidateStrings) {
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    if (hash === storedAnswerHash) return true;
  }

  return false;
}

async function findUserRecord(
  username: string,
  usersByUsername: Map<string, UserRecord>
): Promise<UserRecord | null> {
  const cleanUsername = (username || '').trim();
  if (!cleanUsername) return null;

  // 1. Direct match in memory
  if (usersByUsername.has(cleanUsername)) {
    return usersByUsername.get(cleanUsername)!;
  }

  // 2. Case-insensitive match in memory
  for (const u of usersByUsername.values()) {
    if (u.username.toLowerCase() === cleanUsername.toLowerCase()) {
      return u;
    }
  }

  // 3. Database lookup
  try {
    const dbUser = await getUserByUsernameFromDb(cleanUsername);
    if (dbUser) {
      const userRecord: UserRecord = {
        id: `usr_${dbUser.id}`,
        username: dbUser.username,
        passwordHash: dbUser.passwordHash,
        securityQuestion: dbUser.securityQuestion,
        securityAnswerHash: dbUser.securityAnswerHash,
        avatarUrl: dbUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dbUser.username}`,
        statusText: dbUser.statusText || 'Available to chat securely',
        bio: dbUser.bio || 'Batchit user',
        isOnline: false,
        lastSeen: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
        publicKeyPem: dbUser.publicKeyPem || '',
        keyFingerprint: dbUser.keyFingerprint || '',
        joinedAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      };
      usersByUsername.set(dbUser.username, userRecord);
      return userRecord;
    }
  } catch (err) {
    console.warn('DB lookup failed in findUserRecord:', err);
  }

  return null;
}

interface MessageRecord {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  encryptedPayload?: any;
  attachment?: any;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  isSystem?: boolean;
  replyTo?: any;
  reactions?: Record<string, string[]>;
}

interface ChatRecord {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  description?: string;
  participants: string[]; // usernames
  adminIds?: string[];
  lastMessage?: MessageRecord;
  createdAt: number;
}

interface MissedCallRecord {
  id: string;
  callId: string;
  chatId: string;
  chatName: string;
  callerUsername: string;
  callerAvatar?: string;
  timestamp: number;
  isGroup: boolean;
}

interface ActiveCallSession {
  callId: string;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  callerUsername: string;
  callerAvatar?: string;
  participants: string[];
  answeredUsers: Set<string>;
  startTime: number;
}

interface StoryRecord {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
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
  allowedUsernames: string[];
  createdAt: number;
  expiresAt: number;
  views: { username: string; viewedAt: number; userAvatar?: string }[];
}

interface PostCommentRecord {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  text: string;
  createdAt: number;
}

interface PostRecord {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  tags?: string[];
  likes: string[]; // usernames
  comments: PostCommentRecord[];
  createdAt: number;
  updatedAt?: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));

  // CORS Middleware for Express
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Static files from /public (PWA manifest, icons, sw.js)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Socket.io initialization
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 2e7, // 20MB for encrypted file sharing
  });

  // Server In-Memory & Disk Storage
  const usersByUsername = new Map<string, UserRecord>();
  const socketToUsername = new Map<string, string>();
  const chats = new Map<string, ChatRecord>();
  const chatMessages = new Map<string, MessageRecord[]>();
  const userLastReadMap = new Map<string, number>();
  const userMissedCalls = new Map<string, MissedCallRecord[]>();
  const activeCallSessions = new Map<string, ActiveCallSession>();
  const storiesMap = new Map<string, StoryRecord>();
  const followersMap = new Map<string, Set<string>>(); // username -> Set of follower usernames
  const followingMap = new Map<string, Set<string>>(); // username -> Set of usernames this user follows
  const postsMap = new Map<string, PostRecord>(); // postId -> PostRecord

  const CHATS_STORE_FILE = path.join(process.cwd(), 'chats_store.json');
  const ALT_CHATS_STORE_FILE = path.join('/tmp', 'chats_store.json');
  const STORIES_STORE_FILE = path.join(process.cwd(), 'stories_store.json');
  const ALT_STORIES_STORE_FILE = path.join('/tmp', 'stories_store.json');
  const FOLLOWS_STORE_FILE = path.join(process.cwd(), 'follows_store.json');
  const ALT_FOLLOWS_STORE_FILE = path.join('/tmp', 'follows_store.json');
  const POSTS_STORE_FILE = path.join(process.cwd(), 'posts_store.json');
  const ALT_POSTS_STORE_FILE = path.join('/tmp', 'posts_store.json');

  function getFollowStats(targetUsername: string, viewerUsername?: string) {
    const followers = followersMap.get(targetUsername) || new Set<string>();
    const following = followingMap.get(targetUsername) || new Set<string>();
    const isFollowing = viewerUsername ? followers.has(viewerUsername) : false;
    return {
      followersCount: followers.size,
      followingCount: following.size,
      isFollowing,
      followers: Array.from(followers),
      following: Array.from(following),
    };
  }

  function saveFollowsToDisk() {
    try {
      const data = {
        followers: Array.from(followersMap.entries()).map(([k, set]) => [k, Array.from(set)]),
        following: Array.from(followingMap.entries()).map(([k, set]) => [k, Array.from(set)]),
      };
      fs.writeFileSync(FOLLOWS_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      try {
        fs.writeFileSync(ALT_FOLLOWS_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {}
    } catch (err) {
      console.warn('[Storage] Failed to save follows:', err);
    }
  }

  function loadFollowsFromDisk() {
    try {
      const targetFile = fs.existsSync(FOLLOWS_STORE_FILE)
        ? FOLLOWS_STORE_FILE
        : fs.existsSync(ALT_FOLLOWS_STORE_FILE)
        ? ALT_FOLLOWS_STORE_FILE
        : null;

      if (targetFile) {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.followers)) {
          for (const [u, list] of data.followers) {
            followersMap.set(u, new Set(list));
          }
        }
        if (Array.isArray(data.following)) {
          for (const [u, list] of data.following) {
            followingMap.set(u, new Set(list));
          }
        }
      }
      console.log(`[Storage] Restored follow graphs.`);
    } catch (err) {
      console.warn('[Storage] Failed to load follows:', err);
    }
  }

  function savePostsToDisk() {
    try {
      const list = Array.from(postsMap.values());
      fs.writeFileSync(POSTS_STORE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      try {
        fs.writeFileSync(ALT_POSTS_STORE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (e) {}
    } catch (err) {
      console.warn('[Storage] Failed to save posts:', err);
    }
  }

  function loadPostsFromDisk() {
    try {
      const targetFile = fs.existsSync(POSTS_STORE_FILE)
        ? POSTS_STORE_FILE
        : fs.existsSync(ALT_POSTS_STORE_FILE)
        ? ALT_POSTS_STORE_FILE
        : null;

      if (targetFile) {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        const list: PostRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const p of list) {
            postsMap.set(p.id, p);
          }
        }
      }

      // Pre-seed sample posts if feed is empty
      if (postsMap.size === 0) {
        const welcomePost1: PostRecord = {
          id: 'post_welcome_1',
          userId: 'usr_batchit',
          username: 'batchit',
          userAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=batchit',
          content: '👋 Welcome to the new Batchit Community Feed! You can now share thoughts, upload media, explore hashtag topics, and follow friends. All messaging and voice calls remain end-to-end encrypted! 🛡️✨',
          tags: ['welcome', 'community', 'batchit', 'privacy', 'e2ee'],
          likes: ['batchit', 'ayush'],
          comments: [
            {
              id: 'c_welcome_1',
              postId: 'post_welcome_1',
              userId: 'usr_ayush',
              username: 'ayush',
              userAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ayush',
              text: 'The new follow option and posts feed look incredible! 🚀',
              createdAt: Date.now() - 3600000,
            }
          ],
          createdAt: Date.now() - 7200000,
        };

        const welcomePost2: PostRecord = {
          id: 'post_welcome_2',
          userId: 'usr_cybernova',
          username: 'CyberNova',
          userAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberNova',
          content: 'Just tested the encrypted voice and video call channels on mobile. Ultra low latency and crystal-clear audio! Follow me for privacy and cryptography engineering updates! 🎙️🔒',
          tags: ['security', 'calls', 'tech', 'updates'],
          likes: ['batchit'],
          comments: [],
          createdAt: Date.now() - 1800000,
        };

        postsMap.set(welcomePost1.id, welcomePost1);
        postsMap.set(welcomePost2.id, welcomePost2);
        savePostsToDisk();
      }

      console.log(`[Storage] Restored ${postsMap.size} community posts.`);
    } catch (err) {
      console.warn('[Storage] Failed to load posts:', err);
    }
  }

  function saveStoriesToDisk() {
    try {
      const now = Date.now();
      const activeStories = Array.from(storiesMap.values()).filter((s) => s.expiresAt > now);
      fs.writeFileSync(STORIES_STORE_FILE, JSON.stringify(activeStories, null, 2), 'utf-8');
      try {
        fs.writeFileSync(ALT_STORIES_STORE_FILE, JSON.stringify(activeStories, null, 2), 'utf-8');
      } catch (e) {}
    } catch (err) {
      console.warn('[Storage] Failed to save stories to disk:', err);
    }
  }

  async function loadStoriesFromDisk() {
    try {
      const targetFile = fs.existsSync(STORIES_STORE_FILE)
        ? STORIES_STORE_FILE
        : fs.existsSync(ALT_STORIES_STORE_FILE)
        ? ALT_STORIES_STORE_FILE
        : null;

      const now = Date.now();
      if (targetFile) {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        const list: StoryRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const s of list) {
            if (s.expiresAt > now) {
              storiesMap.set(s.id, s);
            }
          }
        }
      }

      // Also restore active stories from DB
      const dbStories = await getAllActiveStoriesFromDb();
      for (const s of dbStories) {
        if (!storiesMap.has(s.id) && s.expiresAt > now) {
          storiesMap.set(s.id, s as any);
        }
      }
      console.log(`[Storage] Restored ${storiesMap.size} active 24-hour stories.`);
    } catch (err) {
      console.warn('[Storage] Failed to load stories:', err);
    }
  }

  function saveChatsToDisk() {
    try {
      const data = {
        chats: Array.from(chats.entries()),
        messages: Array.from(chatMessages.entries()),
        userLastRead: Array.from(userLastReadMap.entries()),
      };
      fs.writeFileSync(CHATS_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      try {
        fs.writeFileSync(ALT_CHATS_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {}

      // Async DB Sync
      for (const [id, chat] of chats.entries()) {
        saveChatToDb(chat);
      }
      for (const [chatId, msgs] of chatMessages.entries()) {
        for (const msg of msgs) {
          saveMessageToDb(msg);
        }
      }
    } catch (err) {
      console.warn('[Storage] Failed to save chats to disk/db:', err);
    }
  }

  async function loadChatsFromDisk() {
    try {
      const targetFile = fs.existsSync(CHATS_STORE_FILE)
        ? CHATS_STORE_FILE
        : fs.existsSync(ALT_CHATS_STORE_FILE)
        ? ALT_CHATS_STORE_FILE
        : null;

      if (targetFile) {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.chats)) {
          for (const [id, chat] of data.chats) {
            if (chat.type === 'group' && (!chat.adminIds || chat.adminIds.length === 0) && chat.participants && chat.participants.length > 0) {
              chat.adminIds = [chat.participants[0]];
            }
            chats.set(id, chat);
          }
        }
        if (Array.isArray(data.messages)) {
          for (const [id, msgs] of data.messages) {
            chatMessages.set(id, msgs);
          }
        }
        if (Array.isArray(data.userLastRead)) {
          for (const [key, timestamp] of data.userLastRead) {
            userLastReadMap.set(key, timestamp);
          }
        }
        console.log(`[Storage] Restored ${chats.size} chats and ${chatMessages.size} message threads from disk.`);
      }
    } catch (err) {
      console.warn('[Storage] Failed to load chats from disk:', err);
    }

    try {
      const dbChats = await getAllChatsFromDb();
      for (const c of dbChats) {
        if (!chats.has(c.id)) {
          const adminIds = (c.adminIds && c.adminIds.length > 0) ? c.adminIds : (c.participants && c.participants.length > 0 ? [c.participants[0]] : []);
          chats.set(c.id, {
            id: c.id,
            type: c.type as any,
            name: c.name,
            description: c.description,
            avatarUrl: c.avatarUrl,
            participants: c.participants,
            adminIds: adminIds,
            createdAt: c.createdAt || Date.now(),
          });
        }
      }

      const dbMsgs = await getAllMessagesFromDb();
      for (const m of dbMsgs) {
        const list = chatMessages.get(m.chatId) || [];
        if (!list.some((existing) => existing.id === m.id)) {
          list.push({
            id: m.id,
            chatId: m.chatId,
            senderId: m.senderId,
            senderUsername: m.senderUsername,
            text: m.text,
            encryptedPayload: m.encryptedPayload,
            attachment: m.attachment,
            timestamp: m.timestamp,
            status: 'sent',
            replyTo: m.replyTo,
            reactions: m.reactions || {},
          });
          list.sort((a, b) => a.timestamp - b.timestamp);
          chatMessages.set(m.chatId, list);
        }
      }
      if (dbChats.length > 0 || dbMsgs.length > 0) {
        console.log(`[DB] Merged ${dbChats.length} chats and ${dbMsgs.length} messages from Cloud SQL DB.`);
      }
    } catch (err) {
      console.warn('[DB] Chat sync load warning:', err);
    }
  }

  loadChatsFromDisk();
  loadStoriesFromDisk();
  loadFollowsFromDisk();
  loadPostsFromDisk();

  // Banned / Forbidden usernames list
  const BANNED_USERNAMES = new Set(['ritika_sorari', 'ritikasorari']);

  // Administrator Master Credentials & Token Vault
  const ADMIN_USERNAME = 'batchit';
  const ADMIN_PASSWORD = 'ayushsorari123';
  const activeAdminTokens = new Set<string>();

  function isAuthorizedAdmin(token: string | undefined): boolean {
    if (!token) return false;
    return activeAdminTokens.has(token);
  }

  // Load existing users from Cloud SQL Database into in-memory storage
  const syncAllDbUsersToMemory = async () => {
    try {
      // Purge banned username ritika_sorari permanently from Database on server startup
      await deleteUserFromDb('ritika_sorari');
      await deleteUserFromDb('Ritika_sorari');
      await deleteUserFromDb('Ritika_Sorari');

      const dbUsers = await getAllUsersFromDb();
      for (const dbUser of dbUsers) {
        if (dbUser.username) {
          const cleanUname = dbUser.username.trim();
          if (BANNED_USERNAMES.has(cleanUname.toLowerCase())) {
            // Delete if somehow in DB
            await deleteUserFromDb(cleanUname);
            continue;
          }
          const existing = usersByUsername.get(cleanUname);
          if (!existing) {
            usersByUsername.set(cleanUname, {
              id: `usr_${dbUser.id}`,
              username: dbUser.username,
              passwordHash: dbUser.passwordHash,
              securityQuestion: dbUser.securityQuestion,
              securityAnswerHash: dbUser.securityAnswerHash,
              avatarUrl: dbUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dbUser.username}`,
              statusText: dbUser.statusText || 'Available to chat securely',
              bio: dbUser.bio || 'Batchit user',
              isOnline: false,
              lastSeen: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
              publicKeyPem: dbUser.publicKeyPem || '',
              keyFingerprint: dbUser.keyFingerprint || '',
              joinedAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
            });
          }
        }
      }

      // Provision or ensure superadmin account 'batchit' exists with password 'ayushsorari123'
      const adminPwdHash = hashPassword(ADMIN_PASSWORD);
      const adminQaHash = hashSecurityAnswer('ayushsorari123');
      const existingAdmin = usersByUsername.get(ADMIN_USERNAME);
      if (!existingAdmin) {
        try {
          const createdAdmin = await createUserInDb({
            username: ADMIN_USERNAME,
            passwordHash: adminPwdHash,
            securityQuestion: 'What is the master platform key?',
            securityAnswerHash: adminQaHash,
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=batchit_superadmin',
            statusText: 'Batchit Superadmin & Platform Moderator',
            bio: 'Super Administrator account with full platform governance and security controls.',
          });
          usersByUsername.set(ADMIN_USERNAME, {
            id: `usr_${createdAdmin.id}`,
            username: ADMIN_USERNAME,
            passwordHash: adminPwdHash,
            securityQuestion: 'What is the master platform key?',
            securityAnswerHash: adminQaHash,
            avatarUrl: createdAdmin.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=batchit_superadmin',
            statusText: 'Batchit Superadmin & Platform Moderator',
            bio: 'Super Administrator account with full platform governance and security controls.',
            isOnline: false,
            lastSeen: Date.now(),
            publicKeyPem: '',
            keyFingerprint: '',
            joinedAt: Date.now(),
          });
        } catch (e) {
          // If already in DB or insert fails, set in memory
          usersByUsername.set(ADMIN_USERNAME, {
            id: `usr_admin_master`,
            username: ADMIN_USERNAME,
            passwordHash: adminPwdHash,
            securityQuestion: 'What is the master platform key?',
            securityAnswerHash: adminQaHash,
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=batchit_superadmin',
            statusText: 'Batchit Superadmin & Platform Moderator',
            bio: 'Super Administrator account with full platform governance and security controls.',
            isOnline: false,
            lastSeen: Date.now(),
            publicKeyPem: '',
            keyFingerprint: '',
            joinedAt: Date.now(),
          });
        }
      } else {
        // Ensure admin password hash is up-to-date
        existingAdmin.passwordHash = adminPwdHash;
        updateUserPasswordInDb(ADMIN_USERNAME, adminPwdHash).catch(() => {});
      }
    } catch (err) {
      console.warn('[DB] Sync warning:', err);
    }
  };

  syncAllDbUsersToMemory().then(() => {
    console.log(`[DB] Initially loaded users into memory map.`);
  });

  // REST API Health Endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeConnections: io.sockets.sockets.size,
      registeredUsers: usersByUsername.size,
    });
  });

  // REST API Admin Login
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (
      (username || '').trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
      password === ADMIN_PASSWORD
    ) {
      const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
      activeAdminTokens.add(token);
      return res.json({
        success: true,
        token,
        admin: {
          username: ADMIN_USERNAME,
          role: 'Super Administrator',
        },
      });
    }
    return res.status(401).json({ success: false, error: 'Invalid master credentials.' });
  });

  // REST API Admin Stats & Data
  app.get('/api/admin/data', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim() || (req.query.token as string) || '';
    if (!isAuthorizedAdmin(token)) {
      return res.status(403).json({ success: false, error: 'Unauthorized admin access.' });
    }

    await syncAllDbUsersToMemory();

    const users = Array.from(usersByUsername.values()).map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      statusText: u.statusText,
      bio: u.bio,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
      joinedAt: u.joinedAt,
      keyFingerprint: u.keyFingerprint,
      publicKeyPem: u.publicKeyPem,
      hasPassword: Boolean(u.passwordHash),
      hasSecurityQuestion: Boolean(u.securityQuestion),
    }));

    const groups: any[] = [];
    let directCount = 0;
    let totalMessages = 0;

    for (const [id, chat] of chats.entries()) {
      const msgs = chatMessages.get(id) || [];
      totalMessages += msgs.length;

      if (chat.type === 'group') {
        const participantUsers = (await Promise.all(
          chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
        )).filter(Boolean) as UserRecord[];

        groups.push({
          id: chat.id,
          name: chat.name,
          description: chat.description,
          avatarUrl: chat.avatarUrl,
          participants: participantUsers,
          adminIds: chat.adminIds || (chat.participants.length > 0 ? [chat.participants[0]] : []),
          createdAt: chat.createdAt,
          messageCount: msgs.length,
          lastMessage: chat.lastMessage,
        });
      } else {
        directCount++;
      }
    }

    const stats = {
      totalUsers: users.length,
      onlineUsers: users.filter((u) => u.isOnline).length,
      totalGroups: groups.length,
      totalDirectChats: directCount,
      totalMessages,
      totalStories: Array.from(storiesMap.values()).filter((s) => s.expiresAt > Date.now()).length,
      activeSockets: io.sockets.sockets.size,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };

    res.json({ success: true, stats, users, groups });
  });

  // REST API Public User Search
  app.get('/api/users/search', async (req, res) => {
    await syncAllDbUsersToMemory();
    const query = ((req.query.q as string) || '').toLowerCase().trim();
    const all = Array.from(usersByUsername.values()).map(({ passwordHash, securityAnswerHash, ...publicUser }) => publicUser);
    if (!query) {
      return res.json(all.slice(0, 50));
    }
    const filtered = all.filter(
      (u) =>
        u.username.toLowerCase().includes(query) ||
        (u.statusText && u.statusText.toLowerCase().includes(query)) ||
        (u.bio && u.bio.toLowerCase().includes(query))
    );
    res.json(filtered);
  });

  // REST API User Chats fallback
  app.get('/api/chats', async (req, res) => {
    const username = ((req.query.username as string) || '').trim();
    if (!username) {
      return res.json([]);
    }

    const userChats: any[] = [];
    for (const [chatId, chat] of chats.entries()) {
      if (chat.participants.some((p) => p.toLowerCase() === username.toLowerCase())) {
        const participantUsers = await Promise.all(
          chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
        );
        const validParticipants = participantUsers.filter(Boolean) as UserRecord[];

        let chatName = chat.name;
        let chatAvatar = chat.avatarUrl;
        if (chat.type === 'direct') {
          const partner = validParticipants.find((p) => p.username.toLowerCase() !== username.toLowerCase()) || validParticipants[0];
          chatName = partner ? partner.username : 'Unknown User';
          chatAvatar = partner ? partner.avatarUrl : '';
        }

        const msgs = chatMessages.get(chatId) || [];
        const lastMsg = msgs[msgs.length - 1];

        const lastReadTimestamp = userLastReadMap.get(`${username.toLowerCase()}:${chatId}`) || 0;
        const unreadMsgs = msgs.filter(
          (m) => m.timestamp > lastReadTimestamp && m.senderUsername.toLowerCase() !== username.toLowerCase()
        );

        userChats.push({
          ...chat,
          name: chatName,
          avatarUrl: chatAvatar,
          participants: validParticipants,
          lastMessage: lastMsg,
          unreadCount: unreadMsgs.length,
        });
      }
    }

    userChats.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp || a.createdAt;
      const timeB = b.lastMessage?.timestamp || b.createdAt;
      return timeB - timeA;
    });

    res.json(userChats);
  });

  // REST API Chat Messages fallback
  app.get('/api/chats/:chatId/messages', (req, res) => {
    const { chatId } = req.params;
    const msgs = chatMessages.get(chatId) || [];
    res.json(msgs);
  });

  // REST API 24-Hour Stories
  app.get('/api/stories', (req, res) => {
    const username = ((req.query.username as string) || '').trim().toLowerCase();
    const now = Date.now();
    const visibleStories: StoryRecord[] = [];

    for (const story of storiesMap.values()) {
      // Filter out expired stories (24h)
      if (story.expiresAt <= now) continue;

      // Privacy check: public OR creator OR selected contact
      const isCreator = Boolean(username && story.username.toLowerCase() === username);
      const isPublic = story.privacy === 'public';
      const isSelected =
        Boolean(username) &&
        Array.isArray(story.allowedUsernames) &&
        story.allowedUsernames.some((u) => u.toLowerCase() === username);

      if (isPublic || isCreator || isSelected) {
        visibleStories.push(story);
      }
    }

    visibleStories.sort((a, b) => b.createdAt - a.createdAt);
    res.json(visibleStories);
  });

  // REST API Community Posts
  app.get('/api/posts', (req, res) => {
    const filter = (req.query.filter as string) || 'all';
    const viewer = ((req.query.viewer as string) || '').trim().toLowerCase();
    const targetUsername = ((req.query.username as string) || '').trim().toLowerCase();

    let allPosts = Array.from(postsMap.values()).sort((a, b) => b.createdAt - a.createdAt);

    if (filter === 'user' && targetUsername) {
      allPosts = allPosts.filter((p) => p.username.toLowerCase() === targetUsername);
    } else if (filter === 'following' && viewer) {
      const followingSet = followingMap.get(viewer) || new Set<string>();
      allPosts = allPosts.filter(
        (p) => followingSet.has(p.username) || p.username.toLowerCase() === viewer
      );
    }

    res.json({ success: true, posts: allPosts });
  });

  // REST API Single Post
  app.get('/api/posts/:postId', (req, res) => {
    const post = postsMap.get(req.params.postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  });

  // REST API User Follow Stats
  app.get('/api/users/:username/follow-stats', (req, res) => {
    const targetUsername = req.params.username;
    const viewer = req.query.viewer as string | undefined;
    const stats = getFollowStats(targetUsername, viewer);
    res.json({ success: true, stats });
  });

  // Active Web Streams for synchronized co-browsing in calls: chatId -> WebStreamState
  const activeWebStreams = new Map<string, {
    isActive: boolean;
    url: string;
    title?: string;
    streamerUsername: string;
    streamerAvatar?: string;
    startedAt: number;
    scrollY?: number;
    pointer?: { x: number; y: number; active: boolean; username: string } | null;
    allowCollaborativeControl?: boolean;
    zoom?: number;
    mode?: 'proxy' | 'direct';
  }>();

  // Web Stream Proxy API: Strips X-Frame-Options, CSP, and injects base tag for embedded co-browsing
  app.get('/api/web-stream/proxy', async (req, res) => {
    try {
      let targetUrl = ((req.query.url as string) || '').trim();
      if (!targetUrl) {
        return res.status(400).send('Missing target URL parameter.');
      }
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      // Add a 10s timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
      const proxyEndpoint = `${protocol}://${host}/api/web-stream/proxy`;

      // Set broad permissive headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('Content-Security-Policy-Report-Only');
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.removeHeader('Cross-Origin-Embedder-Policy');
      res.removeHeader('Cross-Origin-Resource-Policy');
      res.setHeader('X-Frame-Options', 'ALLOWALL');

      if (contentType.includes('text/html') || !contentType) {
        let html = await response.text();
        const finalUrl = response.url || targetUrl;

        // Base tag so relative assets (CSS, images, fonts) load correctly from the origin host
        const baseTag = `<base href="${finalUrl}">`;

        // Interactive stream helper script: intercepts clicks & forms to route through proxy
        const streamScript = `
          <script>
            (function() {
              window.__BATCHIT_STREAM_ACTIVE__ = true;
              var PROXY_ENDPOINT = ${JSON.stringify(proxyEndpoint)};
              var CURRENT_PAGE_URL = ${JSON.stringify(finalUrl)};
              var realParent = window.parent;

              function navigateToUrl(destUrl) {
                if (!destUrl) return;
                try {
                  var parsed = new URL(destUrl, CURRENT_PAGE_URL).href;
                  if (parsed.startsWith('http://') || parsed.startsWith('https://')) {
                    if (realParent && realParent !== window) {
                      try {
                        realParent.postMessage({ type: 'WEB_STREAM_NAVIGATE', url: parsed }, '*');
                      } catch (e) {}
                    }
                    window.location.href = PROXY_ENDPOINT + '?url=' + encodeURIComponent(parsed);
                  }
                } catch (err) {
                  console.warn('Navigation error:', err);
                }
              }

              // Intercept clicks on links, buttons, and elements inside anchors
              document.addEventListener('click', function(e) {
                var a = e.target && e.target.closest ? e.target.closest('a, area') : null;
                if (!a) return;

                var rawHref = a.getAttribute('href');
                if (!rawHref) return;

                // Allow in-page hash anchors to scroll normally (#section, #comments)
                if (rawHref.startsWith('#')) return;
                if (rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;

                var href = a.href;
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                  if (href.startsWith(PROXY_ENDPOINT)) return;

                  e.preventDefault();
                  e.stopPropagation();
                  navigateToUrl(href);
                }
              }, true);

              // Intercept search and navigation Form submissions
              document.addEventListener('submit', function(e) {
                var form = e.target;
                if (!form) return;

                var method = (form.method || 'GET').toUpperCase();
                if (method === 'GET') {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    var formData = new FormData(form);
                    var params = new URLSearchParams(formData).toString();
                    var actionUrl = new URL(form.getAttribute('action') || '', CURRENT_PAGE_URL).href;
                    var fullUrl = actionUrl + (actionUrl.includes('?') ? '&' : '?') + params;
                    navigateToUrl(fullUrl);
                  } catch (err) {
                    navigateToUrl(form.action || CURRENT_PAGE_URL);
                  }
                }
              }, true);

              // Override window.open
              try {
                window.open = function(url) {
                  if (url) {
                    navigateToUrl(url);
                  }
                  return null;
                };
              } catch(e) {}

              // Disable beforeunload dialogs
              try {
                window.onbeforeunload = null;
              } catch(e) {}
            })();
          </script>
        `;

        // Strip target="_blank" so links navigate internally
        html = html
          .replace(/\btarget=["']_blank["']/gi, 'target="_self"')
          .replace(/\btarget=["']_top["']/gi, 'target="_self"')
          .replace(/\btarget=["']_parent["']/gi, 'target="_self"');

        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}${streamScript}`);
        } else if (html.includes('<head ')) {
          html = html.replace(/<head[^>]*>/, `$&${baseTag}${streamScript}`);
        } else {
          html = `<head>${baseTag}${streamScript}</head>` + html;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      } else {
        // Direct media / non-html assets
        res.setHeader('Content-Type', contentType);
        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
    } catch (err: any) {
      console.error('[WebStream Proxy Error]', err?.message);
      const requestedUrl = (req.query.url as string) || '';
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Website Preview - BatchIt Call Stream</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #020617;
              color: #f8fafc;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
              text-align: center;
            }
            .card {
              max-width: 520px;
              background: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 20px;
              padding: 36px 28px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            }
            .icon { font-size: 48px; margin-bottom: 16px; }
            h2 { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-bottom: 12px; }
            p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .url-badge {
              display: inline-block;
              padding: 6px 14px;
              background: #1e293b;
              color: #38bdf8;
              border-radius: 9999px;
              font-size: 13px;
              font-family: monospace;
              margin-bottom: 24px;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .btn-group { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
            .btn {
              padding: 10px 20px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 600;
              text-decoration: none;
              cursor: pointer;
              transition: all 0.2s;
              border: none;
            }
            .btn-primary { background: #10b981; color: #ffffff; }
            .btn-primary:hover { background: #059669; }
            .btn-secondary { background: #334155; color: #f8fafc; }
            .btn-secondary:hover { background: #475569; }
            .tip {
              margin-top: 20px;
              font-size: 12px;
              color: #64748b;
              border-top: 1px solid #1e293b;
              padding-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🌐</div>
            <h2>Live Website Stream</h2>
            <div class="url-badge">${requestedUrl || 'Streaming Active'}</div>
            <p>This website (${requestedUrl}) has strict anti-embedding rules or protected resources. You can view it directly or switch to the <strong>Native Tab Live Stream</strong> for full audio & visual streaming!</p>
            <div class="btn-group">
              <a href="${requestedUrl}" target="_blank" rel="noreferrer" class="btn btn-primary">Open in New Tab ↗</a>
              <a href="/api/web-stream/proxy?url=https://en.wikipedia.org" class="btn btn-secondary">Try Wikipedia</a>
            </div>
            <div class="tip">
              💡 <strong>Tip for Streamers:</strong> Use the <strong>"Stream Browser Tab"</strong> button in the call toolbar for 100% video & sound streaming of any site.
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Helper to generate normalized DM Chat ID
  const getDmChatId = (userA: string, userB: string) => {
    const sorted = [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  };

  // Socket.io Connection Logic
  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Register account (New user with credentials & security question)
    socket.on('auth:register', async (data: {
      username: string;
      password: string;
      securityQuestion: string;
      securityAnswer: string;
      avatarUrl?: string;
      statusText?: string;
      bio?: string;
      publicKeyPem?: string;
      keyFingerprint?: string;
    }, ack) => {
      const cleanUsername = (data.username || '').trim();
      if (!cleanUsername || cleanUsername.length < 3) {
        return ack ? ack({ success: false, error: 'Username must be at least 3 characters long.' }) : null;
      }
      if (BANNED_USERNAMES.has(cleanUsername.toLowerCase())) {
        return ack ? ack({ success: false, error: 'This username is permanently restricted and cannot be registered.' }) : null;
      }
      if (!data.password || data.password.length < 4) {
        return ack ? ack({ success: false, error: 'Password must be at least 4 characters long.' }) : null;
      }
      if (!data.securityQuestion || !data.securityAnswer || !data.securityAnswer.trim()) {
        return ack ? ack({ success: false, error: 'Please select a security question and provide an answer.' }) : null;
      }

      // Check if user already exists
      let existing = await findUserRecord(cleanUsername, usersByUsername);
      if (existing) {
        return ack ? ack({ success: false, error: 'Username already taken. Please log in or choose a different username.' }) : null;
      }

      const pwdHash = hashPassword(data.password);
      const qaHash = hashSecurityAnswer(data.securityAnswer);

      let newUserRecord: UserRecord;
      try {
        const dbUser = await createUserInDb({
          username: cleanUsername,
          passwordHash: pwdHash,
          securityQuestion: data.securityQuestion,
          securityAnswerHash: qaHash,
          avatarUrl: data.avatarUrl,
          statusText: data.statusText,
          bio: data.bio,
          publicKeyPem: data.publicKeyPem,
          keyFingerprint: data.keyFingerprint,
        });

        newUserRecord = {
          id: `usr_${dbUser.id}`,
          username: dbUser.username,
          passwordHash: dbUser.passwordHash,
          securityQuestion: dbUser.securityQuestion,
          securityAnswerHash: dbUser.securityAnswerHash,
          avatarUrl: dbUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dbUser.username}`,
          statusText: dbUser.statusText || 'Available to chat securely',
          bio: dbUser.bio || 'CipherTalk user',
          isOnline: true,
          lastSeen: Date.now(),
          publicKeyPem: dbUser.publicKeyPem || '',
          keyFingerprint: dbUser.keyFingerprint || '',
          joinedAt: Date.now(),
        };
      } catch (err) {
        console.warn('Fallback to memory for user registration:', err);
        newUserRecord = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          username: cleanUsername,
          passwordHash: pwdHash,
          securityQuestion: data.securityQuestion,
          securityAnswerHash: qaHash,
          avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
          statusText: data.statusText || 'Available to chat securely',
          bio: data.bio || 'CipherTalk user',
          isOnline: true,
          lastSeen: Date.now(),
          publicKeyPem: data.publicKeyPem || '',
          keyFingerprint: data.keyFingerprint || '',
          joinedAt: Date.now(),
        };
      }

      usersByUsername.set(cleanUsername, newUserRecord);
      usersByUsername.set(cleanUsername.toLowerCase(), newUserRecord);
      socketToUsername.set(socket.id, cleanUsername);
      socket.join(`user:${cleanUsername}`);
      socket.join(`user:${cleanUsername.toLowerCase()}`);

      const { passwordHash, securityAnswerHash, ...publicUser } = newUserRecord;

      // Broadcast user online & updated directory to all clients
      io.emit('directory:user_updated', publicUser);
      io.emit('user:status_changed', { username: cleanUsername, isOnline: true, lastSeen: Date.now() });

      if (ack) ack({ success: true, user: publicUser });
    });

    // Login (Returning user with username & password)
    socket.on('auth:login', async (data: {
      username: string;
      password: string;
      publicKeyPem?: string;
      keyFingerprint?: string;
    }, ack) => {
      const cleanUsername = (data.username || '').trim();
      if (!cleanUsername) {
        return ack ? ack({ success: false, error: 'Please enter your username.' }) : null;
      }
      if (!data.password) {
        return ack ? ack({ success: false, error: 'Please enter your password.' }) : null;
      }

      let user = await findUserRecord(cleanUsername, usersByUsername);

      if (!user) {
        return ack ? ack({ success: false, error: 'Account not found for this username. Please create an account.' }) : null;
      }

      // Compare password using candidate salts
      if (!verifyPassword(user.passwordHash, data.password)) {
        return ack ? ack({ success: false, error: 'Incorrect password. Please try again or use "Forgot Password?".' }) : null;
      }

      // Automatically upgrade password hash to current salt scheme if needed
      const currentPwdHash = hashPassword(data.password);
      if (user.passwordHash !== currentPwdHash) {
        user.passwordHash = currentPwdHash;
        updateUserPasswordInDb(user.username, currentPwdHash).catch(() => {});
      }

      // Update user status and key if provided
      if (data.publicKeyPem) user.publicKeyPem = data.publicKeyPem;
      if (data.keyFingerprint) user.keyFingerprint = data.keyFingerprint;
      user.isOnline = true;
      user.lastSeen = Date.now();

      usersByUsername.set(user.username, user);
      usersByUsername.set(user.username.toLowerCase(), user);
      socketToUsername.set(socket.id, user.username);
      socket.join(`user:${user.username}`);
      socket.join(`user:${user.username.toLowerCase()}`);

      updateUserProfileInDb(user.username, {
        publicKeyPem: user.publicKeyPem,
        keyFingerprint: user.keyFingerprint,
      }).catch(() => {});

      const { passwordHash, securityAnswerHash, ...publicUser } = user;

      // Broadcast user online & updated directory
      io.emit('directory:user_updated', publicUser);
      io.emit('user:status_changed', { username: user.username, isOnline: true, lastSeen: Date.now() });

      // Auto-rejoin user's chats
      for (const [chatId, chat] of chats.entries()) {
        if (chat.participants.some((p) => p.toLowerCase() === user.username.toLowerCase())) {
          socket.join(chatId);
        }
      }

      if (ack) ack({ success: true, user: publicUser });
    });

    // Get Security Question for Forgot Password
    socket.on('auth:get_security_question', async (username: string, ack) => {
      const cleanUsername = (username || '').trim();
      if (!cleanUsername) {
        return ack ? ack({ success: false, error: 'Please enter a username.' }) : null;
      }

      let user = await findUserRecord(cleanUsername, usersByUsername);

      if (!user || !user.securityQuestion) {
        return ack ? ack({ success: false, error: 'Username not found or no security question set for this account.' }) : null;
      }

      if (ack) ack({ success: true, username: user.username, securityQuestion: user.securityQuestion });
    });

    // Reset Password via Security Question
    socket.on('auth:reset_password', async (data: {
      username: string;
      securityAnswer: string;
      newPassword: string;
    }, ack) => {
      const cleanUsername = (data.username || '').trim();
      if (!cleanUsername) {
        return ack ? ack({ success: false, error: 'Username is required.' }) : null;
      }
      if (!data.securityAnswer || !data.securityAnswer.trim()) {
        return ack ? ack({ success: false, error: 'Security answer is required.' }) : null;
      }
      if (!data.newPassword || data.newPassword.length < 4) {
        return ack ? ack({ success: false, error: 'New password must be at least 4 characters long.' }) : null;
      }

      let user = await findUserRecord(cleanUsername, usersByUsername);

      if (!user) {
        return ack ? ack({ success: false, error: 'Username not found.' }) : null;
      }

      if (!verifySecurityAnswer(user.securityAnswerHash, data.securityAnswer)) {
        return ack ? ack({ success: false, error: 'Incorrect security answer. Please check your answer and try again.' }) : null;
      }

      const newPwdHash = hashPassword(data.newPassword);
      const newQaHash = hashSecurityAnswer(data.securityAnswer);

      user.passwordHash = newPwdHash;
      user.securityAnswerHash = newQaHash;
      usersByUsername.set(user.username, user);

      try {
        await updateUserCredentialsInDb(user.username, {
          passwordHash: newPwdHash,
          securityAnswerHash: newQaHash,
        });
      } catch (e) {
        console.warn('Could not update password in database:', e);
      }

      if (ack) ack({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
    });

    // Register or rejoin user session
    socket.on('user:register', async (data: {
      username: string;
      avatarUrl?: string;
      statusText?: string;
      bio?: string;
      publicKeyPem?: string;
      keyFingerprint?: string;
    }) => {
      const username = (data.username || '').trim();
      if (!username) return;

      socketToUsername.set(socket.id, username);

      const existing = await findUserRecord(username, usersByUsername);
      const userRecord: UserRecord = {
        id: existing?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username: existing?.username || username,
        passwordHash: existing?.passwordHash,
        securityQuestion: existing?.securityQuestion,
        securityAnswerHash: existing?.securityAnswerHash,
        avatarUrl: data.avatarUrl || existing?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
        statusText: data.statusText || existing?.statusText || 'Available to chat securely',
        bio: data.bio || existing?.bio || 'Batchit user',
        isOnline: true,
        lastSeen: Date.now(),
        publicKeyPem: data.publicKeyPem || existing?.publicKeyPem || '',
        keyFingerprint: data.keyFingerprint || existing?.keyFingerprint || '',
        joinedAt: existing?.joinedAt || Date.now(),
      };

      usersByUsername.set(username, userRecord);
      usersByUsername.set(username.toLowerCase(), userRecord);

      socket.join(`user:${username}`);
      socket.join(`user:${username.toLowerCase()}`);

      console.log(`[Socket] User registered/rejoined: ${username} (${socket.id})`);

      const { passwordHash, securityAnswerHash, ...publicUser } = userRecord;

      // Acknowledge registration to client
      socket.emit('user:registered', publicUser);

      // Broadcast user online & updated directory to all clients
      io.emit('directory:user_updated', publicUser);
      io.emit('user:status_changed', { username, isOnline: true, lastSeen: Date.now() });

      // Auto-rejoin user's chats
      for (const [chatId, chat] of chats.entries()) {
        if (chat.participants.some((p) => p.toLowerCase() === username.toLowerCase())) {
          socket.join(chatId);
        }
      }
    });

    // Get User Profile
    socket.on('user:get_profile', (targetUsername: string, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      const u = usersByUsername.get(targetUsername);
      if (!u) {
        if (ack) ack(null);
        return;
      }
      const { passwordHash, securityAnswerHash, ...safeUser } = u;
      const stats = getFollowStats(u.username, currentUsername);
      const postsCount = Array.from(postsMap.values()).filter((p) => p.username.toLowerCase() === u.username.toLowerCase()).length;
      if (ack) {
        ack({
          ...safeUser,
          followersCount: stats.followersCount,
          followingCount: stats.followingCount,
          isFollowing: stats.isFollowing,
          postsCount,
        });
      }
    });

    // Update Profile
    socket.on('user:update_profile', (updates: Partial<UserRecord>) => {
      const username = socketToUsername.get(socket.id);
      if (!username) return;

      const current = usersByUsername.get(username);
      if (!current) return;

      const updated: UserRecord = {
        ...current,
        avatarUrl: updates.avatarUrl || current.avatarUrl,
        statusText: updates.statusText !== undefined ? updates.statusText : current.statusText,
        bio: updates.bio !== undefined ? updates.bio : current.bio,
        publicKeyPem: updates.publicKeyPem || current.publicKeyPem,
        keyFingerprint: updates.keyFingerprint || current.keyFingerprint,
      };

      usersByUsername.set(username, updated);
      io.emit('directory:user_updated', updated);
    });

    // Delete Account Handler
    socket.on('user:delete_account', async (ack) => {
      const username = socketToUsername.get(socket.id);
      if (!username) {
        if (ack) ack({ success: false, message: 'Not authenticated or user not found' });
        return;
      }

      console.log(`[Account] Permanent account deletion requested for: ${username}`);

      try {
        // Delete from database
        await deleteUserFromDb(username);

        // Delete from in-memory maps
        usersByUsername.delete(username);
        usersByUsername.delete(username.toLowerCase());
        socketToUsername.delete(socket.id);

        // Notify connected clients that user has been removed/offline
        io.emit('user:status_changed', { username, isOnline: false, lastSeen: Date.now() });
        io.emit('directory:user_deleted', { username });

        // Leave socket rooms
        socket.leave(`user:${username}`);
        socket.leave(`user:${username.toLowerCase()}`);

        if (ack) ack({ success: true });
      } catch (err) {
        console.error(`[Account] Error deleting account for ${username}:`, err);
        if (ack) ack({ success: false, message: 'Failed to delete account from database' });
      }
    });

    // Search Public Users
    socket.on('user:search', async (query: string, ack) => {
      const q = (query || '').toLowerCase().trim();

      // Ensure all users from Cloud SQL Database are loaded into memory map
      try {
        const dbUsers = await getAllUsersFromDb();
        for (const dbUser of dbUsers) {
          if (dbUser.username && !usersByUsername.has(dbUser.username)) {
            usersByUsername.set(dbUser.username, {
              id: `usr_${dbUser.id}`,
              username: dbUser.username,
              passwordHash: dbUser.passwordHash,
              securityQuestion: dbUser.securityQuestion,
              securityAnswerHash: dbUser.securityAnswerHash,
              avatarUrl: dbUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${dbUser.username}`,
              statusText: dbUser.statusText || 'Available to chat securely',
              bio: dbUser.bio || 'Batchit user',
              isOnline: false,
              lastSeen: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
              publicKeyPem: dbUser.publicKeyPem || '',
              keyFingerprint: dbUser.keyFingerprint || '',
              joinedAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
            });
          }
        }
      } catch (err) {
        console.warn('DB sync warning in user:search:', err);
      }

      const currentUsername = socketToUsername.get(socket.id);
      const all = Array.from(usersByUsername.values()).map(({ passwordHash, securityAnswerHash, ...publicUser }) => {
        const stats = getFollowStats(publicUser.username, currentUsername);
        const postsCount = Array.from(postsMap.values()).filter((p) => p.username.toLowerCase() === publicUser.username.toLowerCase()).length;
        return {
          ...publicUser,
          followersCount: stats.followersCount,
          followingCount: stats.followingCount,
          isFollowing: stats.isFollowing,
          postsCount,
        };
      });
      const results = q
        ? all.filter(
            (u) =>
              u.username.toLowerCase().includes(q) ||
              (u.statusText && u.statusText.toLowerCase().includes(q)) ||
              (u.bio && u.bio.toLowerCase().includes(q))
          )
        : all;
      if (ack) ack(results);
    });

    // Get All Active Chats for Current User
    socket.on('chats:list', async (dataOrAck?: any, maybeAck?: any) => {
      const ack = typeof dataOrAck === 'function' ? dataOrAck : maybeAck;
      const reqUsername =
        typeof dataOrAck === 'object' && dataOrAck?.username
          ? dataOrAck.username
          : typeof dataOrAck === 'string'
          ? dataOrAck
          : null;

      let username = socketToUsername.get(socket.id) || reqUsername;
      if (username) {
        socketToUsername.set(socket.id, username);
      }
      if (!username) return ack ? ack([]) : null;

      const userChats: any[] = [];
      for (const [chatId, chat] of chats.entries()) {
        if (chat.participants.some((p) => p.toLowerCase() === username.toLowerCase())) {
          // Ensure socket joins chat room
          socket.join(chatId);

          const participantUsers = await Promise.all(
            chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
          );
          const validParticipants = participantUsers.filter(Boolean) as UserRecord[];

          // Resolve display name / avatar for DM
          let chatName = chat.name;
          let chatAvatar = chat.avatarUrl;
          if (chat.type === 'direct') {
            const partner = validParticipants.find((p) => p.username.toLowerCase() !== username.toLowerCase()) || validParticipants[0];
            chatName = partner ? partner.username : 'Unknown User';
            chatAvatar = partner ? partner.avatarUrl : '';
          }

          const msgs = chatMessages.get(chatId) || [];
          const lastMsg = msgs[msgs.length - 1];

          // Calculate unread count for user
          const lastReadTimestamp = userLastReadMap.get(`${username.toLowerCase()}:${chatId}`) || 0;
          const unreadMsgs = msgs.filter(
            (m) => m.timestamp > lastReadTimestamp && m.senderUsername.toLowerCase() !== username.toLowerCase()
          );

          userChats.push({
            ...chat,
            name: chatName,
            avatarUrl: chatAvatar,
            participants: validParticipants,
            lastMessage: lastMsg,
            unreadCount: unreadMsgs.length,
          });
        }
      }

      // Sort by newest activity
      userChats.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || a.createdAt;
        const timeB = b.lastMessage?.timestamp || b.createdAt;
        return timeB - timeA;
      });

      if (ack) ack(userChats);
    });

    // Mark Chat as Read
    socket.on('chat:mark_read', (chatId: string) => {
      const username = socketToUsername.get(socket.id);
      if (!username || !chatId) return;
      userLastReadMap.set(`${username.toLowerCase()}:${chatId}`, Date.now());
      saveChatsToDisk();
    });

    // Start or Fetch Direct Chat
    socket.on('chat:start_dm', async (targetUsername: string, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ error: 'Not authenticated' }) : null;

      const targetUser = await findUserRecord(targetUsername, usersByUsername);
      if (!targetUser) return ack ? ack({ error: 'User not found' }) : null;

      const currentUserRecord = await findUserRecord(currentUsername, usersByUsername);

      const chatId = getDmChatId(currentUsername, targetUser.username);
      let chat = chats.get(chatId);

      if (!chat) {
        chat = {
          id: chatId,
          type: 'direct',
          participants: [currentUsername, targetUser.username],
          createdAt: Date.now(),
        };
        chats.set(chatId, chat);
        chatMessages.set(chatId, []);
        saveChatsToDisk();
      }

      // Join both users' sockets to room
      socket.join(chatId);
      io.to(`user:${currentUsername}`).socketsJoin(chatId);
      io.to(`user:${currentUsername.toLowerCase()}`).socketsJoin(chatId);
      io.to(`user:${targetUser.username}`).socketsJoin(chatId);
      io.to(`user:${targetUser.username.toLowerCase()}`).socketsJoin(chatId);

      const participantUsers = [
        currentUserRecord || { id: `usr_${currentUsername}`, username: currentUsername, avatarUrl: '', statusText: '', bio: '', isOnline: true, lastSeen: Date.now(), publicKeyPem: '', keyFingerprint: '', joinedAt: Date.now() },
        targetUser,
      ];

      const fullChatForCurrent = {
        ...chat,
        name: targetUser.username,
        avatarUrl: targetUser.avatarUrl,
        participants: participantUsers,
        lastMessage: (chatMessages.get(chatId) || []).slice(-1)[0],
        unreadCount: 0,
      };

      const fullChatForTarget = {
        ...chat,
        name: currentUsername,
        avatarUrl: currentUserRecord ? currentUserRecord.avatarUrl : '',
        participants: participantUsers,
        lastMessage: (chatMessages.get(chatId) || []).slice(-1)[0],
        unreadCount: 0,
      };

      // Notify target user and current user of new chat
      io.to(`user:${targetUser.username}`).emit('chat:new', fullChatForTarget);
      io.to(`user:${targetUser.username.toLowerCase()}`).emit('chat:new', fullChatForTarget);
      io.to(`user:${currentUsername}`).emit('chat:new', fullChatForCurrent);
      io.to(`user:${currentUsername.toLowerCase()}`).emit('chat:new', fullChatForCurrent);

      if (ack) ack({ chat: fullChatForCurrent, messages: chatMessages.get(chatId) || [] });
    });

    // Alias for chats:get_or_create_dm (used when starting calls or direct messages from user profiles)
    socket.on('chats:get_or_create_dm', async (data: { targetUsername: string } | string, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ error: 'Not authenticated' }) : null;

      const targetUsername = typeof data === 'string' ? data : data?.targetUsername;
      if (!targetUsername) return ack ? ack({ error: 'Missing targetUsername' }) : null;

      const targetUser = await findUserRecord(targetUsername, usersByUsername);
      if (!targetUser) return ack ? ack({ error: 'User not found' }) : null;

      const currentUserRecord = await findUserRecord(currentUsername, usersByUsername);
      const chatId = getDmChatId(currentUsername, targetUser.username);
      let chat = chats.get(chatId);

      if (!chat) {
        chat = {
          id: chatId,
          type: 'direct',
          participants: [currentUsername, targetUser.username],
          createdAt: Date.now(),
        };
        chats.set(chatId, chat);
        chatMessages.set(chatId, []);
        saveChatsToDisk();
      }

      socket.join(chatId);
      io.to(`user:${currentUsername}`).socketsJoin(chatId);
      io.to(`user:${currentUsername.toLowerCase()}`).socketsJoin(chatId);
      io.to(`user:${targetUser.username}`).socketsJoin(chatId);
      io.to(`user:${targetUser.username.toLowerCase()}`).socketsJoin(chatId);

      const participantUsers = [
        currentUserRecord || { id: `usr_${currentUsername}`, username: currentUsername, avatarUrl: '', statusText: '', bio: '', isOnline: true, lastSeen: Date.now(), publicKeyPem: '', keyFingerprint: '', joinedAt: Date.now() },
        targetUser,
      ];

      const fullChatForCurrent = {
        ...chat,
        name: targetUser.username,
        avatarUrl: targetUser.avatarUrl,
        participants: participantUsers,
        lastMessage: (chatMessages.get(chatId) || []).slice(-1)[0],
        unreadCount: 0,
      };

      const fullChatForTarget = {
        ...chat,
        name: currentUsername,
        avatarUrl: currentUserRecord ? currentUserRecord.avatarUrl : '',
        participants: participantUsers,
        lastMessage: (chatMessages.get(chatId) || []).slice(-1)[0],
        unreadCount: 0,
      };

      io.to(`user:${targetUser.username}`).emit('chat:new', fullChatForTarget);
      io.to(`user:${targetUser.username.toLowerCase()}`).emit('chat:new', fullChatForTarget);
      io.to(`user:${currentUsername}`).emit('chat:new', fullChatForCurrent);
      io.to(`user:${currentUsername.toLowerCase()}`).emit('chat:new', fullChatForCurrent);

      if (ack) ack({ chat: fullChatForCurrent, messages: chatMessages.get(chatId) || [], success: true });
    });

    // Create Group Chat
    socket.on('group:create', (data: {
      name: string;
      description?: string;
      avatarUrl?: string;
      memberUsernames: string[];
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ error: 'Not authenticated' }) : null;

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const participants = Array.from(new Set([currentUsername, ...data.memberUsernames]));

      const newGroup: ChatRecord = {
        id: groupId,
        type: 'group',
        name: data.name,
        description: data.description || 'Encrypted Group Chat',
        avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${data.name}`,
        participants,
        adminIds: [currentUsername],
        createdAt: Date.now(),
      };

      chats.set(groupId, newGroup);

      // System welcome message
      const sysMsg: MessageRecord = {
        id: `sys_${Date.now()}`,
        chatId: groupId,
        senderId: 'system',
        senderUsername: 'System',
        text: `🔒 Group "${data.name}" created by @${currentUsername}. All messages are end-to-end encrypted.`,
        timestamp: Date.now(),
        status: 'read',
        isSystem: true,
      };

      chatMessages.set(groupId, [sysMsg]);

      // Join all connected participants into group socket room
      participants.forEach((uname) => {
        io.to(`user:${uname}`).socketsJoin(groupId);
      });

      const participantUsers = participants
        .map((uname) => usersByUsername.get(uname))
        .filter(Boolean) as UserRecord[];

      const fullGroup = {
        ...newGroup,
        participants: participantUsers,
        lastMessage: sysMsg,
        unreadCount: 0,
      };

      // Notify all members
      io.to(groupId).emit('chat:new', fullGroup);

      saveChatsToDisk();

      if (ack) ack({ group: fullGroup, messages: [sysMsg] });
    });

    // Update Group Information (Name, Description, Avatar) - Admin only
    socket.on('group:update_info', async (data: {
      chatId: string;
      name?: string;
      description?: string;
      avatarUrl?: string;
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(data.chatId);
      if (!chat || chat.type !== 'group') {
        return ack ? ack({ success: false, error: 'Group chat not found' }) : null;
      }

      // Check if user is admin
      const adminList = chat.adminIds && chat.adminIds.length > 0 ? chat.adminIds : [chat.participants[0]];
      const isAdmin = adminList.some((a) => a.toLowerCase() === currentUsername.toLowerCase());
      if (!isAdmin) {
        return ack ? ack({ success: false, error: 'Only group admins can change group details.' }) : null;
      }

      const oldName = chat.name;
      if (data.name && data.name.trim()) chat.name = data.name.trim();
      if (data.description !== undefined) chat.description = data.description.trim();
      if (data.avatarUrl) chat.avatarUrl = data.avatarUrl;

      // System notification message
      const sysMsg: MessageRecord = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chatId: chat.id,
        senderId: 'system',
        senderUsername: 'System',
        text: `🔒 @${currentUsername} updated the group settings${data.name && data.name !== oldName ? ` (renamed to "${data.name.trim()}")` : ''}.`,
        timestamp: Date.now(),
        status: 'read',
        isSystem: true,
      };

      const list = chatMessages.get(chat.id) || [];
      list.push(sysMsg);
      chatMessages.set(chat.id, list);
      chat.lastMessage = sysMsg;
      saveChatsToDisk();

      const participantUsers = (await Promise.all(
        chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
      )).filter(Boolean) as UserRecord[];

      const fullChat = {
        ...chat,
        participants: participantUsers,
        lastMessage: sysMsg,
        unreadCount: 0,
      };

      // Broadcast update to room and all member rooms
      io.to(chat.id).emit('chat:updated', fullChat);
      io.to(chat.id).emit('message:new', sysMsg);

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:updated', fullChat);
        io.to(`user:${uname.toLowerCase()}`).emit('chat:updated', fullChat);
      }

      if (ack) ack({ success: true, group: fullChat });
    });

    // Add Members to Group Chat - Admin only
    socket.on('group:add_members', async (data: {
      chatId: string;
      memberUsernames: string[];
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(data.chatId);
      if (!chat || chat.type !== 'group') {
        return ack ? ack({ success: false, error: 'Group chat not found' }) : null;
      }

      const adminList = chat.adminIds && chat.adminIds.length > 0 ? chat.adminIds : [chat.participants[0]];
      const isAdmin = adminList.some((a) => a.toLowerCase() === currentUsername.toLowerCase());
      if (!isAdmin) {
        return ack ? ack({ success: false, error: 'Only group admins can add new members.' }) : null;
      }

      const existingLower = new Set(chat.participants.map((p) => p.toLowerCase()));
      const newlyAdded: string[] = [];

      for (const uname of data.memberUsernames) {
        const clean = (uname || '').trim();
        if (clean && !existingLower.has(clean.toLowerCase())) {
          existingLower.add(clean.toLowerCase());
          newlyAdded.push(clean);
        }
      }

      if (newlyAdded.length === 0) {
        return ack ? ack({ success: false, error: 'Selected users are already members of this group.' }) : null;
      }

      chat.participants.push(...newlyAdded);

      // Join sockets of newly added users to the group room
      newlyAdded.forEach((uname) => {
        io.to(`user:${uname}`).socketsJoin(chat.id);
        io.to(`user:${uname.toLowerCase()}`).socketsJoin(chat.id);
      });

      const addedListStr = newlyAdded.map((u) => `@${u}`).join(', ');
      const sysMsg: MessageRecord = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chatId: chat.id,
        senderId: 'system',
        senderUsername: 'System',
        text: `🔒 @${currentUsername} added ${addedListStr} to the group.`,
        timestamp: Date.now(),
        status: 'read',
        isSystem: true,
      };

      const list = chatMessages.get(chat.id) || [];
      list.push(sysMsg);
      chatMessages.set(chat.id, list);
      chat.lastMessage = sysMsg;
      saveChatsToDisk();

      const participantUsers = (await Promise.all(
        chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
      )).filter(Boolean) as UserRecord[];

      const fullChat = {
        ...chat,
        participants: participantUsers,
        lastMessage: sysMsg,
        unreadCount: 0,
      };

      // Notify new members with chat:new
      newlyAdded.forEach((uname) => {
        io.to(`user:${uname}`).emit('chat:new', fullChat);
        io.to(`user:${uname.toLowerCase()}`).emit('chat:new', fullChat);
      });

      // Broadcast update to all members
      io.to(chat.id).emit('chat:updated', fullChat);
      io.to(chat.id).emit('message:new', sysMsg);

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:updated', fullChat);
        io.to(`user:${uname.toLowerCase()}`).emit('chat:updated', fullChat);
      }

      if (ack) ack({ success: true, group: fullChat });
    });

    // Remove Member or Leave Group
    socket.on('group:remove_member', async (data: {
      chatId: string;
      targetUsername: string;
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(data.chatId);
      if (!chat || chat.type !== 'group') {
        return ack ? ack({ success: false, error: 'Group chat not found' }) : null;
      }

      const isLeavingSelf = data.targetUsername.toLowerCase() === currentUsername.toLowerCase();
      const adminList = chat.adminIds && chat.adminIds.length > 0 ? chat.adminIds : [chat.participants[0]];
      const isAdmin = adminList.some((a) => a.toLowerCase() === currentUsername.toLowerCase());

      if (!isAdmin && !isLeavingSelf) {
        return ack ? ack({ success: false, error: 'Only group admins can remove other members.' }) : null;
      }

      const targetUsername = data.targetUsername.trim();
      chat.participants = chat.participants.filter((p) => p.toLowerCase() !== targetUsername.toLowerCase());
      if (chat.adminIds) {
        chat.adminIds = chat.adminIds.filter((a) => a.toLowerCase() !== targetUsername.toLowerCase());
      }

      // If no admin left, promote the first remaining member as admin
      if ((!chat.adminIds || chat.adminIds.length === 0) && chat.participants.length > 0) {
        chat.adminIds = [chat.participants[0]];
      }

      // If no participants left, delete the group
      if (chat.participants.length === 0) {
        chats.delete(chat.id);
        chatMessages.delete(chat.id);
        saveChatsToDisk();
        deleteChatFromDb(chat.id);
        io.to(chat.id).emit('chat:deleted', { chatId: chat.id });
        return ack ? ack({ success: true, deleted: true }) : null;
      }

      const sysMsg: MessageRecord = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chatId: chat.id,
        senderId: 'system',
        senderUsername: 'System',
        text: isLeavingSelf
          ? `🔒 @${targetUsername} left the group.`
          : `🔒 @${currentUsername} removed @${targetUsername} from the group.`,
        timestamp: Date.now(),
        status: 'read',
        isSystem: true,
      };

      const list = chatMessages.get(chat.id) || [];
      list.push(sysMsg);
      chatMessages.set(chat.id, list);
      chat.lastMessage = sysMsg;
      saveChatsToDisk();

      // Notify the removed user
      io.to(`user:${targetUsername}`).emit('chat:deleted', { chatId: chat.id });
      io.to(`user:${targetUsername.toLowerCase()}`).emit('chat:deleted', { chatId: chat.id });

      const participantUsers = (await Promise.all(
        chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
      )).filter(Boolean) as UserRecord[];

      const fullChat = {
        ...chat,
        participants: participantUsers,
        lastMessage: sysMsg,
        unreadCount: 0,
      };

      io.to(chat.id).emit('chat:updated', fullChat);
      io.to(chat.id).emit('message:new', sysMsg);

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:updated', fullChat);
        io.to(`user:${uname.toLowerCase()}`).emit('chat:updated', fullChat);
      }

      if (ack) ack({ success: true, group: fullChat });
    });

    // Promote or Demote Group Admin
    socket.on('group:toggle_admin', async (data: {
      chatId: string;
      targetUsername: string;
      makeAdmin: boolean;
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(data.chatId);
      if (!chat || chat.type !== 'group') {
        return ack ? ack({ success: false, error: 'Group chat not found' }) : null;
      }

      const adminList = chat.adminIds && chat.adminIds.length > 0 ? chat.adminIds : [chat.participants[0]];
      const isAdmin = adminList.some((a) => a.toLowerCase() === currentUsername.toLowerCase());
      if (!isAdmin) {
        return ack ? ack({ success: false, error: 'Only group admins can assign admin roles.' }) : null;
      }

      const targetUsername = data.targetUsername.trim();
      let currentAdmins = chat.adminIds || [chat.participants[0]];

      if (data.makeAdmin) {
        if (!currentAdmins.some((a) => a.toLowerCase() === targetUsername.toLowerCase())) {
          currentAdmins.push(targetUsername);
        }
      } else {
        // Demote admin: ensure at least one admin remains
        if (currentAdmins.length <= 1 && currentAdmins.some((a) => a.toLowerCase() === targetUsername.toLowerCase())) {
          return ack ? ack({ success: false, error: 'Cannot demote the only remaining admin in the group.' }) : null;
        }
        currentAdmins = currentAdmins.filter((a) => a.toLowerCase() !== targetUsername.toLowerCase());
      }

      chat.adminIds = currentAdmins;

      const sysMsg: MessageRecord = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chatId: chat.id,
        senderId: 'system',
        senderUsername: 'System',
        text: data.makeAdmin
          ? `🔒 @${currentUsername} promoted @${targetUsername} to Group Admin.`
          : `🔒 @${currentUsername} dismissed @${targetUsername} from Group Admin role.`,
        timestamp: Date.now(),
        status: 'read',
        isSystem: true,
      };

      const list = chatMessages.get(chat.id) || [];
      list.push(sysMsg);
      chatMessages.set(chat.id, list);
      chat.lastMessage = sysMsg;
      saveChatsToDisk();

      const participantUsers = (await Promise.all(
        chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
      )).filter(Boolean) as UserRecord[];

      const fullChat = {
        ...chat,
        participants: participantUsers,
        lastMessage: sysMsg,
        unreadCount: 0,
      };

      io.to(chat.id).emit('chat:updated', fullChat);
      io.to(chat.id).emit('message:new', sysMsg);

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:updated', fullChat);
        io.to(`user:${uname.toLowerCase()}`).emit('chat:updated', fullChat);
      }

      if (ack) ack({ success: true, group: fullChat, adminIds: chat.adminIds });
    });

    // Send Message
    socket.on('message:send', (data: {
      chatId: string;
      text: string;
      encryptedPayload?: any;
      attachment?: any;
      replyTo?: any;
    }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ error: 'Not authenticated' }) : null;

      const chat = chats.get(data.chatId);
      if (!chat) return ack ? ack({ error: 'Chat not found' }) : null;

      const message: MessageRecord = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        chatId: data.chatId,
        senderId: usersByUsername.get(currentUsername)?.id || socket.id,
        senderUsername: currentUsername,
        text: data.text,
        encryptedPayload: data.encryptedPayload,
        attachment: data.attachment,
        timestamp: Date.now(),
        status: 'sent',
        replyTo: data.replyTo,
        reactions: {},
      };

      // Save message
      const list = chatMessages.get(data.chatId) || [];
      list.push(message);
      chatMessages.set(data.chatId, list);

      // Update chat last message
      chat.lastMessage = message;

      saveChatsToDisk();

      // Broadcast to room
      io.to(data.chatId).emit('message:new', message);

      // Also deliver directly to each participant's user room to ensure delivery
      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('message:new', message);
        io.to(`user:${uname.toLowerCase()}`).emit('message:new', message);
      }

      if (ack) ack({ success: true, message });
    });

    // Add Reaction to Message
    socket.on('message:react', (data: { chatId: string; messageId: string; emoji: string }) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return;

      const msgs = chatMessages.get(data.chatId);
      if (!msgs) return;

      const msg = msgs.find((m) => m.id === data.messageId);
      if (!msg) return;

      if (!msg.reactions) msg.reactions = {};

      const currentUsers = msg.reactions[data.emoji] || [];
      if (currentUsers.includes(currentUsername)) {
        // Remove reaction
        msg.reactions[data.emoji] = currentUsers.filter((u) => u !== currentUsername);
        if (msg.reactions[data.emoji].length === 0) {
          delete msg.reactions[data.emoji];
        }
      } else {
        // Add reaction
        msg.reactions[data.emoji] = [...currentUsers, currentUsername];
      }

      saveChatsToDisk();

      io.to(data.chatId).emit('message:updated', msg);
    });

    // Delete Single Message
    socket.on('message:delete', (data: { chatId: string; messageId: string }, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const msgs = chatMessages.get(data.chatId);
      if (!msgs) return ack ? ack({ success: false, error: 'Chat not found' }) : null;

      const msgIndex = msgs.findIndex((m) => m.id === data.messageId);
      if (msgIndex === -1) return ack ? ack({ success: false, error: 'Message not found' }) : null;

      msgs.splice(msgIndex, 1);
      chatMessages.set(data.chatId, msgs);

      const chat = chats.get(data.chatId);
      const newLastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
      if (chat) {
        chat.lastMessage = newLastMsg;
      }

      saveChatsToDisk();
      deleteMessageFromDb(data.messageId);

      io.to(data.chatId).emit('message:deleted', {
        messageId: data.messageId,
        lastMessage: newLastMsg,
      });

      if (chat) {
        for (const uname of chat.participants) {
          io.to(`user:${uname}`).emit('message:deleted', {
            chatId: data.chatId,
            messageId: data.messageId,
            lastMessage: newLastMsg,
          });
          io.to(`user:${uname.toLowerCase()}`).emit('message:deleted', {
            chatId: data.chatId,
            messageId: data.messageId,
            lastMessage: newLastMsg,
          });
        }
      }

      if (ack) ack({ success: true });
    });

    // Clear All Messages in Chat
    socket.on('chat:clear', (chatId: string, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(chatId);
      if (!chat) return ack ? ack({ success: false, error: 'Chat not found' }) : null;

      chatMessages.set(chatId, []);
      chat.lastMessage = undefined;

      saveChatsToDisk();
      clearChatMessagesInDb(chatId);

      io.to(chatId).emit('chat:cleared', { chatId });

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:cleared', { chatId });
        io.to(`user:${uname.toLowerCase()}`).emit('chat:cleared', { chatId });
      }

      if (ack) ack({ success: true });
    });

    // Delete Entire Chat Room
    socket.on('chat:delete', (chatId: string, ack) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) return ack ? ack({ success: false, error: 'Not authenticated' }) : null;

      const chat = chats.get(chatId);
      if (!chat) return ack ? ack({ success: false, error: 'Chat not found' }) : null;

      chats.delete(chatId);
      chatMessages.delete(chatId);

      saveChatsToDisk();
      deleteChatFromDb(chatId);

      io.to(chatId).emit('chat:deleted', { chatId });

      for (const uname of chat.participants) {
        io.to(`user:${uname}`).emit('chat:deleted', { chatId });
        io.to(`user:${uname.toLowerCase()}`).emit('chat:deleted', { chatId });
      }

      if (ack) ack({ success: true });
    });

    // Typing Indicators
    socket.on('typing:start', (chatId: string) => {
      const username = socketToUsername.get(socket.id);
      if (username) {
        socket.to(chatId).emit('typing:status', { chatId, username, isTyping: true });
      }
    });

    socket.on('typing:stop', (chatId: string) => {
      const username = socketToUsername.get(socket.id);
      if (username) {
        socket.to(chatId).emit('typing:status', { chatId, username, isTyping: false });
      }
    });

    // ==========================================
    // VOICE & VIDEO CALL WEBRTC SIGNALING HANDLERS
    // ==========================================
    socket.on('call:initiate', async (data: { chatId: string; callId: string; isGroup: boolean; chatName: string; callType?: 'voice' | 'video'; participants?: any[] }) => {
      const callerUsername = socketToUsername.get(socket.id);
      if (!callerUsername) return;

      const callType = data.callType || 'voice';
      console.log(`[Call] ${callType.toUpperCase()} call initiated by ${callerUsername} in chat ${data.chatId}`);

      socket.join(data.chatId);

      const callerUser = await findUserRecord(callerUsername, usersByUsername);
      const publicCaller = callerUser
        ? {
            id: callerUser.id,
            username: callerUser.username,
            avatarUrl: callerUser.avatarUrl,
            statusText: callerUser.statusText,
            isOnline: true,
            lastSeen: Date.now(),
            joinedAt: callerUser.joinedAt,
          }
        : { id: callerUsername, username: callerUsername, avatarUrl: '', isOnline: true, lastSeen: Date.now(), joinedAt: Date.now() };

      // Ensure room and participants exist
      let chat = chats.get(data.chatId);
      let participantUsernames: string[] = [];

      if (chat) {
        participantUsernames = chat.participants;
      } else if (data.chatId.startsWith('dm_')) {
        const parts = data.chatId.replace('dm_', '').split('_');
        if (parts.length >= 2) {
          participantUsernames = parts;
        }
      }

      if (participantUsernames.length === 0 && data.participants) {
        participantUsernames = data.participants.map((p: any) => (typeof p === 'string' ? p : p?.username)).filter(Boolean);
      }

      const allParticipants = Array.from(new Set([callerUsername, ...participantUsernames]));

      // Resolve full participant objects
      const participantUsers = (await Promise.all(
        allParticipants.map((u) => findUserRecord(u, usersByUsername))
      )).filter(Boolean) as UserRecord[];

      // Join all members' sockets to this chatId room immediately
      allParticipants.forEach((uname) => {
        io.to(`user:${uname}`).socketsJoin(data.chatId);
        io.to(`user:${uname.toLowerCase()}`).socketsJoin(data.chatId);
      });

      // Deliver incoming call directly to each other participant's personal room
      for (const uname of allParticipants) {
        if (uname.toLowerCase() !== callerUsername.toLowerCase()) {
          const incomingPayload = {
            callId: data.callId,
            chatId: data.chatId,
            chatName: data.isGroup ? data.chatName : callerUsername,
            isGroup: data.isGroup,
            callType,
            caller: publicCaller,
            participants: participantUsers,
          };

          io.to(`user:${uname}`).emit('call:incoming', incomingPayload);
          io.to(`user:${uname.toLowerCase()}`).emit('call:incoming', incomingPayload);
        }
      }

      // Also broadcast to chatId room for redundancy
      socket.to(data.chatId).emit('call:incoming', {
        callId: data.callId,
        chatId: data.chatId,
        chatName: data.chatName,
        isGroup: data.isGroup,
        callType,
        caller: publicCaller,
        participants: participantUsers,
      });
    });

    socket.on('call:accept', (data: { chatId: string; callId: string }) => {
      const answererUsername = socketToUsername.get(socket.id);
      if (!answererUsername) return;

      console.log(`[Call] Call accepted by ${answererUsername} for call ${data.callId}`);
      socket.join(data.chatId);

      const acceptedPayload = {
        callId: data.callId,
        chatId: data.chatId,
        username: answererUsername,
      };

      io.to(data.chatId).emit('call:accepted', acceptedPayload);

      const chat = chats.get(data.chatId);
      if (chat) {
        chat.participants.forEach((p) => {
          io.to(`user:${p}`).emit('call:accepted', acceptedPayload);
          io.to(`user:${p.toLowerCase()}`).emit('call:accepted', acceptedPayload);
        });
      }
    });

    socket.on('call:toggle_media', (data: { chatId: string; callId: string; isVideoOff?: boolean; isMuted?: boolean }) => {
      const fromUsername = socketToUsername.get(socket.id);
      if (!fromUsername) return;

      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        username: fromUsername,
        isVideoOff: data.isVideoOff,
        isMuted: data.isMuted,
      };

      io.to(data.chatId).emit('call:peer_media_changed', payload);
    });

    socket.on('call:reject', (data: { chatId: string; callId: string }) => {
      const rejecterUsername = socketToUsername.get(socket.id);
      if (!rejecterUsername) return;

      console.log(`[Call] Call rejected by ${rejecterUsername} for call ${data.callId}`);
      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        username: rejecterUsername,
      };

      io.to(data.chatId).emit('call:rejected', payload);
      const chat = chats.get(data.chatId);
      if (chat) {
        chat.participants.forEach((p) => {
          io.to(`user:${p}`).emit('call:rejected', payload);
          io.to(`user:${p.toLowerCase()}`).emit('call:rejected', payload);
        });
      }
    });

    socket.on('call:webrtc_offer', (data: { chatId: string; callId: string; targetUsername?: string; offer: any }) => {
      const fromUsername = socketToUsername.get(socket.id);
      if (!fromUsername) return;

      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        fromUsername,
        targetUsername: data.targetUsername,
        offer: data.offer,
      };

      if (data.targetUsername) {
        io.to(`user:${data.targetUsername}`).emit('call:webrtc_offer', payload);
        io.to(`user:${data.targetUsername.toLowerCase()}`).emit('call:webrtc_offer', payload);
      } else {
        socket.to(data.chatId).emit('call:webrtc_offer', payload);
      }
    });

    socket.on('call:webrtc_answer', (data: { chatId: string; callId: string; targetUsername?: string; answer: any }) => {
      const fromUsername = socketToUsername.get(socket.id);
      if (!fromUsername) return;

      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        fromUsername,
        targetUsername: data.targetUsername,
        answer: data.answer,
      };

      if (data.targetUsername) {
        io.to(`user:${data.targetUsername}`).emit('call:webrtc_answer', payload);
        io.to(`user:${data.targetUsername.toLowerCase()}`).emit('call:webrtc_answer', payload);
      } else {
        socket.to(data.chatId).emit('call:webrtc_answer', payload);
      }
    });

    socket.on('call:ice_candidate', (data: { chatId: string; callId: string; targetUsername?: string; candidate: any }) => {
      const fromUsername = socketToUsername.get(socket.id);
      if (!fromUsername) return;

      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        fromUsername,
        targetUsername: data.targetUsername,
        candidate: data.candidate,
      };

      if (data.targetUsername) {
        io.to(`user:${data.targetUsername}`).emit('call:ice_candidate', payload);
        io.to(`user:${data.targetUsername.toLowerCase()}`).emit('call:ice_candidate', payload);
      } else {
        socket.to(data.chatId).emit('call:ice_candidate', payload);
      }
    });

    socket.on('call:end', (data: { chatId: string; callId: string }) => {
      const fromUsername = socketToUsername.get(socket.id);
      console.log(`[Call] Call ended in ${data.chatId} by ${fromUsername}`);
      activeWebStreams.delete(data.chatId);
      const payload = {
        callId: data.callId,
        chatId: data.chatId,
        fromUsername,
      };

      io.to(data.chatId).emit('call:ended', payload);
      const chat = chats.get(data.chatId);
      if (chat) {
        chat.participants.forEach((p) => {
          io.to(`user:${p}`).emit('call:ended', payload);
          io.to(`user:${p.toLowerCase()}`).emit('call:ended', payload);
        });
      }
    });

    // ==========================================
    // CO-BROWSE & WEB STREAMING SOCKET HANDLERS
    // ==========================================
    socket.on(
      'call:web_stream_start',
      (data: {
        chatId: string;
        callId: string;
        url: string;
        title?: string;
        allowCollaborativeControl?: boolean;
        mode?: 'proxy' | 'direct';
      }) => {
        const streamerUsername = socketToUsername.get(socket.id);
        if (!streamerUsername) return;

        const user = usersByUsername.get(streamerUsername);
        const streamState = {
          isActive: true,
          url: data.url,
          title: data.title || data.url,
          streamerUsername,
          streamerAvatar: user?.avatarUrl || '',
          startedAt: Date.now(),
          scrollY: 0,
          pointer: null,
          allowCollaborativeControl: data.allowCollaborativeControl ?? true,
          zoom: 100,
          mode: data.mode || 'proxy',
        };

        activeWebStreams.set(data.chatId, streamState);
        console.log(`[WebStream] @${streamerUsername} started website stream: ${data.url} in ${data.chatId}`);

        io.to(data.chatId).emit('call:web_stream_started', {
          chatId: data.chatId,
          callId: data.callId,
          streamState,
        });
      }
    );

    socket.on(
      'call:web_stream_update',
      (data: {
        chatId: string;
        callId: string;
        url?: string;
        title?: string;
        scrollY?: number;
        pointer?: any;
        zoom?: number;
        mode?: 'proxy' | 'direct';
        allowCollaborativeControl?: boolean;
      }) => {
        const fromUsername = socketToUsername.get(socket.id);
        if (!fromUsername) return;

        const current = activeWebStreams.get(data.chatId);
        if (!current) return;

        const updated = {
          ...current,
          ...(data.url !== undefined ? { url: data.url } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.scrollY !== undefined ? { scrollY: data.scrollY } : {}),
          ...(data.pointer !== undefined ? { pointer: data.pointer } : {}),
          ...(data.zoom !== undefined ? { zoom: data.zoom } : {}),
          ...(data.mode !== undefined ? { mode: data.mode } : {}),
          ...(data.allowCollaborativeControl !== undefined
            ? { allowCollaborativeControl: data.allowCollaborativeControl }
            : {}),
        };

        activeWebStreams.set(data.chatId, updated);

        // Broadcast to everyone in the chat
        socket.to(data.chatId).emit('call:web_stream_updated', {
          chatId: data.chatId,
          callId: data.callId,
          streamState: updated,
          updatedBy: fromUsername,
        });
      }
    );

    socket.on('call:web_stream_stop', (data: { chatId: string; callId: string }) => {
      const streamerUsername = socketToUsername.get(socket.id);
      activeWebStreams.delete(data.chatId);
      console.log(`[WebStream] Website stream stopped in ${data.chatId} by @${streamerUsername}`);

      io.to(data.chatId).emit('call:web_stream_stopped', {
        chatId: data.chatId,
        callId: data.callId,
        streamerUsername,
      });
    });

    socket.on('call:web_stream_get', (data: { chatId: string }, ack) => {
      const current = activeWebStreams.get(data.chatId) || null;
      if (ack) ack(current);
    });

    // ==========================================
    // 24-HOUR STORY SOCKET HANDLERS
    // ==========================================
    socket.on(
      'story:create',
      async (
        data: {
          type: 'image' | 'text' | 'video';
          mediaUrl?: string;
          videoDuration?: number;
          caption?: string;
          textStyle?: any;
          privacy: 'public' | 'selected';
          allowedUsernames?: string[];
        },
        ack
      ) => {
        const username = socketToUsername.get(socket.id);
        if (!username) return ack ? ack({ success: false, error: 'Unauthorized' }) : null;

        const user = usersByUsername.get(username);
        const now = Date.now();
        const newStory: StoryRecord = {
          id: `story_${now}_${Math.random().toString(36).substring(2, 8)}`,
          userId: user ? user.id : username,
          username,
          userAvatar: user?.avatarUrl || '',
          type: data.type,
          mediaUrl: data.mediaUrl,
          videoDuration: data.videoDuration,
          caption: data.caption,
          textStyle: data.textStyle,
          privacy: data.privacy === 'selected' ? 'selected' : 'public',
          allowedUsernames: Array.isArray(data.allowedUsernames) ? data.allowedUsernames : [],
          createdAt: now,
          expiresAt: now + 24 * 60 * 60 * 1000, // Exactly 24 hours
          views: [],
        };

        storiesMap.set(newStory.id, newStory);
        saveStoriesToDisk();
        saveStoryToDb(newStory as any);

        console.log(`[Stories] New ${newStory.privacy} story created by @${username} (type: ${newStory.type})`);

        // Real-time broadcast
        if (newStory.privacy === 'public') {
          io.emit('story:new', newStory);
        } else {
          // Send to author
          io.to(`user:${username}`).emit('story:new', newStory);
          io.to(`user:${username.toLowerCase()}`).emit('story:new', newStory);
          // Send to selected recipients
          for (const targetUname of newStory.allowedUsernames) {
            io.to(`user:${targetUname}`).emit('story:new', newStory);
            io.to(`user:${targetUname.toLowerCase()}`).emit('story:new', newStory);
          }
        }

        if (ack) ack({ success: true, story: newStory });
      }
    );

    socket.on('story:list', (dataOrAck?: any, maybeAck?: any) => {
      const ack = typeof dataOrAck === 'function' ? dataOrAck : maybeAck;
      const reqUsername =
        typeof dataOrAck === 'object' && dataOrAck?.username
          ? dataOrAck.username
          : typeof dataOrAck === 'string'
          ? dataOrAck
          : null;
      const username = (socketToUsername.get(socket.id) || reqUsername || '').trim().toLowerCase();
      const now = Date.now();

      const visibleStories: StoryRecord[] = [];
      for (const story of storiesMap.values()) {
        if (story.expiresAt <= now) continue;
        const isCreator = Boolean(username && story.username.toLowerCase() === username);
        const isPublic = story.privacy === 'public';
        const isSelected =
          Boolean(username) &&
          Array.isArray(story.allowedUsernames) &&
          story.allowedUsernames.some((u) => u.toLowerCase() === username);

        if (isPublic || isCreator || isSelected) {
          visibleStories.push(story);
        }
      }

      visibleStories.sort((a, b) => b.createdAt - a.createdAt);
      if (ack) ack(visibleStories);
    });

    socket.on('story:view', (data: { storyId: string }) => {
      const viewerUsername = socketToUsername.get(socket.id);
      if (!viewerUsername) return;

      const story = storiesMap.get(data.storyId);
      if (!story) return;

      const viewerUser = usersByUsername.get(viewerUsername);
      const alreadyViewed = story.views.some(
        (v) => v.username.toLowerCase() === viewerUsername.toLowerCase()
      );

      if (!alreadyViewed && story.username.toLowerCase() !== viewerUsername.toLowerCase()) {
        const viewRecord = {
          username: viewerUsername,
          userAvatar: viewerUser?.avatarUrl || '',
          viewedAt: Date.now(),
        };
        story.views.push(viewRecord);
        saveStoriesToDisk();
        saveStoryToDb(story as any);

        // Notify story author in real-time
        io.to(`user:${story.username}`).emit('story:viewed', {
          storyId: story.id,
          view: viewRecord,
          totalViews: story.views.length,
        });
        io.to(`user:${story.username.toLowerCase()}`).emit('story:viewed', {
          storyId: story.id,
          view: viewRecord,
          totalViews: story.views.length,
        });
      }
    });

    socket.on('story:delete', (data: { storyId: string }, ack) => {
      const username = socketToUsername.get(socket.id);
      if (!username) return ack ? ack({ success: false, error: 'Unauthorized' }) : null;

      const story = storiesMap.get(data.storyId);
      if (!story) return ack ? ack({ success: false, error: 'Story not found' }) : null;

      if (story.username.toLowerCase() !== username.toLowerCase()) {
        return ack ? ack({ success: false, error: 'Cannot delete another user story' }) : null;
      }

      storiesMap.delete(data.storyId);
      saveStoriesToDisk();
      deleteStoryFromDb(data.storyId);

      io.emit('story:deleted', { storyId: data.storyId });
      if (ack) ack({ success: true });
    });

    socket.on(
      'story:reply',
      async (
        data: {
          storyId: string;
          authorUsername: string;
          text: string;
          storySnippet?: string;
        },
        ack
      ) => {
        const senderUsername = socketToUsername.get(socket.id);
        if (!senderUsername) return ack ? ack({ success: false, error: 'Unauthorized' }) : null;

        const story = storiesMap.get(data.storyId);
        if (!story) return ack ? ack({ success: false, error: 'Story no longer available' }) : null;

        const dmChatId = getDmChatId(senderUsername, story.username);
        let dmChat = chats.get(dmChatId);

        if (!dmChat) {
          dmChat = {
            id: dmChatId,
            type: 'direct',
            participants: [senderUsername, story.username],
            createdAt: Date.now(),
          };
          chats.set(dmChatId, dmChat);
          saveChatsToDisk();
        }

        const senderUser = usersByUsername.get(senderUsername);
        const replyText = `[Replied to Story: "${story.caption || story.type.toUpperCase()}"] ${data.text}`;
        const newMsg: MessageRecord = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          chatId: dmChatId,
          senderId: senderUser ? senderUser.id : senderUsername,
          senderUsername,
          text: replyText,
          timestamp: Date.now(),
          status: 'sent',
        };

        const list = chatMessages.get(dmChatId) || [];
        list.push(newMsg);
        chatMessages.set(dmChatId, list);
        saveChatsToDisk();
        saveMessageToDb(newMsg);

        io.to(dmChatId).emit('message:new', newMsg);
        io.to(`user:${story.username}`).emit('message:new', newMsg);
        io.to(`user:${story.username.toLowerCase()}`).emit('message:new', newMsg);
        io.to(`user:${senderUsername}`).emit('message:new', newMsg);

        if (ack) ack({ success: true, message: newMsg, chatId: dmChatId });
      }
    );

    // ==========================================
    // SUPERADMIN MANAGEMENT SOCKET EVENTS
    // ==========================================

    // Admin Login Socket Event
    socket.on(
      'admin:login',
      (data: { username?: string; password?: string }, ack?: (res: any) => void) => {
        const u = (data.username || '').trim();
        const p = data.password || '';

        if (u.toLowerCase() === ADMIN_USERNAME.toLowerCase() && p === ADMIN_PASSWORD) {
          const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
          activeAdminTokens.add(token);
          if (ack) {
            ack({
              success: true,
              token,
              admin: {
                username: ADMIN_USERNAME,
                role: 'Super Administrator',
              },
            });
          }
        } else {
          if (ack) {
            ack({ success: false, error: 'Invalid master administrator credentials.' });
          }
        }
      }
    );

    // Admin Fetch Complete Telemetry & Datasets
    socket.on(
      'admin:get_data',
      async (data: { token?: string }, ack?: (res: any) => void) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        await syncAllDbUsersToMemory();

        const users = Array.from(usersByUsername.values()).map((u) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          statusText: u.statusText,
          bio: u.bio,
          isOnline: u.isOnline,
          lastSeen: u.lastSeen,
          joinedAt: u.joinedAt,
          keyFingerprint: u.keyFingerprint,
          publicKeyPem: u.publicKeyPem,
          hasPassword: Boolean(u.passwordHash),
          hasSecurityQuestion: Boolean(u.securityQuestion),
        }));

        const groups: any[] = [];
        let directCount = 0;
        let totalMessages = 0;

        for (const [id, chat] of chats.entries()) {
          const msgs = chatMessages.get(id) || [];
          totalMessages += msgs.length;

          if (chat.type === 'group') {
            const participantUsers = (await Promise.all(
              chat.participants.map((uname) => findUserRecord(uname, usersByUsername))
            )).filter(Boolean) as UserRecord[];

            groups.push({
              id: chat.id,
              name: chat.name,
              description: chat.description,
              avatarUrl: chat.avatarUrl,
              participants: participantUsers,
              adminIds: chat.adminIds || (chat.participants.length > 0 ? [chat.participants[0]] : []),
              createdAt: chat.createdAt,
              messageCount: msgs.length,
              lastMessage: chat.lastMessage,
            });
          } else {
            directCount++;
          }
        }

        const stats = {
          totalUsers: users.length,
          onlineUsers: users.filter((u) => u.isOnline).length,
          totalGroups: groups.length,
          totalDirectChats: directCount,
          totalMessages,
          totalStories: Array.from(storiesMap.values()).filter((s) => s.expiresAt > Date.now()).length,
          activeSockets: io.sockets.sockets.size,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        };

        if (ack) {
          ack({ success: true, stats, users, groups });
        }
      }
    );

    // Admin Reset User Password
    socket.on(
      'admin:reset_user_password',
      async (
        data: { token?: string; username: string; newPassword: string },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const targetUname = (data.username || '').trim();
        const newPwd = data.newPassword || '';

        if (!targetUname || newPwd.length < 4) {
          if (ack) ack({ success: false, error: 'Password must be at least 4 characters.' });
          return;
        }

        const targetUser = await findUserRecord(targetUname, usersByUsername);
        if (!targetUser) {
          if (ack) ack({ success: false, error: `User @${targetUname} not found.` });
          return;
        }

        const newHash = hashPassword(newPwd);
        targetUser.passwordHash = newHash;
        usersByUsername.set(targetUser.username, targetUser);

        try {
          await updateUserPasswordInDb(targetUser.username, newHash);
        } catch (e) {
          console.warn(`[Admin] Failed DB password update for ${targetUser.username}:`, e);
        }

        console.log(`[Admin Action] Superadmin reset password for user @${targetUser.username}`);

        if (ack) {
          ack({
            success: true,
            message: `Password successfully updated for user @${targetUser.username}`,
          });
        }
      }
    );

    // Admin Update User Profile
    socket.on(
      'admin:update_user',
      async (
        data: {
          token?: string;
          username: string;
          statusText?: string;
          bio?: string;
          avatarUrl?: string;
        },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const targetUname = (data.username || '').trim();
        const targetUser = await findUserRecord(targetUname, usersByUsername);
        if (!targetUser) {
          if (ack) ack({ success: false, error: `User @${targetUname} not found.` });
          return;
        }

        if (data.statusText !== undefined) targetUser.statusText = data.statusText;
        if (data.bio !== undefined) targetUser.bio = data.bio;
        if (data.avatarUrl) targetUser.avatarUrl = data.avatarUrl;

        usersByUsername.set(targetUser.username, targetUser);

        try {
          await updateUserProfileInDb(targetUser.username, {
            statusText: targetUser.statusText,
            bio: targetUser.bio,
            avatarUrl: targetUser.avatarUrl,
          });
        } catch (e) {}

        io.emit('directory:user_updated', targetUser);
        if (ack) ack({ success: true, user: targetUser });
      }
    );

    // Admin Delete User Account
    socket.on(
      'admin:delete_user',
      async (data: { token?: string; username: string }, ack?: (res: any) => void) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const targetUname = (data.username || '').trim();
        if (targetUname.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
          if (ack) ack({ success: false, error: 'Cannot delete master superadmin account.' });
          return;
        }

        usersByUsername.delete(targetUname);
        try {
          await deleteUserFromDb(targetUname);
        } catch (e) {}

        // Remove from chats
        for (const [id, chat] of chats.entries()) {
          if (chat.participants.includes(targetUname)) {
            chat.participants = chat.participants.filter((p) => p !== targetUname);
            if (chat.adminIds) {
              chat.adminIds = chat.adminIds.filter((a) => a !== targetUname);
            }
            chats.set(id, chat);
          }
        }
        saveChatsToDisk();

        io.emit('user:status_changed', { username: targetUname, isOnline: false });
        if (ack) ack({ success: true });
      }
    );

    // Admin Update Group Settings
    socket.on(
      'admin:update_group',
      async (
        data: {
          token?: string;
          chatId: string;
          name?: string;
          description?: string;
          avatarUrl?: string;
        },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const chat = chats.get(data.chatId);
        if (!chat || chat.type !== 'group') {
          if (ack) ack({ success: false, error: 'Group not found.' });
          return;
        }

        if (data.name) chat.name = data.name.trim();
        if (data.description !== undefined) chat.description = data.description.trim();
        if (data.avatarUrl) chat.avatarUrl = data.avatarUrl.trim();

        chats.set(chat.id, chat);
        saveChatsToDisk();
        saveChatToDb(chat);

        const sysMsg: MessageRecord = {
          id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          chatId: chat.id,
          senderId: 'system_admin',
          senderUsername: 'System',
          text: `[Admin Action] Group settings updated by Superadmin (@batchit).`,
          timestamp: Date.now(),
          status: 'delivered',
        };

        const list = chatMessages.get(chat.id) || [];
        list.push(sysMsg);
        chatMessages.set(chat.id, list);
        saveChatsToDisk();
        saveMessageToDb(sysMsg);

        io.to(chat.id).emit('chat:updated', chat);
        io.to(chat.id).emit('message:new', sysMsg);

        if (ack) ack({ success: true, chat });
      }
    );

    // Admin Toggle Group Admin Role
    socket.on(
      'admin:toggle_group_admin',
      async (
        data: {
          token?: string;
          chatId: string;
          targetUsername: string;
          makeAdmin: boolean;
        },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const chat = chats.get(data.chatId);
        if (!chat || chat.type !== 'group') {
          if (ack) ack({ success: false, error: 'Group not found.' });
          return;
        }

        const target = (data.targetUsername || '').trim();
        if (!chat.adminIds) {
          chat.adminIds = chat.participants.length > 0 ? [chat.participants[0]] : [];
        }

        if (data.makeAdmin) {
          if (!chat.adminIds.some((a) => a.toLowerCase() === target.toLowerCase())) {
            chat.adminIds.push(target);
          }
        } else {
          chat.adminIds = chat.adminIds.filter((a) => a.toLowerCase() !== target.toLowerCase());
          if (chat.adminIds.length === 0 && chat.participants.length > 0) {
            chat.adminIds = [chat.participants[0]];
          }
        }

        chats.set(chat.id, chat);
        saveChatsToDisk();
        saveChatToDb(chat);

        const sysMsg: MessageRecord = {
          id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          chatId: chat.id,
          senderId: 'system_admin',
          senderUsername: 'System',
          text: `[Admin Action] @${target} was ${data.makeAdmin ? 'promoted to Group Admin' : 'removed as Group Admin'} by Superadmin (@batchit).`,
          timestamp: Date.now(),
          status: 'delivered',
        };

        const list = chatMessages.get(chat.id) || [];
        list.push(sysMsg);
        chatMessages.set(chat.id, list);
        saveChatsToDisk();
        saveMessageToDb(sysMsg);

        io.to(chat.id).emit('chat:updated', chat);
        io.to(chat.id).emit('message:new', sysMsg);

        if (ack) ack({ success: true, chat });
      }
    );

    // Admin Add or Remove Member in Group
    socket.on(
      'admin:manage_group_member',
      async (
        data: {
          token?: string;
          chatId: string;
          action: 'add' | 'remove';
          username: string;
        },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const chat = chats.get(data.chatId);
        if (!chat || chat.type !== 'group') {
          if (ack) ack({ success: false, error: 'Group not found.' });
          return;
        }

        const target = (data.username || '').trim();
        if (data.action === 'add') {
          const userRec = await findUserRecord(target, usersByUsername);
          if (!userRec) {
            if (ack) ack({ success: false, error: `User @${target} does not exist.` });
            return;
          }
          if (!chat.participants.some((p) => p.toLowerCase() === target.toLowerCase())) {
            chat.participants.push(userRec.username);
          }
        } else {
          chat.participants = chat.participants.filter(
            (p) => p.toLowerCase() !== target.toLowerCase()
          );
          if (chat.adminIds) {
            chat.adminIds = chat.adminIds.filter((a) => a.toLowerCase() !== target.toLowerCase());
          }
        }

        chats.set(chat.id, chat);
        saveChatsToDisk();
        saveChatToDb(chat);

        const sysMsg: MessageRecord = {
          id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          chatId: chat.id,
          senderId: 'system_admin',
          senderUsername: 'System',
          text: `[Admin Action] @${target} was ${data.action === 'add' ? 'added to' : 'removed from'} the group by Superadmin (@batchit).`,
          timestamp: Date.now(),
          status: 'delivered',
        };

        const list = chatMessages.get(chat.id) || [];
        list.push(sysMsg);
        chatMessages.set(chat.id, list);
        saveChatsToDisk();
        saveMessageToDb(sysMsg);

        io.to(chat.id).emit('chat:updated', chat);
        io.to(chat.id).emit('message:new', sysMsg);

        if (ack) ack({ success: true, chat });
      }
    );

    // Admin Delete Group
    socket.on(
      'admin:delete_group',
      async (data: { token?: string; chatId: string }, ack?: (res: any) => void) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const chat = chats.get(data.chatId);
        if (chat) {
          chats.delete(data.chatId);
          chatMessages.delete(data.chatId);
          saveChatsToDisk();
          io.to(data.chatId).emit('chat:deleted', { chatId: data.chatId });
        }

        if (ack) ack({ success: true });
      }
    );

    // Admin Broadcast Announcement
    socket.on(
      'admin:broadcast_announcement',
      async (
        data: {
          token?: string;
          title?: string;
          message: string;
          type?: 'info' | 'warning' | 'alert';
        },
        ack?: (res: any) => void
      ) => {
        if (!isAuthorizedAdmin(data?.token)) {
          if (ack) ack({ success: false, error: 'Unauthorized superadmin access.' });
          return;
        }

        const announcement = {
          id: `ann_${Date.now()}`,
          title: data.title || 'Platform Announcement',
          message: data.message,
          type: data.type || 'info',
          timestamp: Date.now(),
          sender: 'Superadmin (@batchit)',
        };

        io.emit('system:announcement', announcement);
        console.log(`[Admin Action] Global announcement broadcasted: "${data.message}"`);

        if (ack) ack({ success: true, announcement });
      }
    );

    // ==========================================
    // SOCIAL FEATURES: FOLLOW & POST HANDLERS
    // ==========================================

    // Follow a user
    socket.on('follow:user', (data: { targetUsername: string }, ack?: (res: any) => void) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) {
        if (ack) ack({ success: false, error: 'Unauthorized. Please login.' });
        return;
      }
      const target = (data?.targetUsername || '').trim();
      if (!target || target.toLowerCase() === currentUsername.toLowerCase()) {
        if (ack) ack({ success: false, error: 'Cannot follow yourself.' });
        return;
      }

      let followers = followersMap.get(target);
      if (!followers) {
        followers = new Set<string>();
        followersMap.set(target, followers);
      }
      followers.add(currentUsername);

      let following = followingMap.get(currentUsername);
      if (!following) {
        following = new Set<string>();
        followingMap.set(currentUsername, following);
      }
      following.add(target);

      saveFollowsToDisk();

      const targetStats = getFollowStats(target, currentUsername);
      const currentStats = getFollowStats(currentUsername);

      // Notify target user if connected
      io.to(`user:${target}`).emit('follow:status_changed', {
        targetUsername: target,
        followerUsername: currentUsername,
        isFollowing: true,
        stats: targetStats,
      });
      io.to(`user:${target.toLowerCase()}`).emit('follow:status_changed', {
        targetUsername: target,
        followerUsername: currentUsername,
        isFollowing: true,
        stats: targetStats,
      });

      // Update current user
      socket.emit('follow:status_changed', {
        targetUsername: target,
        isFollowing: true,
        stats: targetStats,
      });

      // Broadcast global directory counter updates
      io.emit('directory:user_stats_updated', {
        username: target,
        followersCount: targetStats.followersCount,
        followingCount: targetStats.followingCount,
      });
      io.emit('directory:user_stats_updated', {
        username: currentUsername,
        followersCount: currentStats.followersCount,
        followingCount: currentStats.followingCount,
      });

      if (ack) ack({ success: true, isFollowing: true, stats: targetStats });
    });

    // Unfollow a user
    socket.on('unfollow:user', (data: { targetUsername: string }, ack?: (res: any) => void) => {
      const currentUsername = socketToUsername.get(socket.id);
      if (!currentUsername) {
        if (ack) ack({ success: false, error: 'Unauthorized. Please login.' });
        return;
      }
      const target = (data?.targetUsername || '').trim();
      if (!target) {
        if (ack) ack({ success: false, error: 'Target user required.' });
        return;
      }

      const followers = followersMap.get(target);
      if (followers) {
        followers.delete(currentUsername);
      }
      const following = followingMap.get(currentUsername);
      if (following) {
        following.delete(target);
      }

      saveFollowsToDisk();

      const targetStats = getFollowStats(target, currentUsername);
      const currentStats = getFollowStats(currentUsername);

      // Notify target user
      io.to(`user:${target}`).emit('follow:status_changed', {
        targetUsername: target,
        followerUsername: currentUsername,
        isFollowing: false,
        stats: targetStats,
      });
      io.to(`user:${target.toLowerCase()}`).emit('follow:status_changed', {
        targetUsername: target,
        followerUsername: currentUsername,
        isFollowing: false,
        stats: targetStats,
      });

      // Update current user
      socket.emit('follow:status_changed', {
        targetUsername: target,
        isFollowing: false,
        stats: targetStats,
      });

      // Broadcast global directory counter updates
      io.emit('directory:user_stats_updated', {
        username: target,
        followersCount: targetStats.followersCount,
        followingCount: targetStats.followingCount,
      });
      io.emit('directory:user_stats_updated', {
        username: currentUsername,
        followersCount: currentStats.followersCount,
        followingCount: currentStats.followingCount,
      });

      if (ack) ack({ success: true, isFollowing: false, stats: targetStats });
    });

    // Get Follow Stats for a user
    socket.on('follow:get_stats', (data: { targetUsername: string }, ack?: (stats: any) => void) => {
      const currentUsername = socketToUsername.get(socket.id);
      const stats = getFollowStats(data.targetUsername, currentUsername);
      if (ack) ack(stats);
    });

    // Get List of Followers or Following users
    socket.on(
      'follow:get_list',
      async (
        data: { targetUsername: string; type: 'followers' | 'following' },
        ack?: (users: any[]) => void
      ) => {
        const currentUsername = socketToUsername.get(socket.id);
        const target = (data?.targetUsername || '').trim();
        const set =
          data?.type === 'followers'
            ? followersMap.get(target) || new Set<string>()
            : followingMap.get(target) || new Set<string>();

        const usernames = Array.from(set);
        const userObjects = await Promise.all(
          usernames.map(async (uname) => {
            const rec = await findUserRecord(uname, usersByUsername);
            if (!rec) {
              return {
                id: `usr_${uname}`,
                username: uname,
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uname}`,
                statusText: '',
                bio: '',
                isOnline: false,
                lastSeen: Date.now(),
                followersCount: (followersMap.get(uname) || new Set()).size,
                followingCount: (followingMap.get(uname) || new Set()).size,
                isFollowing: currentUsername ? (followersMap.get(uname)?.has(currentUsername) ?? false) : false,
              };
            }
            return {
              id: rec.id,
              username: rec.username,
              avatarUrl: rec.avatarUrl,
              statusText: rec.statusText,
              bio: rec.bio,
              isOnline: rec.isOnline,
              lastSeen: rec.lastSeen,
              followersCount: (followersMap.get(rec.username) || new Set()).size,
              followingCount: (followingMap.get(rec.username) || new Set()).size,
              isFollowing: currentUsername ? (followersMap.get(rec.username)?.has(currentUsername) ?? false) : false,
            };
          })
        );

        if (ack) ack(userObjects.filter(Boolean));
      }
    );

    // Get Posts Feed
    socket.on(
      'post:list',
      (filterData?: { filter?: 'all' | 'following' | 'user'; targetUsername?: string }, ack?: (posts: any[]) => void) => {
        const currentUsername = socketToUsername.get(socket.id);
        const filter = filterData?.filter || 'all';
        let allPosts = Array.from(postsMap.values()).sort((a, b) => b.createdAt - a.createdAt);

        if (filter === 'user' && filterData?.targetUsername) {
          const targetUname = filterData.targetUsername.toLowerCase();
          allPosts = allPosts.filter((p) => p.username.toLowerCase() === targetUname);
        } else if (filter === 'following' && currentUsername) {
          const followingSet = followingMap.get(currentUsername) || new Set<string>();
          allPosts = allPosts.filter(
            (p) => followingSet.has(p.username) || p.username.toLowerCase() === currentUsername.toLowerCase()
          );
        }

        if (ack) ack(allPosts);
      }
    );

    // Create a new post
    socket.on(
      'post:create',
      async (
        data: {
          content: string;
          mediaUrl?: string;
          mediaType?: 'image' | 'video';
          tags?: string[];
        },
        ack?: (res: any) => void
      ) => {
        const username = socketToUsername.get(socket.id);
        if (!username) {
          if (ack) ack({ success: false, error: 'Unauthorized. Please log in.' });
          return;
        }

        const user = await findUserRecord(username, usersByUsername);
        if (!user) {
          if (ack) ack({ success: false, error: 'User record not found.' });
          return;
        }

        const content = (data?.content || '').trim();
        if (!content && !data?.mediaUrl) {
          if (ack) ack({ success: false, error: 'Post must contain either text content or media.' });
          return;
        }

        // Auto-extract hashtags from post text
        const hashtagMatches = content.match(/#[a-zA-Z0-9_]+/g) || [];
        const extractedTags = hashtagMatches.map((t) => t.replace('#', '').toLowerCase());
        const combinedTags = Array.from(new Set([...(data.tags || []).map((t) => t.replace('#', '').toLowerCase()), ...extractedTags]));

        const newPost: PostRecord = {
          id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: user.id,
          username: user.username,
          userAvatar: user.avatarUrl,
          content,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType || (data.mediaUrl ? 'image' : undefined),
          tags: combinedTags,
          likes: [],
          comments: [],
          createdAt: Date.now(),
        };

        postsMap.set(newPost.id, newPost);
        savePostsToDisk();

        // Broadcast new post to all connected users
        io.emit('post:created', newPost);

        console.log(`[Post] New post published by @${username} (${newPost.id})`);
        if (ack) ack({ success: true, post: newPost });
      }
    );

    // Toggle like on a post
    socket.on('post:like:toggle', (data: { postId: string }, ack?: (res: any) => void) => {
      const username = socketToUsername.get(socket.id);
      if (!username) {
        if (ack) ack({ success: false, error: 'Unauthorized. Please log in.' });
        return;
      }

      const post = postsMap.get(data?.postId);
      if (!post) {
        if (ack) ack({ success: false, error: 'Post not found.' });
        return;
      }

      const likeIdx = post.likes.indexOf(username);
      if (likeIdx >= 0) {
        post.likes.splice(likeIdx, 1);
      } else {
        post.likes.push(username);
      }
      post.updatedAt = Date.now();

      savePostsToDisk();

      io.emit('post:updated', post);
      if (ack) ack({ success: true, post, isLiked: post.likes.includes(username) });
    });

    // Add comment to a post
    socket.on(
      'post:comment:add',
      async (data: { postId: string; text: string }, ack?: (res: any) => void) => {
        const username = socketToUsername.get(socket.id);
        if (!username) {
          if (ack) ack({ success: false, error: 'Unauthorized. Please log in.' });
          return;
        }

        const post = postsMap.get(data?.postId);
        if (!post) {
          if (ack) ack({ success: false, error: 'Post not found.' });
          return;
        }

        const text = (data?.text || '').trim();
        if (!text) {
          if (ack) ack({ success: false, error: 'Comment text cannot be empty.' });
          return;
        }

        const user = await findUserRecord(username, usersByUsername);

        const newComment: PostCommentRecord = {
          id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          postId: post.id,
          userId: user ? user.id : username,
          username,
          userAvatar: user?.avatarUrl,
          text,
          createdAt: Date.now(),
        };

        post.comments.push(newComment);
        post.updatedAt = Date.now();

        savePostsToDisk();

        io.emit('post:updated', post);
        if (ack) ack({ success: true, post, comment: newComment });
      }
    );

    // Delete comment from a post
    socket.on(
      'post:comment:delete',
      (data: { postId: string; commentId: string }, ack?: (res: any) => void) => {
        const username = socketToUsername.get(socket.id);
        if (!username) {
          if (ack) ack({ success: false, error: 'Unauthorized.' });
          return;
        }

        const post = postsMap.get(data?.postId);
        if (!post) {
          if (ack) ack({ success: false, error: 'Post not found.' });
          return;
        }

        const commentIdx = post.comments.findIndex((c) => c.id === data.commentId);
        if (commentIdx === -1) {
          if (ack) ack({ success: false, error: 'Comment not found.' });
          return;
        }

        const comment = post.comments[commentIdx];
        const isAuthorized =
          comment.username.toLowerCase() === username.toLowerCase() ||
          post.username.toLowerCase() === username.toLowerCase() ||
          username.toLowerCase() === ADMIN_USERNAME.toLowerCase();

        if (!isAuthorized) {
          if (ack) ack({ success: false, error: 'Not authorized to delete this comment.' });
          return;
        }

        post.comments.splice(commentIdx, 1);
        post.updatedAt = Date.now();

        savePostsToDisk();

        io.emit('post:updated', post);
        if (ack) ack({ success: true, post });
      }
    );

    // Delete a post
    socket.on('post:delete', (data: { postId: string }, ack?: (res: any) => void) => {
      const username = socketToUsername.get(socket.id);
      if (!username) {
        if (ack) ack({ success: false, error: 'Unauthorized.' });
        return;
      }

      const post = postsMap.get(data?.postId);
      if (!post) {
        if (ack) ack({ success: false, error: 'Post not found.' });
        return;
      }

      const isAuthorized =
        post.username.toLowerCase() === username.toLowerCase() ||
        username.toLowerCase() === ADMIN_USERNAME.toLowerCase();

      if (!isAuthorized) {
        if (ack) ack({ success: false, error: 'Not authorized to delete this post.' });
        return;
      }

      postsMap.delete(data.postId);
      savePostsToDisk();

      io.emit('post:deleted', { postId: data.postId });
      console.log(`[Post] Post ${data.postId} deleted by @${username}`);
      if (ack) ack({ success: true });
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      const username = socketToUsername.get(socket.id);
      if (username) {
        socketToUsername.delete(socket.id);

        const current = usersByUsername.get(username);
        if (current) {
          const updated: UserRecord = {
            ...current,
            isOnline: false,
            lastSeen: Date.now(),
          };
          usersByUsername.set(username, updated);
          io.emit('directory:user_updated', updated);
          io.emit('user:status_changed', { username, isOnline: false, lastSeen: Date.now() });
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  // Vite Middleware & SPA Route Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true as const,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Development SPA Fallback for all non-file HTML requests
    app.use(async (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      
      // If request is for a file asset with an extension (e.g. .js, .css, .ico, .png), pass through
      if (path.extname(req.path) && !req.headers.accept?.includes('text/html')) {
        return next();
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl || req.url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CipherTalk Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
