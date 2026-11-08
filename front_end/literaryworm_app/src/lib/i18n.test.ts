import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fill, makeT, placeholders, translate, UI_LANGUAGES, uiLanguageFor } from "./i18n";

const unquote = (s: string) => JSON.parse(`"${s}"`) as string;
const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;

/** Every text the source passes to t() or t.plural(), so each must be in every dictionary. */
function sourceKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
        // Comments may show t() as an example: only code counts.
        const src = readFileSync(path, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.$])t[kr]?\(\s*${STRING}`, "g"))) keys.add(unquote(m[1]));
        for (const m of src.matchAll(new RegExp(String.raw`\btr?\.plural\([^;]*?\{\s*one:\s*${STRING},\s*other:\s*${STRING}`, "g"))) {
          keys.add(unquote(m[1]));
          keys.add(unquote(m[2]));
        }
      }
    }
  };
  walk("src");
  return keys;
}

const dictionary = (code: string): Record<string, string> => JSON.parse(readFileSync(`src/data/i18n/${code}.json`, "utf8"));

describe("languages", () => {
  it("start from the browser's language when the app speaks it", () => {
    expect(uiLanguageFor(["pt-BR", "en"])).toBe("pt");
    expect(uiLanguageFor(["el", "de-AT"])).toBe("de");
    expect(uiLanguageFor(["el"])).toBe("en");
    // The languages natural voices read are the app's too; Filipino is Tagalog.
    expect(uiLanguageFor(["ja-JP"])).toBe("ja");
    expect(uiLanguageFor(["zh-Hans-CN"])).toBe("zh");
    expect(uiLanguageFor(["fil-PH"])).toBe("tl");
    expect(UI_LANGUAGES).toHaveLength(20);
    expect(uiLanguageFor(undefined)).toBe("en");
  });

  it("fill placeholders and fall back to the English", () => {
    expect(fill("Hello {name}, {n}", { name: "Ann", n: 3 })).toBe("Hello Ann, 3");
    expect(fill("Keep {unknown}", { name: "x" })).toBe("Keep {unknown}");
    expect(translate({ "Log in": "Iniciar sesión" }, "Log in")).toBe("Iniciar sesión");
    expect(translate({}, "Not yet translated")).toBe("Not yet translated");
    expect(translate(undefined, "{n} left", { n: 2 })).toBe("2 left");
  });

  it("pick each language's plural form", () => {
    const fr = makeT("fr", { "{count} vote": "{count} vote", "{count} votes": "{count} votes" });
    // French counts 0 and 1 as one; English counts only 1.
    expect(fr.plural(0, { one: "{count} vote", other: "{count} votes" })).toBe("0 vote");
    expect(makeT("en", undefined).plural(0, { one: "{count} vote", other: "{count} votes" })).toBe("0 votes");
    expect(makeT("en", undefined).plural(1, { one: "{count} vote", other: "{count} votes" })).toBe("1 vote");
  });

  const keys = sourceKeys();
  for (const { code, name } of UI_LANGUAGES.filter((l) => l.code !== "en")) {
    it(`has every text in ${name}, with the same placeholders`, () => {
      const dict = dictionary(code);
      const missing = [...keys].filter((k) => !dict[k]?.trim());
      expect(missing).toEqual([]);
      const wrong = [...keys].filter((k) => JSON.stringify(placeholders(k)) !== JSON.stringify(placeholders(dict[k])));
      expect(wrong).toEqual([]);
    });
  }
});

describe("rich sentences", () => {
  it("swap placeholders for elements and keep the rest as text", async () => {
    const { rich } = await import("./i18n");
    const parts = rich("Log in with {email} and {password}.", { email: "E", password: "P" }) as { props: { children: unknown } }[];
    expect(parts.map((p) => p.props.children)).toEqual(["Log in with ", "E", " and ", "P", "."]);
  });
});
