import { describe, expect, it } from "@jest/globals";
import { UI_LANGUAGES } from "./i18n";
import { parseVoiceCommand, spokenSeconds, voiceCommandLabel, voiceControlOffered, voiceHints, voiceLanguage, VOICE_SKIP_MAX } from "./voiceCommands";
import { VOICE_VOCAB } from "./voiceVocab";

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

  it("listen in the interface language, in the browser's variant of it", () => {
    expect(voiceLanguage("fr-CA", "fr")).toBe("fr-CA");
    expect(voiceLanguage("en-US", "fr")).toBe("fr-FR");
    expect(voiceLanguage(undefined, "ja")).toBe("ja-JP");
    expect(voiceLanguage("fil-PH", "tl")).toBe("fil-PH");
  });

  it("hear commands in other languages, accents or not", () => {
    expect(parseVoiceCommand("Atrás 30 segundos", "es")).toEqual({ kind: "back", seconds: 30 });
    expect(parseVoiceCommand("atras", "es")).toEqual({ kind: "back", seconds: null });
    expect(parseVoiceCommand("avanza 2 minutos", "es")).toEqual({ kind: "forward", seconds: 120 });
    expect(parseVoiceCommand("Chapitre suivant", "fr")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("Quitter le mode voiture", "fr")).toEqual({ kind: "exit" });
    expect(parseVoiceCommand("Pause.", "de")).toEqual({ kind: "pause" });
    expect(parseVoiceCommand("nächstes Kapitel", "de")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("次の章", "ja")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("30秒戻る", "ja")).toEqual({ kind: "back", seconds: 30 });
    expect(parseVoiceCommand("暂停", "zh")).toEqual({ kind: "pause" });
    expect(parseVoiceCommand("назад 2 минуты", "ru")).toEqual({ kind: "back", seconds: 120 });
    expect(parseVoiceCommand("الفصل التالي", "ar")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("अगला अध्याय", "hi")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("다음 장", "ko")).toEqual({ kind: "nextChapter" });
    expect(parseVoiceCommand("Επόμενο κεφάλαιο", "el")).toEqual({ kind: "nextChapter" });
  });

  it("don't take a word inside another word, or stray talk, as a command", () => {
    expect(parseVoiceCommand("qué bonito día", "es")).toBeNull();
    // "pause" alone mustn't come from inside a longer word.
    expect(parseVoiceCommand("pauserait", "fr")).toBeNull();
    // Leaving car mode needs the word for the car.
    expect(parseVoiceCommand("quitter", "fr")).toBeNull();
  });

  it("have words for every interface language, and each language's own phrases parse to their command", () => {
    for (const { code } of UI_LANGUAGES) {
      const v = VOICE_VOCAB[code];
      expect(voiceHints(code)).toHaveLength(7);
      for (const p of v.exit) expect(parseVoiceCommand(p, code)).toEqual({ kind: "exit" });
      for (const p of v.nextChapter) expect(parseVoiceCommand(p, code)).toEqual({ kind: "nextChapter" });
      for (const p of v.previousChapter) expect(parseVoiceCommand(p, code)).toEqual({ kind: "previousChapter" });
      for (const p of v.pause) expect(parseVoiceCommand(p, code)).toEqual({ kind: "pause" });
      for (const p of v.play) expect(parseVoiceCommand(p, code)?.kind).toBe("play");
      for (const p of v.back) expect(parseVoiceCommand(p, code)?.kind).toBe("back");
      for (const p of v.forward) expect(parseVoiceCommand(p, code)?.kind).toBe("forward");
    }
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
