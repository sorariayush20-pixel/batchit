export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  statusText?: string;
  isOnline: boolean;
  lastSeen: number;
  publicKeyPem?: string;
  keyFingerprint?: string;
  bio?: string;
  joinedAt: number;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isFollowing?: boolean;
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 AES-GCM ciphertext
  iv: string; // Base64 IV
  encryptedSymmetricKey?: string; // Base64 RSA-OAEP encrypted AES key (for DMs)
  recipientPublicKeyPem?: string;
  senderPublicKeyPem?: string;
  isEncrypted: boolean;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string; // Base64 data URL
  isEncrypted?: boolean;
}

export interface MessageReaction {
  emoji: string;
  users: string[]; // usernames or userIds
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  text: string; // Plaintext (decrypted locally or unencrypted system note)
  encryptedPayload?: EncryptedPayload;
  attachment?: FileAttachment;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  isSystem?: boolean;
  replyTo?: {
    id: string;
    senderUsername: string;
    text: string;
  };
  reactions?: Record<string, string[]>; // emoji -> array of userIds
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string; // Group name or DM partner username
  avatarUrl?: string;
  description?: string;
  participants: User[];
  adminIds?: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: number;
  // Group key distribution map: userId -> Base64 RSA-OAEP encrypted Group AES Key
  encryptedGroupKeys?: Record<string, string>;
}

export interface TypingState {
  chatId: string;
  username: string;
  isTyping: boolean;
}

export interface WebStreamState {
  isActive: boolean;
  url: string;
  title?: string;
  streamerUsername: string;
  streamerAvatar?: string;
  startedAt: number;
  scrollY?: number;
  pointer?: { x: number; y: number; active?: boolean; username: string } | null;
  allowCollaborativeControl?: boolean;
  zoom?: number;
  mode?: 'proxy' | 'direct' | 'screen';
}

export interface ActiveCallState {
  callId: string;
  chatId: string;
  chatName: string;
  chatAvatar?: string;
  isGroup: boolean;
  callType: 'voice' | 'video';
  callerUsername: string;
  participants: User[];
  status: 'outgoing' | 'incoming' | 'connected' | 'ended';
  isMuted: boolean;
  isVideoOff: boolean;
  isFrontCamera?: boolean;
  isScreenSharing?: boolean;
  isSpeakerOn: boolean;
  startTime?: number;
  webStream?: WebStreamState | null;
}

export interface MissedCall {
  id: string;
  callId: string;
  chatId: string;
  chatName: string;
  callerUsername: string;
  callerAvatar?: string;
  timestamp: number;
  isGroup: boolean;
  callType?: 'voice' | 'video';
}

export interface StoryView {
  userId?: string;
  username: string;
  userAvatar?: string;
  viewedAt: number;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  type: 'image' | 'text' | 'video';
  mediaUrl?: string; // Base64 data URL or external URL
  videoDuration?: number; // In seconds (max 60s)
  caption?: string;
  textStyle?: {
    backgroundGradient: string;
    textColor?: string;
    fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  };
  privacy: 'public' | 'selected';
  allowedUsernames: string[]; // usernames allowed to see this when privacy === 'selected'
  createdAt: number;
  expiresAt: number; // 24 hours from creation
  views: StoryView[];
}

export interface UserStoryGroup {
  username: string;
  userAvatar?: string;
  isCurrentUser: boolean;
  hasUnseenStories: boolean;
  stories: Story[];
  lastUpdated: number;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  tags?: string[];
  likes: string[]; // array of usernames who liked this post
  comments: PostComment[];
  createdAt: number;
  updatedAt?: number;
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followers: string[];
  following: string[];
}

