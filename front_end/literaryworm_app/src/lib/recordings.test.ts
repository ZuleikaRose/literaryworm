import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { playsRecording } from "./recordings";

describe("playsRecording", () => {
  it("plays an ordinary classic's recording", () => {
    expect(playsRecording(getBook("frankenstein")!)).toBe(true);
  });

  it("never plays a withdrawn recording, but the book keeps its chapters and text", () => {
    const book = getBook("the-metamorphosis")!;
    expect(book.recording?.withdrawn).toBeTruthy();
    expect(playsRecording(book)).toBe(false);
    expect(book.chapters).toHaveLength(3);
    expect(book.narrator).toBeUndefined();
  });

  it("has nothing to play without a recording", () => {
    expect(playsRecording({})).toBe(false);
  });
});
