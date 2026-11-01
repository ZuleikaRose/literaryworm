import { describe, expect, it } from "@jest/globals";
import { FOCUS_LINES, guideBand, lineAt, stepLine, type TextBox } from "./readingGuide";

// Ten lines of 30px from 100px down: lines start at 100, 130, … 370.
const box: TextBox = { top: 100, height: 300, lineHeight: 30 };

describe("lineAt", () => {
  it("finds the line under a point", () => {
    expect(lineAt(100, box)).toBe(100);
    expect(lineAt(129, box)).toBe(100);
    expect(lineAt(130, box)).toBe(130);
    expect(lineAt(255, box)).toBe(250);
  });

  it("keeps to the first and last lines above and below the text", () => {
    expect(lineAt(-50, box)).toBe(100);
    expect(lineAt(399, box)).toBe(370);
    expect(lineAt(5000, box)).toBe(370);
  });

  it("stays at the top for text with no height or no line height", () => {
    expect(lineAt(250, { ...box, height: 0 })).toBe(100);
    expect(lineAt(250, { ...box, lineHeight: 0 })).toBe(100);
    expect(lineAt(250, { ...box, lineHeight: Number.NaN })).toBe(100);
  });
});

describe("stepLine", () => {
  it("moves a line at a time and stops at either end", () => {
    expect(stepLine(100, 1, box)).toBe(130);
    expect(stepLine(130, -1, box)).toBe(100);
    expect(stepLine(100, -1, box)).toBe(100);
    expect(stepLine(370, 1, box)).toBe(370);
  });
});

describe("guideBand", () => {
  it("is the line itself for the ruler", () => {
    expect(guideBand("ruler", 160, box)).toEqual({ top: 160, height: 30 });
  });

  it("is a window of lines with the line in the middle for line focus", () => {
    expect(guideBand("focus", 160, box)).toEqual({ top: 160 - 30 * Math.floor(FOCUS_LINES / 2), height: 30 * FOCUS_LINES });
  });
});

describe("guideBand at the edges", () => {
  it("lets line focus's window run past the first and last lines (the dimming covers the rest)", () => {
    expect(guideBand("focus", box.top, box).top).toBe(box.top - 30);
    const last = lineAt(10_000, box);
    const band = guideBand("focus", last, box);
    expect(band.top + band.height).toBe(last + 2 * 30);
  });

  it("follows a missing or non-number position to the first line", () => {
    expect(lineAt(Number.NaN, box)).toBe(100);
    expect(lineAt(undefined as unknown as number, box)).toBe(100);
  });
});
