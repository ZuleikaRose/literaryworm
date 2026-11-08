import { describe, expect, it } from "@jest/globals";
import { playerContinueUrl, readAt, readerContinueUrl } from "./continueLink";

describe("continue on another device", () => {
  it("links the reader's chapter and page, and the player's seconds", () => {
    expect(readerContinueUrl("frankenstein", 3, 12.7)).toBe("https://www.literaryworm.com/read/frankenstein?chapter=3&page=12");
    expect(playerContinueUrl("u-abc", 125.9)).toBe("https://www.literaryworm.com/listen/u-abc?at=125");
    expect(playerContinueUrl("x y", -4)).toBe("https://www.literaryworm.com/listen/x%20y?at=0");
  });

  it("reads ?at= only as whole seconds inside the book", () => {
    expect(readAt("90", 600)).toBe(90);
    expect(readAt("9000", 600)).toBe(600);
    expect(readAt("-3", 600)).toBeNull();
    expect(readAt("1e9", 600)).toBeNull();
    expect(readAt(null, 600)).toBeNull();
  });
});
