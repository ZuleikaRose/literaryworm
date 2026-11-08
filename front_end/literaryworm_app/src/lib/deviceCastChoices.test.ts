import { describe, expect, it } from "@jest/globals";
import { CAST_BOOKS_MAX } from "./castChoices";
import { deviceCastKey, parseAllDeviceCastChoices, parseDeviceCastChoices, withDeviceCastChoice } from "./deviceCastChoices";
import { CAST_CHOICES_MAX } from "./naturalVoice";

describe("device voices chosen for speakers", () => {
  it("keeps lower-case speakers to voice names, and drops what isn't one", () => {
    expect(parseDeviceCastChoices({ Elizabeth: "Google UK English Female", "": "x", Darcy: 3, Jane: " " })).toEqual({ elizabeth: "Google UK English Female" });
    expect(parseDeviceCastChoices(null)).toEqual({});
    expect(parseDeviceCastChoices(["a"])).toEqual({});
    expect(parseDeviceCastChoices({ a: "v".repeat(121) })).toEqual({});
  });

  it("sets and clears one speaker's voice for one book", () => {
    const one = withDeviceCastChoice(undefined, "pride-and-prejudice", "Elizabeth", "Kate");
    expect(one).toEqual({ "pride-and-prejudice": { elizabeth: "Kate" } });
    const two = withDeviceCastChoice(one, "pride-and-prejudice", "Darcy", "Daniel");
    expect(two["pride-and-prejudice"]).toEqual({ elizabeth: "Kate", darcy: "Daniel" });
    expect(withDeviceCastChoice(two, "pride-and-prejudice", "elizabeth", null)).toEqual({ "pride-and-prejudice": { darcy: "Daniel" } });
    expect(withDeviceCastChoice(one, "pride-and-prejudice", "Elizabeth", null)).toEqual({});
  });

  it("keeps at most CAST_CHOICES_MAX speakers a book and CAST_BOOKS_MAX books, newest last", () => {
    let all = {};
    for (let i = 0; i < CAST_CHOICES_MAX + 5; i++) all = withDeviceCastChoice(all, "b", `s${i}`, "v");
    expect(Object.keys((all as Record<string, object>).b)).toHaveLength(CAST_CHOICES_MAX);
    let books = {};
    for (let i = 0; i < CAST_BOOKS_MAX + 3; i++) books = withDeviceCastChoice(books, `book-${i}`, "a", "v");
    expect(Object.keys(books)).toHaveLength(CAST_BOOKS_MAX);
    expect(Object.keys(books)).not.toContain("book-0");
  });

  it("reads every book back from the database, valid ones only", () => {
    expect(parseAllDeviceCastChoices({ frankenstein: { Victor: "Daniel" }, broken: { x: 1 }, list: [] })).toEqual({ frankenstein: { victor: "Daniel" } });
    expect(parseAllDeviceCastChoices("nope")).toEqual({});
  });

  it("gives a stable key whatever the order", () => {
    expect(deviceCastKey({ b: "2", a: "1" })).toBe("a=1,b=2");
    expect(deviceCastKey(undefined)).toBe("");
  });
});
