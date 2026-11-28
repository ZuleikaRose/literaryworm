import { describe, expect, it } from "@jest/globals";
import {
  DEVICE_PIECE_CHARS,
  devicePieces,
  isEnglish,
  MODEL_PART_BYTES,
  modelPartPaths,
  modelPath,
  DEMO_ON_DEVICE_FILES,
  offeredOnDeviceVoices,
  ON_DEVICE_ACCENTS,
  ON_DEVICE_PREFIX,
  ON_DEVICE_VOICES,
  onDeviceChoice,
  onDeviceOffered,
  phonemeIds,
  wavBytes,
} from "./onDeviceVoice";

describe("on-device voices", () => {
  it("has 39 voices with distinct ids, a woman and a man in most accents, and a model each", () => {
    expect(ON_DEVICE_VOICES).toHaveLength(39);
    expect(new Set(ON_DEVICE_VOICES.map((v) => v.id)).size).toBe(ON_DEVICE_VOICES.length);
    for (const accent of ON_DEVICE_ACCENTS) expect(ON_DEVICE_VOICES.some((v) => v.accent === accent)).toBe(true);
    for (const accent of ["American", "British", "Scottish", "Irish", "Canadian", "South African"] as const) {
      expect(ON_DEVICE_VOICES.some((v) => v.accent === accent && v.gender === "woman")).toBe(true);
      expect(ON_DEVICE_VOICES.some((v) => v.accent === accent && v.gender === "man")).toBe(true);
    }
    for (const v of ON_DEVICE_VOICES) {
      expect(modelPath(v)).toMatch(/^\/voice-models\/en_(US|GB)-[a-z0-9_]+-(low|medium)\.onnx$/);
      // Each part is under Storage's 50 MB limit.
      expect(v.parts).toBe(Math.ceil(v.bytes / MODEL_PART_BYTES));
      expect(modelPartPaths(v)).toHaveLength(v.parts);
      // Only the many-speaker models name a speaker.
      expect(Boolean(v.speaker)).toBe(/vctk|arctic/.test(v.file));
    }
    // The speakers of one model share its file (one download for all of them).
    expect(new Set(ON_DEVICE_VOICES.map((v) => v.file)).size).toBe(16);
    expect(modelPath(ON_DEVICE_VOICES[0], true)).toBe("/voice-models/en_US-ljspeech-medium.onnx.json");
  });

  it("reads a choice only when it names one of them", () => {
    expect(onDeviceChoice(`${ON_DEVICE_PREFIX}norman`)?.name).toBe("Norman");
    expect(onDeviceChoice(`${ON_DEVICE_PREFIX}vctk-p343`)?.speaker).toBe("p343");
    expect(onDeviceChoice(`${ON_DEVICE_PREFIX}nobody`)).toBeNull();
    expect(onDeviceChoice("natural:Kore")).toBeNull();
    expect(onDeviceChoice(null)).toBeNull();
  });

  it("is offered to members for English books only", () => {
    expect(isEnglish(undefined)).toBe(true);
    expect(isEnglish("English")).toBe(true);
    expect(isEnglish("en-GB")).toBe(true);
    expect(isEnglish("eng")).toBe(true);
    expect(isEnglish("French")).toBe(false);
    expect(isEnglish("el")).toBe(false);
    expect(onDeviceOffered({ member: true, language: null })).toBe(true);
    expect(onDeviceOffered({ member: false, language: null })).toBe(false);
    expect(onDeviceOffered({ member: true, language: "German" })).toBe(false);
  });

  it("cuts a chapter into short whole-sentence pieces that keep their places", () => {
    const sentence = "It was a dark and stormy night, and the rain fell in torrents. ";
    const chapter = sentence.repeat(20);
    const pieces = devicePieces(chapter);
    expect(pieces.length).toBeGreaterThan(4);
    for (const p of pieces) {
      expect(p.text.length).toBeLessThanOrEqual(DEVICE_PIECE_CHARS);
      expect(chapter.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
      expect(p.text.endsWith(".")).toBe(true);
    }
    // A sentence with no stop is cut at a space.
    const long = devicePieces("word ".repeat(200));
    expect(long.every((p) => p.text.length <= DEVICE_PIECE_CHARS && !p.text.startsWith(" "))).toBe(true);
    expect(devicePieces("   ")).toEqual([]);
  });

  it("writes a WAV header and clips the samples", () => {
    const wav = wavBytes([0, 1, -1, 2], 22050);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 15))).toBe("WAVEfmt");
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 32767]);
  });

  it("lays out phoneme ids like @piper-plus/g2p's Encoder", () => {
    const map = { "^": [1], $: [2], _: [0], h: [20], ɛ: [61], l: [24], o: [27], ʊ: [100] };
    expect(phonemeIds(["h", "ɛ", "l", "oʊ"], map)).toEqual([1, 20, 0, 61, 0, 24, 0, 27, 0, 100, 0, 2]);
    // An unknown character keeps its pad, as the Encoder does.
    expect(phonemeIds(["x"], map)).toEqual([1, 0, 2]);
  });

  it("matches the Encoder on a real voice's map (LJSpeech's ids for these characters)", () => {
    // The ids en_US-ljspeech-medium.onnx.json gives these characters; the expected list is what
    // @piper-plus/g2p 0.5.0's Encoder produced for the same tokens.
    const map = { "^": [1], $: [2], _: [0], " ": [3], ".": [10], j: [22], u: [33], ː: [122], w: [35], ɪ: [74], l: [24], ɹ: [88], d: [17], ʒ: [108], ˈ: [120], ɔ: [54], s: [31] };
    const tokens = ["j", "u", "ː", " ", "w", "ɪ", "l", " ", "ɹ", "ɪ", "d", "ʒ", "ˈ", "ɔ", "ɪ", "s", "."];
    expect(phonemeIds(tokens, map)).toEqual([1, 22, 0, 33, 0, 122, 0, 3, 0, 35, 0, 74, 0, 24, 0, 3, 0, 88, 0, 74, 0, 17, 0, 108, 0, 120, 0, 54, 0, 74, 0, 31, 0, 10, 0, 2]);
  });
  it("offers members all 39, the demo 21 voices from three models (every accent), and nobody else any", () => {
    expect(offeredOnDeviceVoices({ offered: false, demo: false })).toEqual([]);
    expect(offeredOnDeviceVoices({ offered: false, demo: true })).toEqual([]);
    expect(offeredOnDeviceVoices({ offered: true, demo: false })).toHaveLength(39);
    const demo = offeredOnDeviceVoices({ offered: true, demo: true });
    expect(demo).toHaveLength(21);
    expect(new Set(demo.map((v) => v.file))).toEqual(new Set(DEMO_ON_DEVICE_FILES));
    for (const accent of ON_DEVICE_ACCENTS) expect(demo.some((v) => v.accent === accent)).toBe(true);
    expect(demo.map((v) => v.name)).toEqual(expect.arrayContaining(["Linda", "Norman"]));
  });
});
