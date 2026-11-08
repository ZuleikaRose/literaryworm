import { describe, expect, it } from "@jest/globals";
import { castParts, castVoiceFor, collapsedIndex } from "./deviceCast";
import { speakingParts } from "./speaking";

describe("device character voices", () => {
  it("maps the text's characters to where they land once whitespace is collapsed", () => {
    const text = "A  b\n\nc";
    const at = collapsedIndex(text);
    const collapsed = text.replace(/\s+/g, " ");
    expect(collapsed).toBe("A b c");
    expect(at[0]).toBe(0);
    expect(collapsed[at[3]]).toBe("b");
    expect(collapsed[at[6]]).toBe("c");
    expect(at[text.length]).toBe(collapsed.length);
  });

  it("cuts speech from the narration around it, each with its speaker, keeping the offsets", () => {
    const chapter = "The rain had stopped.\n\n“We should go now,” said Elizabeth.\n\n“Not yet,”  replied Darcy. He waited.";
    const parts = speakingParts(chapter);
    const cast = castParts(chapter, parts);
    const find = (words: string) => cast.find((p) => p.text.includes(words));
    expect(find("The rain")?.speaker).toBeUndefined();
    expect(find("We should go")?.speaker).toBe("Elizabeth");
    expect(find("said Elizabeth")?.speaker).toBeUndefined();
    expect(find("Not yet")?.speaker).toBe("Darcy");
    expect(find("replied Darcy")?.speaker).toBeUndefined();
    // Together the cut parts are exactly the narrator's text, in order.
    expect(cast.map((p) => p.text).join("")).toBe(parts.map((p) => p.text).join(""));
    for (let i = 1; i < cast.length; i++) expect(cast[i].offset).toBe(cast[i - 1].offset + cast[i - 1].text.length);
  });

  it("reads a chapter with no speech, or no text, as narration", () => {
    const chapter = "It was a dark night. Nobody spoke.";
    expect(castParts(chapter, speakingParts(chapter)).every((p) => p.speaker === undefined)).toBe(true);
    expect(castParts("", speakingParts(""))).toEqual([]);
    expect(collapsedIndex("")).toEqual([0]);
  });

  const narrator = { voiceURI: "Daniel", lang: "en-GB" };
  const voices = [narrator, { voiceURI: "Kate", lang: "en-GB" }, { voiceURI: "Samantha", lang: "en-US" }, { voiceURI: "Thomas", lang: "fr-FR" }];

  it("keeps the narrator for narration, and gives speakers other voices in the same language", () => {
    expect(castVoiceFor(voices, narrator, undefined)).toEqual({ voiceURI: "Daniel", pitch: 1 });
    const elizabeth = castVoiceFor(voices, narrator, "Elizabeth");
    expect(["Kate", "Samantha"]).toContain(elizabeth.voiceURI);
    expect(castVoiceFor(voices, narrator, "elizabeth")).toEqual(elizabeth);
    expect(castVoiceFor(voices, narrator, null)).toEqual({ voiceURI: "Kate", pitch: 1 });
  });

  it("changes the pitch per speaker when the device has only one voice in the language", () => {
    const only = [narrator, { voiceURI: "Thomas", lang: "fr-FR" }];
    const a = castVoiceFor(only, narrator, "Elizabeth");
    expect(a.voiceURI).toBe("Daniel");
    expect(a.pitch).not.toBe(1);
    expect(castVoiceFor(only, narrator, "Elizabeth")).toEqual(a);
    expect(castVoiceFor(only, narrator, null).pitch).not.toBe(1);
  });

  it("falls back to the narrator's voice when the device lists no voices", () => {
    expect(castVoiceFor([], narrator, "Elizabeth").voiceURI).toBe("Daniel");
    expect(castVoiceFor([], narrator, undefined)).toEqual({ voiceURI: "Daniel", pitch: 1 });
  });

  it("uses the listener's choice for a speaker when the device has that voice, else deals one out", () => {
    const named = [
      { voiceURI: "Daniel", lang: "en-GB", name: "Daniel" },
      { voiceURI: "uri-kate", lang: "en-GB", name: "Kate" },
      { voiceURI: "uri-moira", lang: "en-IE", name: "Moira" },
    ];
    const daniel = named[0];
    expect(castVoiceFor(named, daniel, "Elizabeth", { elizabeth: "Moira" })).toEqual({ voiceURI: "uri-moira", pitch: 1 });
    expect(castVoiceFor(named, daniel, "Elizabeth", { elizabeth: "Not on this device" })).toEqual(castVoiceFor(named, daniel, "Elizabeth"));
    // Narration and unnamed speech aren't chosen per speaker.
    expect(castVoiceFor(named, daniel, undefined, { elizabeth: "Moira" }).voiceURI).toBe("Daniel");
    expect(castVoiceFor(named, daniel, null, { elizabeth: "Moira" })).toEqual(castVoiceFor(named, daniel, null));
  });
});
