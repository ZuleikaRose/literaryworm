import { describe, expect, it } from "@jest/globals";
import { matchingAuthors, personInitials } from "./people";

describe("an author search's authors", () => {
  it("lists the authors whose names match, most books first", () => {
    const lists = [["Mary Shelley"], ["Mary Shelley", "Percy Bysshe Shelley"], ["Percy Bysshe Shelley"], ["Mary Shelley"], ["Someone Else"]];
    expect(matchingAuthors(lists, "shelley")).toEqual([
      { name: "Mary Shelley", books: 3 },
      { name: "Percy Bysshe Shelley", books: 2 },
    ]);
  });

  it("needs every word, and counts a co-author once per book", () => {
    expect(matchingAuthors([["Mary Shelley", "Mary Shelley"], ["Percy Bysshe Shelley"]], "mary shelley")).toEqual([{ name: "Mary Shelley", books: 1 }]);
  });

  it("counts the same name in different cases once, and keeps to the limit", () => {
    expect(matchingAuthors([["ann lee"], ["Ann Lee"]], "lee")).toEqual([{ name: "ann lee", books: 2 }]);
    expect(matchingAuthors([["J. R. R. Tolkien"], ["J.R.R. Tolkien"], ["Christopher Tolkien"]], "tolkien")).toEqual([
      { name: "J. R. R. Tolkien", books: 2 },
      { name: "Christopher Tolkien", books: 1 },
    ]);
    const many = Array.from({ length: 10 }, (_, i) => [`Writer ${String.fromCharCode(65 + i)} Smith`]);
    expect(matchingAuthors(many, "smith", 6)).toHaveLength(6);
  });

  it("leaves out names a page address couldn't hold", () => {
    expect(matchingAuthors([["Anon: Smith"]], "smith")).toEqual([]);
  });
});

describe("an author's initials", () => {
  it("takes the first two words' first letters", () => {
    expect(personInitials("Ursula K. Le Guin")).toBe("UK");
  });
});
