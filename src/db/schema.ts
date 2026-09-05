import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  securityQuestion: text('security_question').notNull(),
  securityAnswerHash: text('security_answer_hash').notNull(),
  avatarUrl: text('avatar_url'),
  statusText: text('status_text'),
  bio: text('bio'),
  publicKeyPem: text('public_key_pem'),
  keyFingerprint: text('key_fingerprint'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatsTable = pgTable('chats', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name'),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  participants: text('participants').notNull(), // JSON string array
  adminIds: text('admin_ids'), // JSON string array
  createdAt: timestamp('created_at').defaultNow(),
});

export const messagesTable = pgTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  senderId: text('sender_id').notNull(),
  senderUsername: text('sender_username').notNull(),
  text: text('text').notNull(),
  encryptedPayload: text('encrypted_payload'), // JSON string
  attachment: text('attachment'), // JSON string
  replyTo: text('reply_to'), // JSON string
  reactions: text('reactions'), // JSON string
  timestamp: timestamp('timestamp').defaultNow(),
});

export const storiesTable = pgTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  userAvatar: text('user_avatar'),
  type: text('type').notNull(), // 'image' | 'text'
  mediaUrl: text('media_url'),
  caption: text('caption'),
  textStyle: text('text_style'), // JSON string
  privacy: text('privacy').notNull(), // 'public' | 'selected'
  allowedUsernames: text('allowed_usernames').notNull(), // JSON string array
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  views: text('views').notNull(), // JSON string array
});

export const followsTable = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerUsername: text('follower_username').notNull(),
  followingUsername: text('following_username').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const postsTable = pgTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  userAvatar: text('user_avatar'),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'),
  tags: text('tags'), // JSON string array
  likes: text('likes'), // JSON string array
  comments: text('comments'), // JSON string array
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  author: one(users, {
    fields: [entries.userId],
    references: [users.id],
  }),
}));
