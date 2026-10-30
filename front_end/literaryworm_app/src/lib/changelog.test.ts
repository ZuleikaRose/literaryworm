import { describe, expect, it } from "@jest/globals";
import { builtInEntries, type ChangeEntry, dayLabel, entryError, filterEntries, groupReleases, releaseLabel, sortEntries, versionFor } from "./changelog";

const entry = (over: Partial<ChangeEntry>): ChangeEntry => ({
  id: null,
  releasedOn: "2026-10-30",
  version: "2026.10",
  kind: "feature",
  title: "A change",
  body: "What changed.",
  major: false,
  ...over,
});

describe("the built-in copy", () => {
  it("is every entry the seed migration has, each one valid", () => {
    expect(builtInEntries.length).toBeGreaterThan(0);
    for (const e of builtInEntries) expect(entryError(e)).toBeNull();
    expect(builtInEntries.some((e) => e.major)).toBe(true);
  });
});

describe("ordering and grouping", () => {
  const entries = [
    entry({ title: "Old", releasedOn: "2026-09-02", version: "2026.9" }),
    entry({ title: "Minor", releasedOn: "2026-10-29" }),
    entry({ title: "Major", releasedOn: "2026-10-29", major: true }),
    entry({ title: "Newest", releasedOn: "2026-10-30" }),
  ];

  it("puts the newest first, keeping the written order within a day", () => {
    expect(sortEntries(entries).map((e) => e.title)).toEqual(["Newest", "Minor", "Major", "Old"]);
  });

  it("groups by version, newest release first, with major changes leading", () => {
    const releases = groupReleases(entries);
    expect(releases.map((r) => [r.version, r.releasedOn])).toEqual([
      ["2026.10", "2026-10-30"],
      ["2026.9", "2026-09-02"],
    ]);
    expect(releases[0].entries.map((e) => e.title)).toEqual(["Major", "Newest", "Minor"]);
    expect(groupReleases([])).toEqual([]);
  });

  it("filters by kind or to the major changes", () => {
    const mixed = [entry({ kind: "fix" }), entry({ kind: "update", major: true }), entry({ kind: "feature" })];
    expect(filterEntries(mixed, "all")).toHaveLength(3);
    expect(filterEntries(mixed, "fix").map((e) => e.kind)).toEqual(["fix"]);
    expect(filterEntries(mixed, "major").map((e) => e.kind)).toEqual(["update"]);
  });
});

describe("words", () => {
  it("names releases and days", () => {
    expect(releaseLabel("2026-10-30")).toBe("October 2026");
    expect(dayLabel("2026-10-03")).toBe("3 October 2026");
    expect(versionFor("2026-10-30")).toBe("2026.10");
    expect(versionFor("2027-01-05")).toBe("2027.1");
  });
});

describe("entryError", () => {
  const ok = entry({});
  it("takes a sound entry", () => {
    expect(entryError(ok)).toBeNull();
    expect(entryError({ ...ok, version: "2026.10.2" })).toBeNull();
  });

  it("checks the date, version and kind", () => {
    expect(entryError({ ...ok, releasedOn: "" })).toMatch(/day it was released/);
    expect(entryError({ ...ok, releasedOn: "2026-13-45" })).toMatch(/day it was released/);
    expect(entryError({ ...ok, version: "v2" })).toMatch(/2026\.10/);
    expect(entryError({ ...ok, kind: "news" as never })).toMatch(/feature, update or fix/);
  });

  it("asks for a title and a body within the limits", () => {
    expect(entryError({ ...ok, title: "  " })).toMatch(/title/);
    expect(entryError({ ...ok, title: "x".repeat(121) })).toMatch(/120/);
    expect(entryError({ ...ok, body: "" })).toMatch(/what changed/);
    expect(entryError({ ...ok, body: "x".repeat(1001) })).toMatch(/1000/);
  });
});
