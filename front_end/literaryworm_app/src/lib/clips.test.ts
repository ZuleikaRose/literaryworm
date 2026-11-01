import { describe, expect, it } from "@jest/globals";
import { clipAt, clipPath, clipTime, readClip } from "./clips";

describe("clips", () => {
  it("takes the seconds just heard", () => {
    expect(clipAt(2, 125.4, 30, 600)).toEqual({ chapterIndex: 2, start: 95, end: 125 });
    expect(clipAt(0, 20, 30, 600)).toEqual({ chapterIndex: 0, start: 0, end: 20 });
  });

  it("takes the seconds ahead at the very start of a chapter, within the track", () => {
    expect(clipAt(1, 2, 15, 600)).toEqual({ chapterIndex: 1, start: 2, end: 17 });
    expect(clipAt(1, 0, 60, 40)).toEqual({ chapterIndex: 1, start: 0, end: 40 });
  });

  it("writes and reads the address", () => {
    const path = clipPath("pride-and-prejudice", { chapterIndex: 3, start: 95, end: 125 });
    expect(path).toBe("/clips/pride-and-prejudice?c=3&s=95&e=125");
    expect(readClip(new URLSearchParams(path.split("?")[1]), [600, 600, 600, 600])).toEqual({ chapterIndex: 3, start: 95, end: 125 });
  });

  it("refuses clips that are too short, too long, past the track or not numbers", () => {
    const tracks = [600, 120];
    const read = (q: string) => readClip(new URLSearchParams(q), tracks);
    expect(read("c=0&s=10&e=12")).toBeNull();
    expect(read("c=0&s=10&e=100")).toBeNull();
    expect(read("c=1&s=100&e=130")).toBeNull();
    expect(read("c=2&s=0&e=30")).toBeNull();
    expect(read("c=0&s=-5&e=20")).toBeNull();
    expect(read("c=0&s=1e2&e=130")).toBeNull();
    expect(read("c=0&s=10")).toBeNull();
    expect(read("c=1&s=90&e=120")).toEqual({ chapterIndex: 1, start: 90, end: 120 });
  });

  it("writes times", () => {
    expect([0, 5, 75, 3725].map(clipTime)).toEqual(["0:00", "0:05", "1:15", "1:02:05"]);
  });
});
