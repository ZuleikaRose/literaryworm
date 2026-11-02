import { describe, expect, it } from "@jest/globals";
import { parseVoiceCommand, spokenSeconds, voiceCommandLabel, voiceControlOffered, voiceLanguage, VOICE_SKIP_MAX } from "./voiceCommands";

describe("voice commands in car mode", () => {
  it("hear play and pause in several ways", () => {
    for (const s of ["Play", "resume", "keep going please", "Continue."]) expect(parseVoiceCommand(s)).toEqual({ kind: "play" });
    for (const s of ["pause", "Stop!", "hold on"]) expect(parseVoiceCommand(s)).toEqual({ kind: "pause" });
  });

  it("hear skips, with or without a length", () => {
    expect(parseVoiceCommand("go back")).toEqual({ kind: "back", seconds: null });
    expect(parseVoiceCommand("rewind 30 seconds")).toEqual({ kind: "back", seconds: 30 });
    expect(parseVoiceCommand("back thirty")).toEqual({ kind: "back", seconds: 30 });
    expect(parseVoiceCommand("skip forward 2 minutes")).toEqual({ kind: "forward", seconds: 120 });
    expect(parseVoiceCommand("forward a minute")).toEqual({ kind: "forward", seconds: 60 });
  });

  it("hear chapters and leaving car mode before the plain words in them", () => {
    expect(parseVoiceCommand("next chapter")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("skip this chapter")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("go back a chapter")).toEqual({ kind: "previousChapter" });
    expect(parseVoiceCommand("previous chapter")).toEqual({ kind: "previousChapter" });
    expect(parseVoiceCommand("last chapter")).toEqual({ kind: "previousChapter" });
    expect(parseVoiceCommand("exit car mode")).toEqual({ kind: "exit" });
    expect(parseVoiceCommand("close the car view")).toEqual({ kind: "exit" });
  });

  it("ignore talk that isn't a command", () => {
    for (const s of ["", "   ", "what a lovely day", "turn left here"]) expect(parseVoiceCommand(s)).toBeNull();
  });

  it("cap a spoken skip at ten minutes", () => {
    expect(spokenSeconds("back 90 minutes")).toBe(VOICE_SKIP_MAX);
    expect(spokenSeconds("forward 5000")).toBe(VOICE_SKIP_MAX);
    expect(spokenSeconds("forward")).toBeNull();
  });

  it("say back what was done", () => {
    const skip = { back: 15, forward: 30 };
    expect(voiceCommandLabel({ kind: "back", seconds: null }, skip)).toBe("Back 15 seconds");
    expect(voiceCommandLabel({ kind: "forward", seconds: 60 }, skip)).toBe("Forward 60 seconds");
    expect(voiceCommandLabel({ kind: "pause" }, skip)).toBe("Paused");
  });

  it("listen in the browser's English, else British English", () => {
    expect(voiceLanguage("en-US")).toBe("en-US");
    expect(voiceLanguage("fr-FR")).toBe("en-GB");
    expect(voiceLanguage(undefined)).toBe("en-GB");
  });

  it("are never offered to Kids profiles, nor where the browser can't hear speech", () => {
    const g = globalThis as { window?: { webkitSpeechRecognition?: unknown } };
    expect(voiceControlOffered("all")).toBe(false);
    g.window = {};
    expect(voiceControlOffered("all")).toBe(false);
    const w = g.window;
    w.webkitSpeechRecognition = class {};
    expect(voiceControlOffered("all")).toBe(true);
    expect(voiceControlOffered("teen")).toBe(true);
    expect(voiceControlOffered("kids")).toBe(false);
    delete g.window;
  });
});
