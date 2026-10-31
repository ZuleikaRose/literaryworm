// deno test supabase/functions/_shared/googleBooks_test.ts
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { googleKeys, KEY_SECRETS } from "./googleBooks.ts";

Deno.test("googleKeys lists the set keys in order, main first, without blanks or repeats", () => {
  const env: Record<string, string> = {
    GOOGLE_BOOKS_API_KEY: "main",
    GOOGLE_BOOKS_API_KEY_1_AMILLAGE: " ",
    GOOGLE_BOOKS_API_KEY_1_ALICEMILLAGE: "spare",
  };
  assertEquals(googleKeys((n) => env[n]), ["main", "spare"]);
  assertEquals(googleKeys((n) => (n === KEY_SECRETS[0] ? undefined : "same")), ["same"]);
  assertEquals(googleKeys(() => undefined), [undefined]);
});
