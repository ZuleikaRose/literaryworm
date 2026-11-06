// Removing natural-voice pieces (the upload-voices bucket, <user_id>/<upload_id>/…) when their
// upload, profile or account is deleted. Storage lists one folder at a time, a page at a time.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { VOICE_BUCKET } from "./naturalVoice.ts";

const PAGE = 1000;

/** Every name in one folder (files and sub-folders), all pages. */
async function listAll(db: SupabaseClient, folder: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(VOICE_BUCKET).list(folder, { limit: PAGE, offset });
    if (error) throw error;
    names.push(...data.map((f) => f.name));
    if (data.length < PAGE) return names;
  }
}

/** Deletes the voiced pieces of these uploads. */
export async function removeUploadVoices(db: SupabaseClient, userId: string, uploadIds: string[]): Promise<void> {
  for (const uploadId of uploadIds) {
    const folder = `${userId}/${uploadId}`;
    const files = (await listAll(db, folder)).map((name) => `${folder}/${name}`);
    for (let i = 0; i < files.length; i += PAGE) {
      const { error } = await db.storage.from(VOICE_BUCKET).remove(files.slice(i, i + PAGE));
      if (error) throw error;
    }
  }
}

/** Deletes every voiced piece in an account's folder. */
export async function removeAccountVoices(db: SupabaseClient, userId: string): Promise<void> {
  await removeUploadVoices(db, userId, await listAll(db, userId));
}
