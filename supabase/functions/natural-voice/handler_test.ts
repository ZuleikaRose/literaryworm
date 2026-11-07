// deno test --allow-env supabase/functions/natural-voice — runs offline: Supabase, Storage and
// Google are all stand-ins.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { CHARACTERS_PER_HOUR, chapterPieces, NATURAL_VOICE_TRIAL_HOURS, naturalVoice, naturalVoiceLimit, piecePronunciations, pronunciationKey, sayAs, voiceSegments } from "../_shared/naturalVoice.ts";
import { type Deps, handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const USER = "11111111-1111-4111-8111-111111111111";
const UPLOAD = "u-0123456789abcdef0123456789abcdef";
const VOICE = "en-GB-Chirp3-HD-Aoede";

const post = (body: unknown, method = "POST") =>
  new Request("http://local/natural-voice", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json", Authorization: "Bearer token" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const LONG = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} goes on for a little while, as sentences do.`).join(" ");
const TALK = "It was late. “Are you coming?” said Elizabeth. Mr. Darcy replied, “Not yet.”";
const CHAPTERS = ["Letter one. It was cold.", LONG, TALK];

function deps(overrides: Partial<Deps> = {}) {
  const calls = { synthesize: [] as string[], stored: [] as string[], claimed: [] as number[], released: 0, limited: 0 };
  const kept = new Set<string>();
  const d: Deps = {
    user: () => Promise.resolve(USER),
    upload: (userId, id) => Promise.resolve(userId === USER && id === UPLOAD ? { profileId: "p1", storagePath: `${USER}/${UPLOAD}.json` } : null),
    ageRating: () => Promise.resolve("all"),
    membership: () => Promise.resolve({ plan: "standard", pastDue: false, trial: false }),
    signedUrl: (path) => Promise.resolve(kept.has(path) ? `https://signed/${path}` : null),
    chapters: () => Promise.resolve(CHAPTERS),
    claim: (_user, characters, limit) => {
      calls.claimed.push(characters);
      return Promise.resolve(limit > 0);
    },
    release: () => {
      calls.released++;
      return Promise.resolve();
    },
    synthesize: (text) => {
      calls.synthesize.push(text);
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    store: (path) => {
      calls.stored.push(path);
      kept.add(path);
      return Promise.resolve();
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls, kept };
}

const ask = (chapter = 0, segment = 0, voice = VOICE) => post({ uploadId: UPLOAD, chapter, segment, voice });

Deno.test("voices a piece once, keeps it, and plays the kept copy after that", async () => {
  const { d, calls } = deps();
  const first = await handle(ask(1, 1), d);
  assertEquals(first.status, 200);
  const path = `${USER}/${UPLOAD}/${VOICE}-1-1.mp3`;
  assertEquals(await first.json(), { url: `https://signed/${path}` });
  assertEquals(calls.synthesize, [voiceSegments(LONG)[1].text]);
  assertEquals(calls.claimed, [voiceSegments(LONG)[1].text.length]);
  assertEquals(calls.stored, [path]);

  const again = await handle(ask(1, 1), d);
  assertEquals(await again.json(), { url: `https://signed/${path}` });
  assertEquals(calls.synthesize.length, 1);
  assertEquals(calls.claimed.length, 1);
});

Deno.test("only the member's own uploads", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ uploadId: "u-ffffffffffffffffffffffffffffffff", chapter: 0, segment: 0, voice: VOICE }), d);
  assertEquals(res.status, 404);
  assertEquals(calls.synthesize.length, 0);
});

Deno.test("never on Kids profiles", async () => {
  const { d, calls } = deps({ ageRating: () => Promise.resolve("kids") });
  const res = await handle(ask(), d);
  assertEquals(res.status, 403);
  assertEquals(calls.synthesize.length, 0);
});

