import { SUPABASE_URL } from "./backend";
import { tk, tr } from "./i18n";
import { VOICE_BUCKET } from "./naturalVoice";
import { supabase } from "./supabase";

/**
 * Natural voices for members' uploads: the natural-voice Edge Function has Google voice one piece
 * of a chapter (lib/naturalVoice.ts cuts it) and keeps it in the private upload-voices bucket;
 * this asks for a piece's link. Members only, never on Kids profiles.
 */

export class NaturalVoiceError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: tk("We couldn't reach LiteraryWorm. Check your connection, then press play to try again."),
  limit_reached: tk("This month's natural-voice reading is used up. Choose one of your device's voices, or listen again to chapters already voiced."),
  forbidden: tk("Natural voices come with a membership, on grown-up and teen profiles. Choose one of your device's voices."),
  rate_limited: tk("That's a lot of skipping about in a short time. Wait a little, then press play."),
  upstream_timeout: tk("The natural voice took too long. Press play to try again."),
  upstream_error: tk("The natural voice isn't working just now. Press play to try again, or choose one of your device's voices."),
  unauthorized: tk("Your session has ended. Log in again."),
};

const friendly = (code: string) => tr(Object.hasOwn(FRIENDLY, code) ? FRIENDLY[code] : FRIENDLY.upstream_error);

/** A link (good for an hour) to one voiced piece of an upload, voicing it first if it's new. */
export async function naturalVoiceUrl(uploadId: string, chapter: number, segment: number, voice: string): Promise<string> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  if (!token) throw new NaturalVoiceError(friendly("unauthorized"));
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/natural-voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId, chapter, segment, voice }),
    });
  } catch {
    throw new NaturalVoiceError(friendly("network"));
  }
  const body = (await res.json().catch(() => null)) as { url?: unknown; error?: { code?: string } } | null;
  if (!res.ok) throw new NaturalVoiceError(friendly(body?.error?.code ?? "upstream_error"));
  if (typeof body?.url !== "string") throw new NaturalVoiceError(friendly("upstream_error"));
  return body.url;
}

/** Deletes an upload's voiced pieces (its folder in upload-voices). */
export async function removeUploadVoices(userId: string, uploadId: string): Promise<void> {
  if (!supabase) return;
  const folder = `${userId}/${uploadId}`;
  const bucket = supabase.storage.from(VOICE_BUCKET);
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(folder, { limit: 1000, offset });
    if (error) throw error;
    names.push(...data.map((f) => `${folder}/${f.name}`));
    if (data.length < 1000) break;
  }
  for (let i = 0; i < names.length; i += 1000) {
    const { error } = await bucket.remove(names.slice(i, i + 1000));
    if (error) throw error;
  }
}
