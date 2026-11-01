import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import type { UploadedBook } from "../types";
import { clubBook, clubBookTitle, copyChoices, isUploadClub, matchesBook } from "./clubs";

const upload = (id: string, title: string, author: string): UploadedBook => ({
  id: `u-${id.padEnd(32, "0")}`,
  title,
  author,
  chapterTitles: ["One", "Two"],
  chapterWords: [1000, 1200],
  words: 2200,
  path: null,
  createdAt: Date.UTC(2026, 10, 1),
});

const mine = upload("a1", "The Bought Novel", "A. Writer");
const other = upload("b2", "Another Story", "B. Author");
const uploadClub = { bookId: upload("ff", "The Bought Novel", "A. Writer").id, bookTitle: "The Bought Novel", bookAuthor: "A. Writer" };

describe("a club's book", () => {
  it("is the catalog title for a LiteraryWorm club", () => {
    const club = { bookId: "frankenstein", myCopy: null };
    expect(isUploadClub(club)).toBe(false);
    expect(clubBook(club, [mine], getBook)?.id).toBe("frankenstein");
    expect(clubBookTitle(club, getBook)).toBe(getBook("frankenstein")?.title);
  });

  it("is the reader's own linked copy for an uploaded book, never someone else's", () => {
    expect(isUploadClub(uploadClub)).toBe(true);
    expect(clubBook({ ...uploadClub, myCopy: null }, [mine], getBook)).toBeUndefined();
    const book = clubBook({ ...uploadClub, myCopy: mine.id }, [mine, other], getBook);
    expect(book?.id).toBe(mine.id);
    expect(book?.chapters).toHaveLength(2);
    // A copy that isn't on this profile can't be opened here.
    expect(clubBook({ ...uploadClub, myCopy: mine.id }, [other], getBook)).toBeUndefined();
    expect(clubBookTitle(uploadClub, getBook)).toBe("The Bought Novel");
  });
});

describe("finding a book", () => {
  it("matches every word of the search in the title or author, ignoring case and accents", () => {
    expect(matchesBook({ title: "Madame Bovary", author: "Gustave Flaubert" }, "bovary flau")).toBe(true);
    expect(matchesBook({ title: "Les Misérables", author: "Victor Hugo" }, "miserables")).toBe(true);
    expect(matchesBook({ title: "Madame Bovary", author: "Gustave Flaubert" }, "hugo")).toBe(false);
    expect(matchesBook({ title: "Anything", author: "" }, "  ")).toBe(true);
  });

  it("offers copies with the club book's title and author first, then the rest A–Z", () => {
    const sameTitle = upload("c3", "the bought novel", "Someone Else");
    expect(copyChoices([other, sameTitle, mine], uploadClub).map((u) => u.id)).toEqual([mine.id, sameTitle.id, other.id]);
    expect(copyChoices([other, sameTitle, mine], uploadClub, "author").map((u) => u.id)).toEqual([other.id]);
  });
});
