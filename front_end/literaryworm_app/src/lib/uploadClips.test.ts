import { describe, expect, it } from "@jest/globals";
import { readUploadClip, uploadClipAt, uploadClipPath, uploadClipWindow } from "./uploadClips";

const VOICE = "en-GB-Chirp3-HD-Aoede";
const pieces = [
  { offset: 0, text: "a".repeat(1000) },
  { offset: 1000, text: "b".repeat(500) },
];

describe("audio quotes from uploads", () => {
  it("finds the part heard at a place in the chapter, and where in it", () => {
    expect(uploadClipAt(2, 0.5, pieces, 30, VOICE, false)).toEqual({ chapter: 2, piece: 0, at: 750, length: 30, voice: VOICE, cast: false });
    expect(uploadClipAt(2, 0.9, pieces, 15, VOICE, true)).toMatchObject({ piece: 1, at: 700, cast: true });
    expect(uploadClipAt(0, 1, pieces, 15, VOICE, false)).toMatchObject({ piece: 1, at: 998 });
    expect(uploadClipAt(0, 0.5, [], 15, VOICE, false)).toBeNull();
  });

  it("writes and reads the link, refusing anything else", () => {
    const clip = uploadClipAt(2, 0.5, pieces, 30, VOICE, true)!;
    const path = uploadClipPath("u-0123456789abcdef0123456789abcdef", clip);
    expect(path).toBe(`/clips/u-0123456789abcdef0123456789abcdef?c=2&p=0&a=750&l=30&v=${VOICE}&x=1`);
    expect(readUploadClip(new URLSearchParams(path.split("?")[1]))).toEqual(clip);
    for (const bad of ["c=2&p=0&a=750&l=20&v=" + VOICE + "&x=1", "c=2&p=0&a=1001&l=30&v=" + VOICE + "&x=1", "c=2&p=0&a=7&l=30&v=nobody&x=1", "c=2&p=0&a=7&l=30&v=" + VOICE + "&x=2", "p=0&a=7&l=30&v=" + VOICE + "&x=0"]) {
      expect(readUploadClip(new URLSearchParams(bad))).toBeNull();
    }
  });

  it("plays the seconds heard up to the place, or ahead near the part's start", () => {
    expect(uploadClipWindow(500, 30, 80)).toEqual({ start: 10, end: 40 });
    expect(uploadClipWindow(0, 30, 80)).toEqual({ start: 0, end: 30 });
    expect(uploadClipWindow(1000, 60, 20)).toEqual({ start: 0, end: 20 });
    expect(uploadClipWindow(10, 15, 3)).toEqual({ start: 0, end: 3 });
  });
});
