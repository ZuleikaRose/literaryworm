import { describe, expect, it } from "@jest/globals";
import { CAST_NAMES, castSegments, chapterPieces, naturalVoice, SEGMENT_CHARS, speakerVoice, voiceFile, voiceSegments } from "./naturalVoice";
import { DEMO_NATURAL_SAMPLE, DEMO_UPLOAD_TEXTS } from "../data/demoUploads";

const narrator = naturalVoice("en-GB-Chirp3-HD-Aoede")!;

describe("character voices", () => {
  it("splits speech from narration and finds who said it, before or after the words", () => {
    const chapter = "It was late. “Are you coming?” said Elizabeth. Mr. Darcy replied, “Not yet.”\nShe left.";
    const parts = castSegments(chapter)!;
    expect(parts.map((p) => [p.text, p.speech, p.speaker])).toEqual([
      ["It was late.", false, null],
      ["“Are you coming?”", true, "Elizabeth"],
      ["said Elizabeth. Mr. Darcy replied,", false, null],
      ["“Not yet.”", true, "Mr. Darcy"],
      ["She left.", false, null],
    ]);
    // Offsets point into the chapter.
    for (const p of parts) expect(chapter.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
  });

  it("gives unnamed speech the speaker named in the same paragraph, and pronouns no name", () => {
    const parts = castSegments("“Wait,” said Alice. “Wait for me!”\n“Why?” he asked.")!.filter((p) => p.speech);
    expect(parts.map((p) => p.speaker)).toEqual(["Alice", "Alice", null]);
  });

  it("reads straight quotes, guillemets and a speech left open at the paragraph's end", () => {
    const parts = castSegments('"Hello," said Tom. «Bonjour», dit-il.\n“And so it went on')!.filter((p) => p.speech);
    expect(parts.map((p) => p.text)).toEqual(['"Hello,"', "«Bonjour»", "“And so it went on"]);
  });

  it("returns null for a chapter with no speech, and empty input", () => {
    expect(castSegments("No one spoke at all.")).toBeNull();
    expect(castSegments("")).toBeNull();
    expect(castSegments("“ … ”")).toBeNull();
    expect(chapterPieces("", narrator, true)).toEqual([]);
  });

  it("keeps a speaker's voice, never the narrator's, and one voice for unnamed speech", () => {
    const elizabeth = speakerVoice(narrator, "Elizabeth");
    expect(speakerVoice(narrator, "elizabeth")).toBe(elizabeth);
    expect(elizabeth).toMatch(/^en-GB-Chirp3-HD-/);
    for (const name of ["Alice", "Tom", "Mr. Darcy", "Jane", "Kitty", "Lydia", "Mary"]) {
      expect(speakerVoice(narrator, name)).not.toBe(narrator.id);
      expect(CAST_NAMES).toContain(speakerVoice(narrator, name).split("-").pop());
    }
    expect(speakerVoice(narrator, null)).toBe("en-GB-Chirp3-HD-Charon");
    expect(speakerVoice(naturalVoice("en-GB-Chirp3-HD-Charon")!, null)).toBe("en-GB-Chirp3-HD-Kore");
    expect(speakerVoice(naturalVoice("fr-FR-Chirp3-HD-Aoede")!, "Jean")).toMatch(/^fr-FR-Chirp3-HD-/);
  });

  it("reads a chapter with no speech exactly as without character voices", () => {
    const text = "One sentence here. Another one there.";
    expect(chapterPieces(text, narrator, true)).toEqual(chapterPieces(text, narrator, false));
    expect(chapterPieces(text, narrator, false)).toEqual(voiceSegments(text).map((p) => ({ ...p, voice: narrator.id, cast: false })));
    // So the demo's Frankenstein sample (letters, no speech) plays its recorded pieces either way.
    const sample = DEMO_UPLOAD_TEXTS.get(DEMO_NATURAL_SAMPLE) ?? [];
    expect(sample.length).toBeGreaterThan(0);
    for (const chapter of sample) {
      expect(chapterPieces(chapter, narrator, true).every((p) => !p.cast)).toBe(true);
    }
  });

  it("keeps long speech under the piece limit, and numbers cast pieces apart", () => {
    const long = `“${"Words and more words. ".repeat(200)}” said Ann.`;
    const pieces = chapterPieces(long, narrator, true);
    expect(pieces.every((p) => p.text.length <= SEGMENT_CHARS && p.cast)).toBe(true);
    expect(new Set(pieces.slice(0, -1).map((p) => p.voice)).size).toBe(1);
    expect(voiceFile("me", "u-1", narrator.id, 2, 3, true)).toBe("me/u-1/en-GB-Chirp3-HD-Aoede-2-c3.mp3");
    expect(voiceFile("me", "u-1", narrator.id, 2, 3)).toBe("me/u-1/en-GB-Chirp3-HD-Aoede-2-3.mp3");
  });

  it("follows two people talking in turn, through unnamed and pronoun-only speech", () => {
    const chapter = [
      "“Where are you going?” said Anne.",
      "“To the river,” replied Gilbert.",
      "“May I come?”",
      "“If you like,” he said.",
      "They walked on in silence.",
      "“Look!”",
    ].join("\n");
    const speakers = castSegments(chapter)!.filter((p) => p.speech).map((p) => p.speaker);
    // A narration-only paragraph ends the run, so the last speech has no speaker.
    expect(speakers).toEqual(["Anne", "Gilbert", "Anne", "Gilbert", null]);
  });

  it("finds speakers named in French, German and Spanish", () => {
    const fr = castSegments("« Bonjour », dit Jean. « Il fait beau », répondit Marie.")!.filter((p) => p.speech);
    expect(fr.map((p) => p.speaker)).toEqual(["Jean", "Marie"]);
    const de = castSegments("„Guten Tag“, sagte Hans. „Wie geht's?“, fragte Greta.")!.filter((p) => p.speech);
    expect(de.map((p) => p.speaker)).toEqual(["Hans", "Greta"]);
    const es = castSegments("“¿Vienes?”, preguntó Lucía. “Sí”, dijo él.")!.filter((p) => p.speech);
    expect(es.map((p) => p.speaker)).toEqual(["Lucía", "Lucía"]);
  });
});
