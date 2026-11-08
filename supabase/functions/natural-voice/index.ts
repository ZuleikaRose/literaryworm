import { HttpError } from "../_shared/http.ts";
import { CHARACTERS_PER_HOUR, naturalVoiceMonth, VOICE_BUCKET } from "../_shared/naturalVoice.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { synthesize } from "./google.ts";
import { handle } from "./handler.ts";

/** A signed link lasts an hour; the player asks again for a piece whose link has run out. */
const SIGNED_SECONDS = 3600;

const dbError = (what: string, error: { message: string }): never => {
  console.error(`natural-voice: couldn't ${what}:`, error.message);
  throw new HttpError("server_error", "Something went wrong. Try again.");
};

Deno.serve((req) => {
  const db = serviceClient();
  return handle(req, {
    user: async (r) => (await requireUser(r)).id,
    upload: async (userId, uploadId) => {
      const { data, error } = await db.from("uploaded_books").select("profile_id, storage_path")
        .eq("id", uploadId).eq("user_id", userId).maybeSingle();
      if (error) dbError("read the upload", error);
      return data ? { profileId: data.profile_id as string, storagePath: data.storage_path as string } : null;
    },
    ageRating: async (profileId) => {
      const { data, error } = await db.from("reader_profiles").select("age_rating").eq("id", profileId).maybeSingle();
      if (error) dbError("read the profile", error);
      return (data?.age_rating as string | undefined) ?? null;
    },
    profileShare: async (userId, profileId) => {
      const { data, error } = await db.from("reader_profiles").select("monthly_voice_minutes").eq("id", profileId).eq("account_id", userId).maybeSingle();
      if (error) dbError("read the profile", error);
      const minutes = data?.monthly_voice_minutes as number | null | undefined;
      if (minutes === null || minutes === undefined) return null;
      const month = naturalVoiceMonth(new Date());
      const { data: usage, error: usageError } = await db.from("natural_voice_profile_usage").select("characters")
        .eq("account_id", userId).eq("profile_id", profileId).eq("month", month).maybeSingle();
      if (usageError) dbError("read the profile's use", usageError);
      return { limit: Math.round((minutes / 60) * CHARACTERS_PER_HOUR), used: (usage?.characters as number | undefined) ?? 0 };
    },
    kidsVoices: async (profileId) => {
      const { data, error } = await db.from("reader_profiles").select("kids_natural_voices").eq("id", profileId).maybeSingle();
      if (error) dbError("read the profile", error);
      return data?.kids_natural_voices === true;
    },
    membership: async (userId) => {
      const { data, error } = await db.from("subscriptions").select("plan_id, status, trial_until").eq("user_id", userId).maybeSingle();
      if (error) dbError("read the membership", error);
      if (!data || (data.status !== "active" && data.status !== "past_due")) return null;
      // trial_until is set only while a first membership's free week lasts (cleared when it's paid for).
      const trial = typeof data.trial_until === "string" && Date.parse(data.trial_until) > Date.now();
      return { plan: data.plan_id as string, pastDue: data.status === "past_due", trial };
    },
    signedUrl: async (path) => {
      const { data, error } = await db.storage.from(VOICE_BUCKET).createSignedUrl(path, SIGNED_SECONDS);
      // A piece not voiced yet is "not found"; anything else is only logged, and it's voiced again.
      if (error && !/not.?found/i.test(error.message)) console.error("natural-voice: couldn't sign a piece:", error.message);
      return data?.signedUrl ?? null;
    },
    chapters: async (storagePath) => {
      const { data, error } = await db.storage.from("user-books").download(storagePath);
      if (error || !data) dbError("read the upload's text", error ?? { message: "no file" });
      const chapters = (JSON.parse(await data!.text()) as { chapters?: unknown }).chapters;
      if (!Array.isArray(chapters) || !chapters.every((c) => typeof c === "string")) {
        throw new HttpError("bad_request", "This book's text is damaged. Delete it and upload it again.");
      }
      return chapters as string[];
    },
    claim: async (userId, characters, limit) => {
      const { data, error } = await db.rpc("claim_natural_voice", { p_account: userId, p_characters: characters, p_limit: limit });
      if (error) dbError("count the voicing", error);
      return data === true;
    },
    release: async (userId, characters) => {
      const { error } = await db.rpc("release_natural_voice", { p_account: userId, p_characters: characters });
      if (error) throw error;
    },
    synthesize,
    recordProfile: async (userId, profileId, characters) => {
      const { error } = await db.rpc("record_natural_voice_profile", { p_account: userId, p_profile: profileId, p_characters: characters });
      if (error) throw error;
    },
    store: async (path, audio) => {
      const { error } = await db.storage.from(VOICE_BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (error) dbError("keep the voiced piece", error);
    },
    // A piece is about 85 seconds of listening, so this allows skipping about; the allowance limits the rest.
    rateLimit: (userId) => enforceRateLimit(`natural-voice:${userId}`, 300, 3600),
  });
});
