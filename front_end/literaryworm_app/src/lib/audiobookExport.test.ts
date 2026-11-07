import { describe, expect, it } from "@jest/globals";
import { audiobookFileName, collectAudiobook } from "./audiobookExport";

describe("downloading an upload's audiobook", () => {
  it("joins every kept part in reading order, and says how many are missing", async () => {
    const kept = new Map([
      ["0:0", "ab"],
      ["0:1", "cd"],
      ["1:0", "ef"],
    ]);
    const blobOf = (c: number, s: number) => Promise.resolve(kept.has(`${c}:${s}`) ? new Blob([kept.get(`${c}:${s}`)!]) : null);
    const whole = await collectAudiobook([[0, 0], [0, 1], [1, 0]], blobOf);
    expect(whole.missing).toBe(0);
    expect(whole.blob?.type).toBe("audio/mpeg");
    expect(await whole.blob!.text()).toBe("abcdef");
    const part = await collectAudiobook([[0, 0], [2, 0], [3, 0]], blobOf);
    expect(part).toEqual({ blob: null, missing: 2 });
    expect((await collectAudiobook([], blobOf)).blob).toBeNull();
  });

  it("names the file after the book", () => {
    expect(audiobookFileName("The Tide Clock")).toBe("the-tide-clock-audiobook.mp3");
    expect(audiobookFileName("¿?")).toBe("book-audiobook.mp3");
  });
});
