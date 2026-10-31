import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { addToQueue, canQueue, moveInQueue, nextQueued, removeFromQueue, UP_NEXT_MAX } from "./upNext";

describe("the queue", () => {
  it("adds once, at the end, up to the limit", () => {
    expect(addToQueue(["a"], "b")).toEqual(["a", "b"]);
    expect(addToQueue(["a", "b"], "a")).toEqual(["a", "b"]);
    const full = Array.from({ length: UP_NEXT_MAX }, (_, i) => `b${i}`);
    expect(addToQueue(full, "extra")).toHaveLength(UP_NEXT_MAX);
  });

  it("removes and moves", () => {
    expect(removeFromQueue(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(removeFromQueue([], "b")).toEqual([]);
    expect(moveInQueue(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveInQueue(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveInQueue(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveInQueue(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveInQueue(["a"], "missing", 1)).toEqual(["a"]);
  });
});

describe("what plays next", () => {
  it("skips the book playing, unknown ids and books the profile can't hear", () => {
    expect(nextQueued(["frankenstein", "pride-and-prejudice"], "all", "frankenstein")?.id).toBe("pride-and-prejudice");
    expect(nextQueued(["not-a-book", "pride-and-prejudice"], "all")?.id).toBe("pride-and-prejudice");
    expect(nextQueued(["frankenstein"], "kids")).toBeUndefined();
    expect(nextQueued([], "all")).toBeUndefined();
  });

  it("queues only catalog audiobooks", () => {
    expect(canQueue(getBook("frankenstein"))).toBe(true);
    expect(canQueue(undefined)).toBe(false);
  });
});
