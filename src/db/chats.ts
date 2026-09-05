import { db } from './index.ts';
import { chatsTable, messagesTable } from './schema.ts';
import { eq, asc } from 'drizzle-orm';

export interface DbChat {
  id: string;
  type: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
  participants: string[];
  adminIds?: string[];
  createdAt?: number;
}

export interface DbMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  encryptedPayload?: any;
  attachment?: any;
  replyTo?: any;
  reactions?: any;
  timestamp: number;
  status?: string;
}

export async function saveChatToDb(chat: DbChat) {
  try {
    const existing = await db.select().from(chatsTable).where(eq(chatsTable.id, chat.id)).limit(1);
    if (existing.length > 0) {
      await db.update(chatsTable)
        .set({
          name: chat.name,
          description: chat.description,
          avatarUrl: chat.avatarUrl,
          participants: JSON.stringify(chat.participants || []),
          adminIds: JSON.stringify(chat.adminIds || []),
        })
        .where(eq(chatsTable.id, chat.id));
    } else {
      await db.insert(chatsTable).values({
        id: chat.id,
        type: chat.type,
        name: chat.name,
        description: chat.description,
        avatarUrl: chat.avatarUrl,
        participants: JSON.stringify(chat.participants || []),
        adminIds: JSON.stringify(chat.adminIds || []),
      });
    }
  } catch (err) {
    console.warn('[DB] Failed to save chat to DB:', err);
  }
}

export async function deleteChatFromDb(chatId: string) {
  try {
    await db.delete(messagesTable).where(eq(messagesTable.chatId, chatId));
    await db.delete(chatsTable).where(eq(chatsTable.id, chatId));
  } catch (err) {
    console.warn('[DB] Failed to delete chat from DB:', err);
  }
}

export async function saveMessageToDb(msg: DbMessage) {
  try {
    const existing = await db.select().from(messagesTable).where(eq(messagesTable.id, msg.id)).limit(1);
    if (existing.length > 0) {
      await db.update(messagesTable)
        .set({
          text: msg.text,
          encryptedPayload: msg.encryptedPayload ? JSON.stringify(msg.encryptedPayload) : null,
          attachment: msg.attachment ? JSON.stringify(msg.attachment) : null,
          replyTo: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
          reactions: msg.reactions ? JSON.stringify(msg.reactions) : null,
        })
        .where(eq(messagesTable.id, msg.id));
    } else {
      await db.insert(messagesTable).values({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        senderUsername: msg.senderUsername,
        text: msg.text,
        encryptedPayload: msg.encryptedPayload ? JSON.stringify(msg.encryptedPayload) : null,
        attachment: msg.attachment ? JSON.stringify(msg.attachment) : null,
        replyTo: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
        reactions: msg.reactions ? JSON.stringify(msg.reactions) : null,
      });
    }
  } catch (err) {
    console.warn('[DB] Failed to save message to DB:', err);
  }
}

export async function deleteMessageFromDb(messageId: string) {
  try {
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  } catch (err) {
    console.warn('[DB] Failed to delete message from DB:', err);
  }
}

export async function clearChatMessagesInDb(chatId: string) {
  try {
    await db.delete(messagesTable).where(eq(messagesTable.chatId, chatId));
  } catch (err) {
    console.warn('[DB] Failed to clear chat messages in DB:', err);
  }
}

export async function getAllChatsFromDb(): Promise<DbChat[]> {
  try {
    const rows = await db.select().from(chatsTable);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name || undefined,
      description: r.description || undefined,
      avatarUrl: r.avatarUrl || undefined,
      participants: r.participants ? JSON.parse(r.participants) : [],
      adminIds: r.adminIds ? JSON.parse(r.adminIds) : [],
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));
  } catch (err) {
    console.warn('[DB] Failed to get chats from DB:', err);
    return [];
  }
}

export async function getAllMessagesFromDb(): Promise<DbMessage[]> {
  try {
    const rows = await db.select().from(messagesTable).orderBy(asc(messagesTable.timestamp));
    return rows.map((r) => ({
      id: r.id,
      chatId: r.chatId,
      senderId: r.senderId,
      senderUsername: r.senderUsername,
      text: r.text,
      encryptedPayload: r.encryptedPayload ? JSON.parse(r.encryptedPayload) : undefined,
      attachment: r.attachment ? JSON.parse(r.attachment) : undefined,
      replyTo: r.replyTo ? JSON.parse(r.replyTo) : undefined,
      reactions: r.reactions ? JSON.parse(r.reactions) : undefined,
      timestamp: r.timestamp ? new Date(r.timestamp).getTime() : Date.now(),
      status: 'sent',
    }));
  } catch (err) {
    console.warn('[DB] Failed to get messages from DB:', err);
    return [];
  }
}
