"use strict";
const format = require("../lib/format");

describe("formatting", () => {
  it("writes minutes as hours and minutes", () => {
    expect(format.duration(0)).toBe("0 min");
    expect(format.duration(45)).toBe("45 min");
    expect(format.duration(120)).toBe("2 h");
    expect(format.duration(125)).toBe("2 h 5 min");
  });

  it("drops control characters, so text from the server can't drive the terminal", () => {
    expect(format.safe("Dune\u001b[2J\u001b]0;x\u0007 ok\n")).toBe("Dune[2J]0;x ok\n");
    expect(format.oneLine("a\n\n b   c")).toBe("a b c");
    expect(format.oneLine("x".repeat(200), 10)).toBe(`${"x".repeat(9)}…`);
  });

  it("lists the library with status, place and where a book is from", () => {
    const text = format.library({
      books: [
        { id: "dracula", title: "Dracula", author: "Bram Stoker", source: "literaryworm", status: "reading", addedAt: "2026-11-01T10:00:00Z", progress: { format: "ebook", percent: 40, finished: false } },
        { id: "u-1", title: "Mine", author: null, source: "upload", status: "finished", addedAt: "2026-10-01T10:00:00Z", progress: { format: "ebook", percent: 100, finished: true } },
        { id: "zyTCAlFPjgYC", title: null, author: null, source: "google_books", status: "want_to_read", addedAt: "2026-09-01T10:00:00Z", progress: null },
      ],
    });
    expect(text).toContain("Dracula — Bram Stoker\n  Reading, 40% through the ebook · added 2026-11-01");
    expect(text).toContain("Mine [your upload]\n  Finished, finished · added 2026-10-01");
    expect(text).toContain("A Google Books title (zyTCAlFPjgYC)\n  Want to read · added 2026-09-01");
    expect(format.library({ books: [] })).toBe("No books here yet.");
  });

  it("shows highlights with their notes, and reading time per profile", () => {
    expect(format.highlights({ highlights: [{ bookId: "dracula", bookTitle: "Dracula", chapter: 2, quote: "Welcome", note: "Line", createdAt: "2026-11-02T00:00:00Z" }] })).toBe("Dracula, chapter 2 (2026-11-02)\n  “Welcome”\n  Note: Line");
    expect(format.highlights({ highlights: [] })).toBe("No highlights here yet.");
    const stats = format.stats({ since: "2026-11-10", days: 7, note: "Kids profiles aren't included.", profiles: [{ profile: "Avery", minutes: 90, listeningMinutes: 30, daysRead: 1, booksFinished: 2 }] });
    expect(stats).toContain("Avery: 1 h 30 min (30 min listening), 1 day read, 2 books finished");
    expect(format.stats({ since: "2026-11-10", days: 1, note: "", profiles: [] })).toContain("No grown-up or teen profiles yet.");
  });

  it("prints plans, catalog books and how to add the MCP address", () => {
    const pricing = format.pricing({ plans: [{ name: "Premium", monthly: "60.00 USD", yearly: "600.00 USD", profiles: 12, audiobookHoursAMonth: "unlimited", offlineDevices: 24, summary: "Everything." }], note: "7 days free.", url: "https://www.literaryworm.com/pricing" });
    expect(pricing).toContain("Premium: 60.00 USD a month or 600.00 USD a year\n  12 profiles, unlimited audiobook hours, 24 offline devices");
    expect(format.search({ books: [] })).toMatch(/No catalog books/);
    expect(format.search({ books: [{ id: "emma", title: "Emma", author: "Jane Austen", year: 1815, url: "u" }] })).toBe("Emma — Jane Austen (1815)\n  emma  u");
    expect(format.whatsNew({ entries: [{ releasedOn: "2026-11-16", major: true, kind: "feature", title: "T", body: "B" }], url: "u" })).toContain("2026-11-16  Major feature: T");
    expect(format.mcp("https://www.literaryworm.com/mcp")).toContain("claude mcp add --transport http literaryworm https://www.literaryworm.com/mcp");
  });
});
