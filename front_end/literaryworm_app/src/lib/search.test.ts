import { describe, expect, it } from "@jest/globals";
import { browseGenres, favouriteGenreId, favouriteGenreLabel, genreForCategories, inFavouriteGenre } from "../data/genres";
import { catalogMatches, cleanIsbn, didYouMean, fitsLength, normalizeQuery, queryError, readSearchParams, searchUrl, unfiltered } from "./search";

describe("queries", () => {
  it("tidies spaces", () => {
    expect(normalizeQuery("  the   midnight\tlibrary ")).toBe("the midnight library");
  });

  it("checks queries with the books function's rules", () => {
    expect(queryError("")).toMatch(/Enter a title/);
    expect(queryError("x".repeat(101))).toMatch(/limited to 100/);
    expect(queryError("<script>")).toMatch(/letters, numbers/);
    expect(queryError("Pride & Prejudice")).toBeNull();
    expect(queryError("Cien años de soledad")).toBeNull();
  });
});

describe("the URL", () => {
  it("round-trips a search", () => {
    const params = { q: "dune", by: "title", genre: null, sort: "newest", source: "google", lang: "es", length: "long" } as const;
    const url = searchUrl(params);
    expect(url).toBe("/search?q=dune&sort=newest&source=google&lang=es&length=long");
    expect(readSearchParams(new URLSearchParams(url.split("?")[1]))).toEqual(params);
  });

  it("falls back to defaults for anything unexpected", () => {
    expect(readSearchParams(new URLSearchParams("sort=popular&source=x&lang=zz&length=huge&genre=nope"))).toEqual({
      q: "",
      by: "title",
      genre: null,
      sort: "relevance",
      source: "all",
      lang: null,
      length: null,
    });
    expect(searchUrl(readSearchParams(new URLSearchParams()))).toBe("/search");
  });
});

describe("fitsLength", () => {
  it("never fits an unknown length to a filter", () => {
    expect(fitsLength(null, "short")).toBe(false);
    expect(fitsLength(null, null)).toBe(true);
  });

  it("includes each band's edges", () => {
    expect(fitsLength(199, "short")).toBe(true);
    expect(fitsLength(200, "medium")).toBe(true);
    expect(fitsLength(400, "medium")).toBe(true);
    expect(fitsLength(401, "long")).toBe(true);
  });
});

describe("catalog search", () => {
  const base = { by: "title", genre: null, sort: "relevance", source: "all", lang: null, length: null } as const;

  it("matches word starts in the title, ignoring case", () => {
    expect(catalogMatches({ ...base, q: "MIDN libr" }, "all").map((b) => b.id)).toEqual(["the-midnight-library"]);
  });

  it("hides titles above the profile's age rating", () => {
    expect(catalogMatches({ ...base, q: "dracula" }, "all")).toHaveLength(1);
    expect(catalogMatches({ ...base, q: "dracula" }, "kids")).toHaveLength(0);
  });

  it("suggests a likely typo only when the correction finds something", () => {
    expect(didYouMean("midnite libary", "all")).toBe("Midnight Library");
    expect(didYouMean("zzzzzz qqqqq", "all")).toBeNull();
  });
});

