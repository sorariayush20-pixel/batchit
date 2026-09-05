import { db } from './index.ts';
import { storiesTable } from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import { Story, StoryView } from '../types.ts';

export async function saveStoryToDb(story: Story) {
  try {
    const existing = await db.select().from(storiesTable).where(eq(storiesTable.id, story.id)).limit(1);
    if (existing.length > 0) {
      await db.update(storiesTable)
        .set({
          views: JSON.stringify(story.views || []),
        })
        .where(eq(storiesTable.id, story.id));
    } else {
      await db.insert(storiesTable).values({
        id: story.id,
        userId: story.userId,
        username: story.username,
        userAvatar: story.userAvatar || null,
        type: story.type,
        mediaUrl: story.mediaUrl || null,
        caption: story.caption || null,
        textStyle: story.textStyle ? JSON.stringify(story.textStyle) : null,
        privacy: story.privacy,
        allowedUsernames: JSON.stringify(story.allowedUsernames || []),
        createdAt: new Date(story.createdAt),
        expiresAt: new Date(story.expiresAt),
        views: JSON.stringify(story.views || []),
      });
    }
  } catch (err) {
    console.warn('[DB] Failed to save story to DB:', err);
  }
}

export async function deleteStoryFromDb(storyId: string) {
  try {
    await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  } catch (err) {
    console.warn('[DB] Failed to delete story from DB:', err);
  }
}

export async function getAllActiveStoriesFromDb(): Promise<Story[]> {
  try {
    const rows = await db.select().from(storiesTable).orderBy(desc(storiesTable.createdAt));
    const now = Date.now();
    return rows
      .map((r) => {
        const createdAt = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
        const expiresAt = r.expiresAt ? new Date(r.expiresAt).getTime() : createdAt + 24 * 60 * 60 * 1000;
        return {
          id: r.id,
          userId: r.userId,
          username: r.username,
          userAvatar: r.userAvatar || undefined,
          type: r.type as 'image' | 'text' | 'video',
          mediaUrl: r.mediaUrl || undefined,
          caption: r.caption || undefined,
          textStyle: r.textStyle ? JSON.parse(r.textStyle) : undefined,
          privacy: r.privacy as 'public' | 'selected',
          allowedUsernames: r.allowedUsernames ? JSON.parse(r.allowedUsernames) : [],
          createdAt,
          expiresAt,
          views: r.views ? JSON.parse(r.views) : [],
        };
      })
      .filter((s) => s.expiresAt > now); // Only active stories within 24 hours
  } catch (err) {
    console.warn('[DB] Failed to get stories from DB:', err);
    return [];
  }
}
