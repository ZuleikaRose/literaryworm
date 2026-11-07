import { describe, expect, it } from "@jest/globals";
import { bookSpeakers, chapterPieces, naturalVoice, parseCastChoices, speakerVoice } from "./naturalVoice";
import { CAST_BOOKS_MAX, castChoicesKey, parseAllCastChoices, withCastChoice } from "./castChoices";

const narrator = naturalVoice("en-GB-Chirp3-HD-Aoede")!;

describe("choosing a voice for each character", () => {
  it("uses the listener's choice for a speaker, any case, and deals out the rest", () => {
    expect(speakerVoice(narrator, "Elizabeth", { elizabeth: "Leda" })).toBe("en-GB-Chirp3-HD-Leda");
    expect(speakerVoice(narrator, "Darcy", { elizabeth: "Leda" })).toBe(speakerVoice(narrator, "Darcy"));
    const pieces = chapterPieces("“Hello,” said Elizabeth.", narrator, true, { elizabeth: "Puck" });
    expect(pieces[0].voice).toBe("en-GB-Chirp3-HD-Puck");
  });

  it("keeps only known voices and speakers, and handles empty input", () => {
    expect(parseCastChoices({ Elizabeth: "Leda", darcy: "Nobody", "": "Kore" })).toEqual({ elizabeth: "Leda" });
    expect(parseCastChoices(null)).toEqual({});
    expect(parseCastChoices(["Leda"])).toEqual({});
    expect(parseAllCastChoices({ dune: { paul: "Orus" }, empty: {}, bad: 3 })).toEqual({ dune: { paul: "Orus" } });
    expect(parseAllCastChoices(undefined)).toEqual({});
  });

  it("sets and clears a speaker's voice per book, keeping at most the limit of books", () => {
    const one = withCastChoice({}, "u-1", "Elizabeth", "Leda");
    expect(one).toEqual({ "u-1": { elizabeth: "Leda" } });
    expect(withCastChoice(one, "u-1", "elizabeth", null)).toEqual({});
    const many = Object.fromEntries(Array.from({ length: CAST_BOOKS_MAX }, (_, i) => [`b${i}`, { a: "Kore" }]));
    const next = withCastChoice(many, "new", "Ann", "Puck");
    expect(Object.keys(next)).toHaveLength(CAST_BOOKS_MAX);
    expect(next.b0).toBeUndefined();
    expect(castChoicesKey({ b: "Puck", a: "Kore" })).toBe("a=Kore,b=Puck");
  });

  it("lists a book's named speakers, most speeches first", () => {
    const chapters = ["“Hi,” said Anne. “Hello,” said Gilbert. “Bye,” said Anne.", "“No speakers here.”"];
    expect(bookSpeakers(chapters)).toEqual([
      { speaker: "Anne", speeches: 2 },
      { speaker: "Gilbert", speeches: 1 },
    ]);
    expect(bookSpeakers([])).toEqual([]);
  });
});
