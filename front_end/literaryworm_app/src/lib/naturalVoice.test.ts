import { describe, expect, it } from "@jest/globals";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHARACTERS_PER_HOUR,
  DEFAULT_NATURAL_VOICE,
  defaultNaturalVoice,
  NATURAL_LANGUAGES,
  naturalVoiceMonth,
  naturalVoiceTime,
  NATURAL_VOICE_HOURS,
  NATURAL_VOICES,
  naturalVoice,
  naturalVoiceLimit,
  naturalVoiceOffered,
  SEGMENT_CHARS,
  voiceFile,
  voicesFor,
  voiceSegments,
} from "./naturalVoice";
import { DEMO_CAST_SAMPLE, DEMO_NATURAL_SAMPLE, DEMO_NATURAL_SAMPLES, DEMO_UPLOAD_TEXTS } from "../data/demoUploads";
import { demoPieceFiles, demoVoicePath } from "./demoVoices";

const UTF8 = new TextEncoder();

describe("natural voices for uploads", () => {
  it("is the same file as the natural-voice function's, so both cut chapters the same way", () => {
    const app = readFileSync(join(__dirname, "naturalVoice.ts"), "utf8");
    const functions = readFileSync(join(__dirname, "../../../../supabase/functions/_shared/naturalVoice.ts"), "utf8");
    expect(functions).toBe(app);
  });

  it("cuts a chapter at sentence ends, every piece under the limit and the text kept whole", () => {
    const chapter = Array.from({ length: 60 }, (_, i) => `“Sentence ${i} runs on for a while,” she said, “as sentences do.”`).join(" ") +
      "\n\nA new paragraph. And another sentence!";
    const pieces = voiceSegments(chapter);
    expect(pieces.length).toBeGreaterThan(2);
    for (const p of pieces) {
      expect(p.text.length).toBeLessThanOrEqual(SEGMENT_CHARS);
      expect(UTF8.encode(p.text).length).toBeLessThan(5000);
      expect(chapter.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
      expect(p.text).toBe(p.text.trim());
    }
    // Every piece but the last ends a sentence.
    for (const p of pieces.slice(0, -1)) expect(p.text).toMatch(/[.!?…]["'”’)\]]*$/);
    // Nothing is lost: the pieces, joined, are the chapter's words.
    expect(pieces.map((p) => p.text).join(" ").split(/\s+/)).toEqual(chapter.trim().split(/\s+/));
  });

  it("cuts a sentence longer than the limit at a space, and text with no spaces at the limit", () => {
    const long = Array.from({ length: 400 }, () => "word").join(" ");
    const pieces = voiceSegments(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.text.length <= SEGMENT_CHARS && !p.text.startsWith(" "))).toBe(true);
    expect(pieces.map((p) => p.text).join(" ")).toBe(long);

    const solid = "x".repeat(SEGMENT_CHARS * 2 + 5);
    expect(voiceSegments(solid).map((p) => p.text.length)).toEqual([SEGMENT_CHARS, SEGMENT_CHARS, 5]);
  });

  it("gives nothing to read for an empty chapter, and one piece for a short one", () => {
    expect(voiceSegments("")).toEqual([]);
    expect(voiceSegments("  \n ")).toEqual([]);
    expect(voiceSegments("  Letter 1. It was cold.  ")).toEqual([{ offset: 2, text: "Letter 1. It was cold." }]);
  });

  it("offers natural voices only on members' stored uploads, never on Kids profiles", () => {
    const upload = { member: true, ageRating: "all", uploadPath: "user/u-1.json" };
    expect(naturalVoiceOffered(upload)).toBe(true);
    expect(naturalVoiceOffered({ ...upload, ageRating: "teen" })).toBe(true);
    expect(naturalVoiceOffered({ ...upload, ageRating: "kids" })).toBe(false);
    expect(naturalVoiceOffered({ ...upload, ageRating: null })).toBe(false);
    expect(naturalVoiceOffered({ ...upload, member: false })).toBe(false);
    expect(naturalVoiceOffered({ ...upload, uploadPath: null })).toBe(false);
  });

  it("has a monthly allowance for each plan, growing with the plan", () => {
    expect(naturalVoiceLimit("basic")).toBe(NATURAL_VOICE_HOURS.basic * CHARACTERS_PER_HOUR);
    expect(naturalVoiceLimit("basic")).toBeLessThan(naturalVoiceLimit("standard"));
    expect(naturalVoiceLimit("standard")).toBeLessThan(naturalVoiceLimit("premium"));
    expect(naturalVoiceLimit("constructor")).toBe(0);
  });

  it("names real voices, the default among them, and keeps pieces in the upload's folder", () => {
    expect(naturalVoice(DEFAULT_NATURAL_VOICE)?.accent).toBe("British");
    expect(new Set(NATURAL_VOICES.map((v) => v.id)).size).toBe(NATURAL_VOICES.length);
    // Chirp 3: HD everywhere Google has it; Filipino has none, so Tagalog uses its Neural2 voices.
    for (const v of NATURAL_VOICES) expect(v.id.startsWith(v.language === "tl" ? "fil-ph-Neural2-" : `${v.languageCode}-Chirp3-HD-`)).toBe(true);
    expect(naturalVoice("en-GB-Wavenet-A")).toBeNull();
    expect(voiceFile("user", "u-1", DEFAULT_NATURAL_VOICE, 2, 7)).toBe(`user/u-1/${DEFAULT_NATURAL_VOICE}-2-7.mp3`);
  });

  it("has the demo's natural-voice samples recorded in every English voice, with character voices too (scripts/voice-demo-sample.mjs)", () => {
    for (const id of DEMO_NATURAL_SAMPLES) {
      const missing = demoPieceFiles(id, DEMO_UPLOAD_TEXTS.get(id)!)
        .map((f) => f.path)
        .filter((path) => !existsSync(join(__dirname, "../../public", path)));
      expect(missing).toEqual([]);
    }
    // Frankenstein plays exactly the plain pieces; The Tide Clock has speech in other voices.
    const plain = voicesFor("en").flatMap((v) => DEMO_UPLOAD_TEXTS.get(DEMO_NATURAL_SAMPLE)!.flatMap((text, c) => voiceSegments(text).map((_, s) => demoVoicePath(DEMO_NATURAL_SAMPLE, v.id, c, s))));
    expect(demoPieceFiles(DEMO_NATURAL_SAMPLE, DEMO_UPLOAD_TEXTS.get(DEMO_NATURAL_SAMPLE)!).map((f) => f.path).sort()).toEqual(plain.sort());
    expect(demoPieceFiles(DEMO_CAST_SAMPLE, DEMO_UPLOAD_TEXTS.get(DEMO_CAST_SAMPLE)!).some((f) => /-c\d+\.mp3$/.test(f.path))).toBe(true);
  });

  it("offers a book its own language's voices first, then the English ones, and starts with its own", () => {
    expect(voicesFor(null).every((v) => v.language === "en")).toBe(true);
    expect(voicesFor("fr").map((v) => v.language)).toEqual(["fr", "fr", "en", "en", "en", "en", "en", "en"]);
    expect(voicesFor("el").every((v) => v.language === "en")).toBe(true);
    expect(defaultNaturalVoice("de").id).toBe("de-DE-Chirp3-HD-Aoede");
    expect(defaultNaturalVoice(null).id).toBe(DEFAULT_NATURAL_VOICE);
    for (const lang of NATURAL_LANGUAGES) expect(voicesFor(lang)[0].language).toBe(lang);
  });

  it("counts natural-voice time in hours of reading, by the UTC month", () => {
    const { used, left, limit } = naturalVoiceTime("standard", CHARACTERS_PER_HOUR * 4.5);
    expect([used / 3600, left / 3600, limit / 3600]).toEqual([4.5, 1.5, 6]);
    expect(naturalVoiceTime("basic", CHARACTERS_PER_HOUR * 9).left).toBe(0);
    expect(naturalVoiceMonth(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-01");
  });

  it("names Google's voices for languages whose codes aren't the book's two letters", () => {
    expect(defaultNaturalVoice("zh").id).toBe("cmn-CN-Chirp3-HD-Aoede");
    expect(defaultNaturalVoice("ar").languageCode).toBe("ar-XA");
    expect(defaultNaturalVoice("tl").id).toBe("fil-ph-Neural2-A");
    expect(defaultNaturalVoice("tl").languageCode).toBe("fil-PH");
    // Filipino's code starts "fi", but it isn't offered for Finnish.
    expect(voicesFor("fi").every((v) => v.language === "en")).toBe(true);
  });

  it("cuts Chinese, Japanese, Hindi and Arabic at their own sentence ends", () => {
    const zh = "这是第一句。".repeat(400) + "最后一句。";
    const pieces = voiceSegments(zh);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) {
      expect(p.text.endsWith("。")).toBe(true);
      expect(new TextEncoder().encode(p.text).length).toBeLessThan(5000);
    }
    expect(pieces.map((p) => p.text).join("")).toBe(zh);
    const hi = "यह पहला वाक्य है। ".repeat(100);
    expect(voiceSegments(hi).every((p) => p.text.endsWith("।"))).toBe(true);
    const ar = "هل هذه جملة؟ ".repeat(150);
    expect(voiceSegments(ar).every((p) => p.text.endsWith("؟"))).toBe(true);
  });
});
