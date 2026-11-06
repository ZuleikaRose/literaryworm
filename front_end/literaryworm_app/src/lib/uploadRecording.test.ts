import { describe, expect, it } from "@jest/globals";
import { books } from "../data/books";
import { mainTitle, recordingFor, surnames } from "./uploadRecording";

describe("a LibriVox recording for an uploaded book", () => {
  it("compares titles without subtitles, bracketed notes or a leading article", () => {
    expect(mainTitle("Frankenstein; Or, The Modern Prometheus")).toBe("frankenstein");
    expect(mainTitle("Frankenstein, or the Modern Prometheus")).toBe("frankenstein");
    expect(mainTitle("Emma: A Novel")).toBe("emma");
    expect(mainTitle("The Adventures of Sherlock Holmes [Illustrated]")).toBe("adventures of sherlock holmes");
    expect(mainTitle("The Tide Clock (The Lantern Coast, #1)")).toBe("tide clock");
    expect(mainTitle("Alice’s Adventures in Wonderland")).toBe("alice s adventures in wonderland");
  });

  it("reads surnames however the author line is written", () => {
    expect(surnames("Mary Shelley")).toEqual(["shelley"]);
    expect(surnames("Shelley, Mary Wollstonecraft")).toEqual(["shelley"]);
    expect(surnames("Doyle, Arthur Conan")).toEqual(["doyle"]);
    expect(surnames("Martin Luther King, Jr.")).toEqual(["king"]);
    expect(surnames("Charlotte Brontë & Emily Brontë")).toEqual(["bronte", "bronte"]);
    expect(surnames("")).toEqual([]);
    expect(surnames("  ")).toEqual([]);
  });

  it("finds the catalog's recorded title from a Project Gutenberg EPUB's title and author", () => {
    expect(recordingFor({ title: "Frankenstein; Or, The Modern Prometheus", author: "Shelley, Mary Wollstonecraft" }, "all")?.id).toBe("frankenstein");
    expect(recordingFor({ title: "Adventures of Sherlock Holmes", author: "Doyle, Arthur Conan" }, "all")?.id).toBe("sherlock-holmes");
    expect(recordingFor({ title: "Pride and Prejudice", author: "Jane Austen" }, "kids")?.id).toBe("pride-and-prejudice");
    expect(recordingFor({ title: "PRIDE AND PREJUDICE", author: "AUSTEN, JANE" }, "all")?.recording).toBeTruthy();
  });

  it("needs the author's surname, not just the title", () => {
    expect(recordingFor({ title: "Emma", author: "" }, "all")).toBeNull();
    expect(recordingFor({ title: "Emma", author: "Someone Else" }, "all")).toBeNull();
    expect(recordingFor({ title: "Emma", author: "Austen, Jane" }, "all")?.id).toBe("emma");
  });

  it("isn't fooled by a longer title or a different book", () => {
    expect(recordingFor({ title: "Frankenstein Returns", author: "Mary Shelley" }, "all")).toBeNull();
    expect(recordingFor({ title: "The Tide Clock (The Lantern Coast, #1)", author: "Wren Okafor" }, "all")).toBeNull();
  });

  it("offers only titles the profile may see", () => {
    // Frankenstein is rated for teens and up.
    expect(recordingFor({ title: "Frankenstein", author: "Mary Shelley" }, "kids")).toBeNull();
    expect(recordingFor({ title: "Frankenstein", author: "Mary Shelley" }, "teen")?.id).toBe("frankenstein");
  });

  it("only ever returns titles that have a recording", () => {
    const unrecorded = books.find((b) => !b.recording)!;
    expect(recordingFor({ title: unrecorded.title, author: unrecorded.author }, "all")).toBeNull();
  });
});
