import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export interface CreateUserData {
  username: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
  avatarUrl?: string;
  statusText?: string;
  bio?: string;
  publicKeyPem?: string;
  keyFingerprint?: string;
}

export async function createUserInDb(data: CreateUserData) {
  try {
    const result = await db.insert(users)
      .values({
        username: data.username,
        passwordHash: data.passwordHash,
        securityQuestion: data.securityQuestion,
        securityAnswerHash: data.securityAnswerHash,
        avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`,
        statusText: data.statusText || 'Available to chat securely',
        bio: data.bio || 'CipherTalk user',
        publicKeyPem: data.publicKeyPem || '',
        keyFingerprint: data.keyFingerprint || '',
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in createUserInDb:', error);
    throw error;
  }
}

export async function getUserByUsernameFromDb(username: string) {
  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUsernameFromDb:', error);
    return null;
  }
}

export async function getAllUsersFromDb() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed in getAllUsersFromDb:', error);
    return [];
  }
}

export async function updateUserCredentialsInDb(username: string, updates: Partial<{ passwordHash: string; securityAnswerHash: string }>) {
  try {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.username, username))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserCredentialsInDb:', error);
    return null;
  }
}

export async function updateUserPasswordInDb(username: string, newPasswordHash: string) {
  try {
    const result = await db.update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.username, username))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserPasswordInDb:', error);
    throw error;
  }
}

export async function updateUserProfileInDb(username: string, updates: Partial<{ avatarUrl: string; statusText: string; bio: string; publicKeyPem: string; keyFingerprint: string }>) {
  try {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.username, username))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfileInDb:', error);
    return null;
  }
}

export async function deleteUserFromDb(username: string) {
  try {
    const result = await db.delete(users)
      .where(eq(users.username, username))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in deleteUserFromDb:', error);
    return null;
  }
}