Deno.test("needs a running membership", async () => {
  const { d } = deps({ membership: () => Promise.resolve(null) });
  assertEquals((await handle(ask(), d)).status, 403);
});

Deno.test("pauses while the last payment has failed, voicing nothing", async () => {
  const { d, calls } = deps({ membership: () => Promise.resolve({ plan: "premium", pastDue: true, trial: false }) });
  const res = await handle(ask(1, 1), d);
  assertEquals(res.status, 402);
  assertEquals((await res.json()).error.code, "payment_required");
  assertEquals(calls.claimed.length + calls.synthesize.length, 0);
});

Deno.test("the free week has one hour, whatever the plan; the plan's hours after the first payment", async () => {
  const limits: number[] = [];
  const claim = (_user: string, _chars: number, limit: number) => {
    limits.push(limit);
    return Promise.resolve(true);
  };
  const trial = deps({ membership: () => Promise.resolve({ plan: "premium", pastDue: false, trial: true }), claim });
  await handle(ask(1, 1), trial.d);
  const paid = deps({ membership: () => Promise.resolve({ plan: "premium", pastDue: false, trial: false }), claim });
  await handle(ask(1, 1), paid.d);
  assertEquals(limits, [naturalVoiceLimit("premium", true), naturalVoiceLimit("premium")]);
  assertEquals(naturalVoiceLimit("premium", true), NATURAL_VOICE_TRIAL_HOURS * CHARACTERS_PER_HOUR);
  const used = deps({ membership: () => Promise.resolve({ plan: "basic", pastDue: false, trial: true }), claim: () => Promise.resolve(false) });
  const res = await handle(ask(1, 1), used.d);
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, "trial_limit_reached");
});

Deno.test("refuses with limit_reached when this month's allowance is used up", async () => {
  const { d, calls } = deps({ claim: () => Promise.resolve(false) });
  const res = await handle(ask(), d);
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, "limit_reached");
  assertEquals(calls.synthesize.length, 0);
});

Deno.test("hands the claim back when Google fails", async () => {
  const { d, calls } = deps({ synthesize: () => Promise.reject(new HttpError("upstream_error", "We couldn't voice that just now. Try again.")) });
  const res = await handle(ask(), d);
  assertEquals(res.status, 502);
  assertEquals(calls.released, 1);
  assertEquals(calls.stored.length, 0);
});

Deno.test("checks every field", async () => {
  const { d } = deps();
  for (
    const body of [
      { uploadId: "frankenstein", chapter: 0, segment: 0, voice: VOICE },
      { uploadId: UPLOAD, chapter: -1, segment: 0, voice: VOICE },
      { uploadId: UPLOAD, chapter: 0, segment: 0, voice: "en-GB-Wavenet-A" },
      { uploadId: UPLOAD, chapter: 0, segment: 0, voice: VOICE, text: "anything" },
      { uploadId: UPLOAD, chapter: 3, segment: 0, voice: VOICE },
      { uploadId: UPLOAD, chapter: 0, segment: 0, voice: VOICE, cast: "yes" },
      { uploadId: UPLOAD, chapter: 2, segment: 9, voice: VOICE, cast: true },
      { uploadId: UPLOAD, chapter: 0, segment: 5, voice: VOICE },
    ]
  ) {
    assertEquals((await handle(post(body), d)).status, 400, JSON.stringify(body));
  }
});

Deno.test("a signed-out caller is refused before anything else", async () => {
  const { d, calls } = deps({ user: () => Promise.reject(new HttpError("unauthorized", "Log in to do that.")) });
  assertEquals((await handle(ask(), d)).status, 401);
  assertEquals(calls.synthesize.length, 0);
});

Deno.test("each plan has an allowance; nothing else does", () => {
  assertEquals(naturalVoiceLimit("basic") > 0, true);
  assertEquals(naturalVoiceLimit("premium") > naturalVoiceLimit("standard"), true);
  assertEquals(naturalVoiceLimit("toString"), 0);
});

