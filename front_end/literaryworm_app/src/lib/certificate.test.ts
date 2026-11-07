import { describe, expect, it } from "@jest/globals";
import type { Badge } from "./achievements";
import { achievements, certificateFileName, certificatePage, certificatePdf, STREAK_CERTIFICATES } from "./certificate";

const badge = (id: string, earnedAt: number | null): Badge => ({ id, title: id, description: `Do ${id}`, target: 1, icon: "star", progress: earnedAt ? 1 : 0, earnedAt });

describe("reading certificates", () => {
  it("offers earned badges and the streak milestones reached, never ones still to come", () => {
    const list = achievements([badge("first-book", 1_000), badge("books-10", null)], { longest: 15 }, 5_000);
    expect(list.map((a) => a.id)).toEqual(["badge-first-book", "streak-7", "streak-14"]);
    expect(list[0]).toEqual({ id: "badge-first-book", what: "Do first-book", at: 1_000 });
    expect(list[1].what).toBe("Reading 7 days in a row");
    expect(achievements([], { longest: 6 })).toEqual([]);
    expect(STREAK_CERTIFICATES[0]).toBe(7);
  });

  it("draws one landscape page with the name and what was done", () => {
    const page = certificatePage("Mia", { id: "streak-7", what: "Reading 7 days in a row", at: Date.UTC(2026, 10, 7) }, "Well done!");
    expect(page).toContain("(Mia) Tj");
    expect(page).toContain("(Reading 7 days in a row) Tj");
    expect(page).toContain("(Well done!) Tj");
    const pdf = new TextDecoder().decode(certificatePdf("Mia", { id: "streak-7", what: "Reading 7 days in a row", at: null }));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/MediaBox [0 0 842 595]");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
  });

  it("names the file after the reader and the certificate", () => {
    expect(certificateFileName("Mia Rose", { id: "streak-7", what: "", at: null })).toBe("mia-rose-certificate-streak-7.pdf");
    expect(certificateFileName("Zoë", { id: "badge-first-book", what: "", at: null })).toBe("zoe-certificate-badge-first-book.pdf");
    expect(certificateFileName("???", { id: "streak-7", what: "", at: null })).toBe("reader-certificate-streak-7.pdf");
  });
});
