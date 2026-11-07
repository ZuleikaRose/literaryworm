import { describe, expect, it } from "@jest/globals";
import { charactersAt, findPauses, pauseAnchors, secondsAt } from "./pauseTiming";

const RATE = 1000;

/** A test signal: speech (a tone) and quiet, as [seconds, loud] stretches. */
function signal(stretches: [number, boolean][]): Float32Array {
  const out: number[] = [];
  for (const [seconds, loud] of stretches) {
    for (let i = 0; i < seconds * RATE; i++) out.push(loud ? 0.3 * Math.sin(i / 3) : 0.001);
  }
  return Float32Array.from(out);
}

describe("timing a natural voice by its pauses", () => {
  it("finds the quiet stretches between sentences, not the short gaps inside them", () => {
    const pauses = findPauses(signal([[2, true], [0.4, false], [3, true], [0.05, false], [1, true], [0.5, false], [2, true]]), RATE);
    // 2 s speech, 0.4 s pause, 3 s speech, a 0.05 s gap, 1 s speech, then a 0.5 s pause from 6.45 s.
    expect(pauses).toHaveLength(2);
    const expected = [[2, 2.4], [6.45, 6.95]];
    pauses.forEach(([start, end], i) => {
      expect(Math.abs(start - expected[i][0])).toBeLessThanOrEqual(0.02);
      expect(Math.abs(end - expected[i][1])).toBeLessThanOrEqual(0.02);
    });
  });

  it("finds no pauses in an empty part, or one that's all speech, and none it can't see end", () => {
    expect(findPauses(new Float32Array(0), RATE)).toEqual([]);
    expect(findPauses(signal([[3, true]]), RATE)).toEqual([]);
    // Quiet to the very end isn't a pause between sentences.
    expect(findPauses(signal([[3, false]]), RATE)).toEqual([]);
  });

  it("keeps only the part's start and end when there are no breaks or no pauses", () => {
    expect(pauseAnchors([], 300, 30, [[10, 10.5]])).toEqual([[0, 0], [300, 30]]);
    expect(pauseAnchors([100, 200], 300, 30, [])).toEqual([[0, 0], [300, 30]]);
    // Breaks outside the part are ignored.
    expect(pauseAnchors([0, 300, 400], 300, 30, [[10, 10.5]])).toEqual([[0, 0], [300, 30]]);
  });

  it("puts each sentence start at the end of the nearest pause, and skips a break with none near", () => {
    // 300 characters over 30 seconds; sentences start at 100 and 200 (expected near 10 s and 20 s).
    const anchors = pauseAnchors([100, 200], 300, 30, [[11, 11.6], [24.5, 25]]);
    expect(anchors).toEqual([[0, 0], [100, 11.6], [300, 30]]);
    expect(pauseAnchors([100, 200], 300, 30, [[9, 9.5], [19.2, 19.8]])).toEqual([[0, 0], [100, 9.5], [200, 19.8], [300, 30]]);
  });

  it("never uses a pause twice or goes backwards", () => {
    expect(pauseAnchors([100, 110], 300, 30, [[10, 10.5]])).toEqual([[0, 0], [100, 10.5], [300, 30]]);
  });

  it("turns seconds into characters and back between the anchors", () => {
    const anchors: [number, number][] = [[0, 0], [100, 12], [300, 30]];
    expect(charactersAt(anchors, 6)).toBe(50);
    expect(charactersAt(anchors, 21)).toBe(200);
    expect(charactersAt(anchors, 99)).toBe(300);
    expect(secondsAt(anchors, 50)).toBe(6);
    expect(secondsAt(anchors, 200)).toBe(21);
    expect(secondsAt(anchors, 300)).toBe(30);
    // Before the start and past the end stay at the edges.
    expect(charactersAt(anchors, -5)).toBe(0);
    expect(secondsAt(anchors, -5)).toBe(0);
    expect(secondsAt(anchors, 999)).toBe(30);
  });
});