describe("genres", () => {
  it("keeps the brief's six as Home rows, first, and offers the rest to browse and search", () => {
    expect(browseGenres.filter((g) => g.shelf).map((g) => g.id)).toEqual(["technology", "adventure", "sci-fi", "fiction", "non-fiction", "horror"]);
    expect(browseGenres.slice(0, 6).every((g) => g.shelf)).toBe(true);
    expect(browseGenres.length).toBeGreaterThan(6);
    expect(new Set(browseGenres.map((g) => g.id)).size).toBe(browseGenres.length);
  });

  it("reads a new genre from the URL and narrows the sample catalog by it", () => {
    expect(readSearchParams(new URLSearchParams("q=a&genre=fantasy")).genre).toBe("fantasy");
    expect(readSearchParams(new URLSearchParams("q=a&genre=westerns")).genre).toBeNull();
    const fantasy = catalogMatches({ ...readSearchParams(new URLSearchParams("q=wonder&genre=fantasy")) }, "all");
    expect(fantasy.length).toBeGreaterThan(0);
    expect(fantasy.every((b) => b.genres.some((g) => g === "Fantasy" || g === "Mythology"))).toBe(true);
  });

  it("finds the closest genre for a Google title's categories", () => {
    expect(genreForCategories(["Juvenile Fiction / Fantasy & Magic"])).toBe("children");
    expect(genreForCategories(["Young Adult Fiction / Romance"])).toBe("young-adult");
    expect(genreForCategories(["Fiction / Science Fiction / General"])).toBe("sci-fi");
    expect(genreForCategories(["Fiction / Fantasy / Epic"])).toBe("fantasy");
    expect(genreForCategories(["Fiction / Thrillers / Suspense"])).toBe("thriller");
    expect(genreForCategories(["Fiction / Mystery & Detective"])).toBe("mystery");
    expect(genreForCategories(["Fiction / Historical / General"])).toBe("historical-fiction");
    expect(genreForCategories(["Biography & Autobiography / Personal Memoirs"])).toBe("biography");
    expect(genreForCategories(["Computers / Programming"])).toBe("technology");
    expect(genreForCategories(["Self-Help / Personal Growth"])).toBe("self-help");
    expect(genreForCategories(["Cooking"])).toBe("non-fiction");
    expect(genreForCategories([])).toBeNull();
  });

  it("turns favourites saved from the old list into browse genres", () => {
    expect(favouriteGenreLabel("Fantasy")).toBe("Fantasy");
    expect(favouriteGenreLabel("sci-fi")).toBe("Sci-Fi");
    expect(favouriteGenreLabel("Science fiction")).toBe("Sci-Fi");
    expect(favouriteGenreLabel("Memoir")).toBe("Biography & Memoir");
    expect(favouriteGenreLabel("Self-development")).toBe("Self-Help");
    expect(favouriteGenreLabel("Young adult")).toBe("Young Adult");
    expect(favouriteGenreLabel("Literary fiction")).toBe("Fiction");
    expect(favouriteGenreLabel("Westerns")).toBeNull();
    expect(favouriteGenreId("Historical Fiction")).toBe("historical-fiction");
  });

  it("matches a book to a favourite genre through the catalog's own genres", () => {
    expect(inFavouriteGenre(["Science fiction"], "Sci-Fi")).toBe(true);
    expect(inFavouriteGenre(["Mythology", "Fantasy"], "Fantasy")).toBe(true);
    expect(inFavouriteGenre(["Memoir"], "Biography & Memoir")).toBe(true);
    expect(inFavouriteGenre(["Horror"], "Romance")).toBe(false);
    expect(inFavouriteGenre(["Westerns"], "Westerns")).toBe(true);
  });
});

describe("search by author", () => {
  it("keeps by=author in the address, and drops the filters an author search doesn't have", () => {
    const read = readSearchParams(new URLSearchParams("q=tolkien&by=author&genre=fantasy&lang=es&sort=newest&length=long"));
    expect(read).toEqual({ q: "tolkien", by: "author", genre: null, sort: "relevance", source: "all", lang: null, length: "long" });
    expect(searchUrl(read)).toBe("/search?q=tolkien&by=author&length=long");
    expect(readSearchParams(new URLSearchParams("q=x&by=publisher")).by).toBe("title");
  });

  it("matches the catalog's authors by every word, from the start of a word", () => {
    const found = (q: string) => catalogMatches({ ...unfiltered(q, "author") }, "all").map((b) => b.author);
    expect(found("shelley").every((a) => /shelley/i.test(a))).toBe(true);
    expect(found("shelley").length).toBeGreaterThan(0);
    expect(found("mary shel")).toEqual(found("shelley").filter((a) => /mary/i.test(a)));
    expect(found("helley")).toEqual([]);
    // A title word isn't an author.
    expect(found("frankenstein")).toEqual([]);
  });

  it("words its errors for a name", () => {
    expect(queryError("", "author")).toBe("Enter an author's name to search for.");
    expect(queryError("a<b", "author")).toBe("Search by author using letters, numbers and basic punctuation.");
  });
});

describe("search by ISBN", () => {
  it("accepts ISBN-10 and ISBN-13 with a right check digit, as digits", () => {
    expect(cleanIsbn("978-0-14-143951-8")).toBe("9780141439518");
    expect(cleanIsbn("0 19 852663 6")).toBe("0198526636");
    expect(cleanIsbn("080442957x")).toBe("080442957X");
    expect(cleanIsbn("9780141439519")).toBeNull();
    expect(cleanIsbn("0198526637")).toBeNull();
    expect(cleanIsbn("1234567890123")).toBeNull(); // not 978 or 979
    expect(cleanIsbn("97801414395X8")).toBeNull();
  });

  it("explains what's wrong with an ISBN", () => {
    expect(queryError("", "isbn")).toBe("Enter an ISBN to search for.");
    expect(queryError("the hobbit", "isbn")).toMatch(/made of digits/);
    expect(queryError("978-0-14", "isbn")).toBe("An ISBN has 10 or 13 digits. This one has 6.");
    expect(queryError("9780141439519", "isbn")).toMatch(/doesn't add up/);
    expect(queryError("978-0-14-143951-8", "isbn")).toBeNull();
  });

  it("keeps by=isbn in the address with no filters, and never matches the catalog", () => {
    const read = readSearchParams(new URLSearchParams("q=978-0-14-143951-8&by=isbn&genre=fantasy&length=long&source=literaryworm"));
    expect(read).toEqual({ q: "9780141439518", by: "isbn", genre: null, sort: "relevance", source: "google", lang: null, length: null });
    expect(searchUrl(read)).toBe("/search?q=9780141439518&by=isbn");
    expect(catalogMatches(read, "all")).toEqual([]);
  });
});
