// POST /functions/v1/natural-voice  { "uploadId": "u-…", "chapter": 0, "segment": 0, "voice": "en-GB-Chirp3-HD-Aoede", "cast": false }
// → { "url": "<a signed link to the MP3, good for an hour>" }
//
// A natural voice reading a member's own uploaded book: one piece of one chapter (voiceSegments()
// in _shared/naturalVoice.ts, which the browser cuts the same way), voiced by Google Cloud
// Text-to-Speech the first time it's asked for and kept in the private upload-voices bucket, so
// every later play is free. Members only, never on Kids profiles; new voicing counts against the
// account's monthly allowance (NATURAL_VOICE_HOURS by plan). Only the piece's text goes to
// Google, nothing about the member. With "cast" (character voices), the chapter is cut by
// chapterPieces() into narration and speech and the piece is read by the voice it gives (the
// narrator's, or a character voice in the same language), kept under its own name.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { chapterPieces, naturalVoice, naturalVoiceLimit, voiceFile } from "../_shared/naturalVoice.ts";
import { onlyKeys, parseInt } from "../_shared/validate.ts";

const METHODS = "POST";

export type Upload = { profileId: string; storagePath: string };

export type Deps = {
  /** The caller's id (throws an HttpError when the session isn't good enough). */
  user: (req: Request) => Promise<string>;
  /** The caller's upload, or null when it isn't theirs or doesn't exist. */
  upload: (userId: string, uploadId: string) => Promise<Upload | null>;
  /** The profile's age rating ("kids", "teen" or "all"). */
  ageRating: (profileId: string) => Promise<string | null>;
  /** The account's plan while its membership is running (active or past due), else null. */
  plan: (userId: string) => Promise<string | null>;
  /** A signed link to a kept piece, or null when it hasn't been voiced yet. */
  signedUrl: (path: string) => Promise<string | null>;
  /** The upload's chapters, from the user-books bucket. */
  chapters: (storagePath: string) => Promise<string[]>;
  /** Counts characters against this month's allowance; false when they won't fit. */
  claim: (userId: string, characters: number, limit: number) => Promise<boolean>;
  /** Hands a claim back after Google failed. */
  release: (userId: string, characters: number) => Promise<void>;
  /** Google's voicing of the text, as MP3. */
  synthesize: (text: string, voiceId: string, languageCode: string) => Promise<Uint8Array>;
  /** Keeps the MP3 at path. */
  store: (path: string, audio: Uint8Array) => Promise<void>;
  rateLimit?: (userId: string) => Promise<void>;
};

const UPLOAD_ID = /^u-[0-9a-f]{32}$/;

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const userId = await deps.user(req);
    const body = await readJsonBody(req);
    onlyKeys(body, ["uploadId", "chapter", "segment", "voice", "cast"]);
    if (typeof body.uploadId !== "string" || !UPLOAD_ID.test(body.uploadId)) {
      throw new HttpError("bad_request", "uploadId must be an uploaded book's id.");
    }
    const uploadId = body.uploadId;
    const chapter = parseInt(body.chapter, "chapter", 0, 499);
    const segment = parseInt(body.segment, "segment", 0, 9999);
    const voice = typeof body.voice === "string" ? naturalVoice(body.voice) : null;
    if (!voice) throw new HttpError("bad_request", "voice must be one of the natural voices.");
    if (body.cast !== undefined && typeof body.cast !== "boolean") throw new HttpError("bad_request", "cast must be true or false.");
    const cast = body.cast === true;

    const upload = await deps.upload(userId, uploadId);
    if (!upload) throw new HttpError("not_found", "That book isn't one of your uploads.");
    const rating = await deps.ageRating(upload.profileId);
    if (rating === null || rating === "kids") throw new HttpError("forbidden", "Natural voices aren't offered on Kids profiles.");
    const plan = await deps.plan(userId);
    if (!plan) throw new HttpError("forbidden", "Natural voices come with a membership.");

    // Without character voices the piece's file is known at once, so a kept one costs no text read.
    if (!cast) {
      const kept = await deps.signedUrl(voiceFile(userId, uploadId, voice.id, chapter, segment));
      if (kept) return json(req, METHODS, { url: kept });
    }

    const chapters = await deps.chapters(upload.storagePath);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    const pieces = chapterPieces(chapters[chapter], voice, cast);
    if (segment >= pieces.length) throw new HttpError("bad_request", `segment must be below ${pieces.length}.`);
    const piece = pieces[segment];
    const path = voiceFile(userId, uploadId, piece.voice, chapter, segment, piece.cast);
    if (cast) {
      const kept = await deps.signedUrl(path);
      if (kept) return json(req, METHODS, { url: kept });
    }

    await deps.rateLimit?.(userId);
    const text = piece.text;

    if (!(await deps.claim(userId, text.length, naturalVoiceLimit(plan)))) {
      throw new HttpError("limit_reached", "This month's natural-voice reading is used up.");
    }
    let audio: Uint8Array;
    try {
      audio = await deps.synthesize(text, piece.voice, voice.languageCode);
    } catch (err) {
      await deps.release(userId, text.length).catch((e: unknown) => console.error("natural-voice: couldn't hand back a claim", e));
      throw err;
    }
    await deps.store(path, audio);
    const url = await deps.signedUrl(path);
    if (!url) throw new HttpError("server_error", "Something went wrong. Try again.");
    return json(req, METHODS, { url });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
