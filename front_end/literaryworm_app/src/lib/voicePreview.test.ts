import { describe, expect, it } from "@jest/globals";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NATURAL_VOICES } from "./naturalVoice";
import { previewPath, previewVoices, PREVIEW_TEXTS } from "./voicePreview";

describe("voice previews", () => {
  it("has a sentence for every natural-voice language", () => {
    for (const v of NATURAL_VOICES) expect(PREVIEW_TEXTS[v.language]).toBeTruthy();
  });

  it("has a recorded preview of every narrator and character voice (scripts/voice-previews.mjs)", () => {
    const list = previewVoices();
    expect(list.length).toBe(192);
    const missing = list.filter((v) => !existsSync(join(__dirname, "../../public", previewPath(v.id)))).map((v) => v.id);
    expect(missing).toEqual([]);
  });
});