Deno.test("character voices: each piece in its own voice, kept apart from the narrator's pieces", async () => {
  const { d, calls } = deps();
  const pieces = chapterPieces(TALK, naturalVoice(VOICE)!, true);
  const speech = pieces[1];
  assertEquals(speech.cast, true);
  const res = await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 1, voice: VOICE, cast: true }), d);
  assertEquals(res.status, 200);
  const path = `${USER}/${UPLOAD}/${speech.voice}-2-c1.mp3`;
  assertEquals(await res.json(), { url: `https://signed/${path}` });
  assertEquals(calls.synthesize, [speech.text]);
  assertEquals(calls.stored, [path]);
  // Asked again, the kept copy plays.
  await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 1, voice: VOICE, cast: true }), d);
  assertEquals(calls.synthesize.length, 1);

  // A chapter with no speech is voiced as without character voices: the same file.
  const plain = await handle(post({ uploadId: UPLOAD, chapter: 0, segment: 0, voice: VOICE, cast: true }), d);
  assertEquals(await plain.json(), { url: `https://signed/${USER}/${UPLOAD}/${VOICE}-0-0.mp3` });
});

Deno.test("character voices: the listener's choice of voice for a speaker, checked", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 1, voice: VOICE, cast: true, castChoices: { elizabeth: "Leda" } }), d);
  assertEquals(res.status, 200);
  assertEquals(calls.stored, [`${USER}/${UPLOAD}/en-GB-Chirp3-HD-Leda-2-c1.mp3`]);
  for (const castChoices of [{ elizabeth: "Nobody" }, ["Leda"], { elizabeth: "Leda" }]) {
    const body = Array.isArray(castChoices) || "elizabeth" in castChoices && castChoices.elizabeth === "Nobody"
      ? { uploadId: UPLOAD, chapter: 2, segment: 1, voice: VOICE, cast: true, castChoices }
      : { uploadId: UPLOAD, chapter: 2, segment: 1, voice: VOICE, castChoices };
    assertEquals((await handle(post(body), d)).status, 400, JSON.stringify(body));
  }
});

Deno.test("pronunciations: a piece with the name is sent respelled and kept apart; others keep their files", async () => {
  const { d, calls } = deps();
  const pronunciations = { Elizabeth: "ih-LIZ-uh-beth", Darcy: "DAR-see" };
  const res = await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 0, voice: VOICE, pronunciations }), d);
  assertEquals(res.status, 200);
  const says = piecePronunciations(TALK, pronunciations);
  const path = `${USER}/${UPLOAD}/${VOICE}-2-0-p${pronunciationKey(says)}.mp3`;
  assertEquals(await res.json(), { url: `https://signed/${path}` });
  assertEquals(calls.synthesize, [sayAs(TALK, pronunciations)]);
  assertEquals(calls.synthesize[0].includes("ih-LIZ-uh-beth") && calls.synthesize[0].includes("DAR-see"), true);
  // Asked again, the kept copy plays.
  await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 0, voice: VOICE, pronunciations }), d);
  assertEquals(calls.synthesize.length, 1);
  // A chapter without the names is the ordinary file.
  const plain = await handle(post({ uploadId: UPLOAD, chapter: 0, segment: 0, voice: VOICE, pronunciations }), d);
  assertEquals(await plain.json(), { url: `https://signed/${USER}/${UPLOAD}/${VOICE}-0-0.mp3` });
});

Deno.test("pronunciations: checked", async () => {
  const { d } = deps();
  for (const pronunciations of [["x"], { Elizabeth: "" }, { Elizabeth: "<break/>" }, { "": "x" }, { Elizabeth: 3 }]) {
    const res = await handle(post({ uploadId: UPLOAD, chapter: 2, segment: 0, voice: VOICE, pronunciations }), d);
    assertEquals(res.status, 400, JSON.stringify(pronunciations));
  }
});
