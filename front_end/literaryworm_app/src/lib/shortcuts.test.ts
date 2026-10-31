import { describe, expect, it } from "@jest/globals";
import { READER_SHORTCUTS, readerAction } from "./shortcuts";

const press = (key: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) =>
  readerAction({ key, altKey: false, ctrlKey: false, metaKey: false, ...mods });

describe("readerAction", () => {
  it("turns pages with the arrows and Page Up and Down", () => {
    expect(press("ArrowRight")).toBe("next");
    expect(press("PageDown")).toBe("next");
    expect(press("ArrowLeft")).toBe("previous");
    expect(press("PageUp")).toBe("previous");
  });

  it("opens panels with letters in either case", () => {
    expect(press("c")).toBe("chapters");
    expect(press("N")).toBe("highlights");
    expect(press("b")).toBe("bookmark");
    expect(press("d")).toBe("dictionary");
    expect(press("t")).toBe("display");
    expect(press("?")).toBe("help");
  });

  it("leaves other keys and the browser's shortcuts alone", () => {
    expect(press("x")).toBeNull();
    expect(press("Enter")).toBeNull();
    expect(press("d", { ctrlKey: true })).toBeNull();
    expect(press("ArrowRight", { altKey: true })).toBeNull();
    expect(press("b", { metaKey: true })).toBeNull();
  });

  it("lists every action once in the help", () => {
    const actions = READER_SHORTCUTS.map((s) => s.action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
