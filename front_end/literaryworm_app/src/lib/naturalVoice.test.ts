import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHARACTERS_PER_HOUR,
  DEFAULT_NATURAL_VOICE,
  NATURAL_VOICE_HOURS,
  NATURAL_VOICES,
  naturalVoice,
  naturalVoiceLimit,
  naturalVoiceOffered,
  SEGMENT_CHARS,
  voiceFile,
  voiceSegments,
} from "./naturalVoice";

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
    for (const v of NATURAL_VOICES) expect(v.id.startsWith(`${v.languageCode}-Chirp3-HD-`)).toBe(true);
    expect(naturalVoice("en-GB-Wavenet-A")).toBeNull();
    expect(voiceFile("user", "u-1", DEFAULT_NATURAL_VOICE, 2, 7)).toBe(`user/u-1/${DEFAULT_NATURAL_VOICE}-2-7.mp3`);
  });
});
