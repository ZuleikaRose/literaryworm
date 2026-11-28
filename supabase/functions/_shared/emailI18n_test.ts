// deno test --allow-env --allow-read supabase/functions/_shared/emailI18n_test.ts
// Every t("…") in the email builders (any email.ts that imports translator) must be in every
// dictionary, with the same {placeholders}; and the dictionaries hold nothing else.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { DICTIONARIES, emailLanguage, et } from "./emailI18n.ts";

const functionsDir = new URL("..", import.meta.url).pathname;

async function usedKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for await (const dir of Deno.readDir(functionsDir)) {
    if (!dir.isDirectory) continue;
    for await (const file of Deno.readDir(`${functionsDir}${dir.name}`)) {
      if (!file.isFile || !file.name.endsWith(".ts") || file.name.endsWith("_test.ts")) continue;
      const source = await Deno.readTextFile(`${functionsDir}${dir.name}/${file.name}`);
      if (!source.includes("translator(")) continue;
      for (const m of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
      for (const m of source.matchAll(/\bt\(\s*`/g)) throw new Error(`${dir.name}/${file.name}: a template literal in t() at ${m.index}`);
    }
  }
  return keys;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

Deno.test("every email text is translated into every language, with the same placeholders", async () => {
  const keys = await usedKeys();
  for (const [lang, messages] of Object.entries(DICTIONARIES)) {
    const missing = [...keys].filter((k) => !(k in messages));
    assertEquals(missing, [], `${lang}: missing`);
    const extra = Object.keys(messages).filter((k) => !keys.has(k));
    assertEquals(extra, [], `${lang}: not used`);
    for (const k of keys) assertEquals(placeholders(messages[k]), placeholders(k), `${lang}: placeholders of ${JSON.stringify(k)}`);
  }
});

Deno.test("an unknown language is English, and English fills placeholders", () => {
  assertEquals(emailLanguage("xx"), "en");
  assertEquals(emailLanguage(null), "en");
  assertEquals(emailLanguage("fr"), "fr");
  assertEquals(et("en", "Hi {name},", { name: "Ada" }), "Hi Ada,");
});
