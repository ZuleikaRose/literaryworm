// deno test supabase/functions/_shared/googleBooks_test.ts
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import { fitsGenre, GENRE_HEADINGS, googleKeys, KEY_SECRETS } from "./googleBooks.ts";
import { GENRES } from "./validate.ts";

Deno.test("googleKeys lists the set keys in order, main first, without blanks or repeats", () => {
  const env: Record<string, string> = {
    GOOGLE_BOOKS_API_KEY: "main",
    GOOGLE_BOOKS_API_KEY_1_AMILLAGE: " ",
    GOOGLE_BOOKS_API_KEY_1_ALICEMILLAGE: "spare",
  };
  assertEquals(googleKeys((n) => env[n]), ["main", "spare"]);
  assertEquals(googleKeys((n) => (n === KEY_SECRETS[0] ? undefined : "same")), ["same"]);
  assertEquals(googleKeys(() => undefined), [undefined]);
  // All six, in KEY_SECRETS order.
  assertEquals(googleKeys((n) => `k${KEY_SECRETS.indexOf(n as typeof KEY_SECRETS[number])}`), ["k0", "k1", "k2", "k3", "k4", "k5"]);
});

Deno.test("a book fits a BISAC genre by its categories' top-level heading", () => {
  const book = (categories: string[]) => ({ categories });
  assert(fitsGenre(book(["Cooking / Regional & Ethnic / Italian"]), "cooking"));
  assert(fitsGenre(book(["COOKING"]), "cooking"));
  assertFalse(fitsGenre(book(["Fiction / Cooking"]), "cooking"));
  assert(fitsGenre(book(["House & Home / Decorating"]), "house-home"));
  assertFalse(fitsGenre(book(["Fiction / Literary"]), "house-home"));
  // No categories: nothing says it doesn't fit. The first twenty genres aren't checked.
  assert(fitsGenre(book([]), "cooking"));
  assert(fitsGenre(book(["Juvenile Fiction"]), "adventure"));
  // Every BISAC genre has a heading to check, and the first twenty have none.
  assertEquals(Object.keys(GENRE_HEADINGS).length, GENRES.length - 20);
});
