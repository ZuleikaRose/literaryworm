import { describe, expect, it } from "@jest/globals";
import { CONTENT_TOPICS, type ContentNote, notesLine, present, strongest } from "./contentNotes";

const notes = (levels: Partial<Record<ContentNote["topic"], ContentNote["level"]>>): ContentNote[] =>
  CONTENT_TOPICS.map(({ topic }) => ({ topic, level: levels[topic] ?? "none", note: "" }));

describe("content notes", () => {
  it("has the function's eight topics", () => {
    expect(CONTENT_TOPICS.map((t) => t.topic)).toEqual(["violence", "death", "frightening", "language", "sexual_content", "substance_use", "discrimination", "self_harm"]);
  });

  it("shows what's flagged, strongest first, then in topic order", () => {
    const n = notes({ death: "moderate", frightening: "strong", violence: "moderate", language: "mild" });
    expect(present(n).map((x) => x.topic)).toEqual(["frightening", "violence", "death", "language"]);
    expect(strongest(n)).toBe("strong");
    expect(strongest(notes({}))).toBe("none");
  });

  it("says it in a line", () => {
    expect(notesLine(notes({ frightening: "strong", violence: "moderate", death: "moderate" }))).toBe("Strong: frightening scenes. Moderate: violence, death.");
    expect(notesLine(notes({}))).toBe("Nothing to flag.");
  });
});
