import { createElement, Fragment, type ReactNode } from "react";
/**
 * The app's languages (the accessibility menu's Language). Text is translated by its English
 * wording: t("Log in") looks up "Log in" in the chosen language's dictionary
 * (src/data/i18n/<code>.json) and falls back to the English, so anything not yet translated
 * still reads. Placeholders are {name}; plural wording goes through plural(), which picks the
 * language's own form. Policies stay in English (a note says so). i18n.test.ts checks that every
 * t() and plural() in the source is in every dictionary, with the same placeholders.
 */

export const UI_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  // The other languages natural voices read (NATURAL_LANGUAGES in lib/naturalVoice.ts).
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文（简体）" },
  { code: "ko", name: "한국어" },
  { code: "hi", name: "हिन्दी" },
  { code: "ar", name: "العربية" },
  { code: "pl", name: "Polski" },
  { code: "ru", name: "Русский" },
  { code: "tr", name: "Türkçe" },
  { code: "sv", name: "Svenska" },
  { code: "uk", name: "Українська" },
  { code: "tl", name: "Tagalog" },
  { code: "bg", name: "Български" },
  { code: "ro", name: "Română" },
] as const;

/** Languages written right to left: the page's direction follows the language. */
export const RTL_LANGUAGES: ReadonlySet<string> = new Set(["ar"]);

/** The locale for Intl (dates, numbers, plural rules): Tagalog's is Filipino, "fil". */
export const intlLocale = (lang: string) => (lang === "tl" ? "fil" : lang);

export type UiLanguage = (typeof UI_LANGUAGES)[number]["code"];
export type Messages = Record<string, string>;
export type Vars = Record<string, string | number>;

const CODES = new Set<string>(UI_LANGUAGES.map((l) => l.code));
export const isUiLanguage = (code: string): code is UiLanguage => CODES.has(code);

/** The first of the browser's languages the app speaks (pt-BR is pt), else English. */
export function uiLanguageFor(preferred: readonly string[] | undefined): UiLanguage {
  for (const tag of preferred ?? []) {
    const base = tag.toLowerCase().split("-")[0];
    // Filipino (fil) is Tagalog's standard form.
    if (base === "fil" && isUiLanguage("tl")) return "tl";
    if (isUiLanguage(base)) return base;
  }
  return "en";
}

/** The browser's own choice, where there's a browser. */
export function browserUiLanguage(): UiLanguage {
  if (typeof navigator === "undefined") return "en";
  return uiLanguageFor(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

/** Fills {name} placeholders; unknown ones are left as they are. */
export function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** The text in the chosen language, or the English when it isn't translated. */
export function translate(messages: Messages | undefined, key: string, vars?: Vars): string {
  return fill(messages?.[key] || key, vars);
}

/** The placeholders a text uses, sorted (for the tests). */
export const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

export interface PluralForms {
  one: string;
  other: string;
}

/** The form for `count` by the language's rules, translated; `{count}` is filled in. */
export function pluralize(messages: Messages | undefined, lang: UiLanguage, count: number, forms: PluralForms, vars?: Vars): string {
  const rule = new Intl.PluralRules(intlLocale(lang)).select(count);
  return translate(messages, rule === "one" ? forms.one : forms.other, { count, ...vars });
}

// The language chosen now, for code outside React (messages made in src/lib): set by useT().
let active: { lang: UiLanguage; messages: Messages | undefined } = { lang: "en", messages: undefined };
export function setActiveLanguage(lang: UiLanguage, messages: Messages | undefined) {
  active = { lang, messages };
}

/** t() for code outside React: in the language chosen when it runs (an error made now reads in it). */
export const tr = ((key: string, vars?: Vars) => translate(active.messages, key, vars)) as ((key: string, vars?: Vars) => string) & {
  plural: (count: number, forms: PluralForms, vars?: Vars) => string;
};
tr.plural = (count, forms, vars) => pluralize(active.messages, active.lang, count, forms, vars);

/** The language chosen now, for code outside React. */
export const activeLanguage = (): UiLanguage => active.lang;

/** The locale dates and numbers are written in: US English, or the language chosen. */
export const dateLocale = (lang: UiLanguage = active.lang) => (lang === "en" ? "en-US" : intlLocale(lang));

/**
 * A translated sentence with parts that are elements (bold, a link): rich(t("Log in with {email}."),
 * { email: <strong>…</strong> }). The sentence stays whole for translators; each {name} is replaced
 * by its element.
 */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return createElement(Fragment, { key: i }, name && name in parts ? parts[name] : piece);
  });
}

/** Marks a text kept in a list or table for translation where it's shown (t(label)); returns it as is. */
export const tk = (text: string) => text;

export type T = ((key: string, vars?: Vars) => string) & {
  plural: (count: number, forms: PluralForms, vars?: Vars) => string;
  lang: UiLanguage;
};

/** A t() for one language and its dictionary. */
export function makeT(lang: UiLanguage, messages: Messages | undefined): T {
  const t = ((key: string, vars?: Vars) => translate(messages, key, vars)) as T;
  t.plural = (count, forms, vars) => pluralize(messages, lang, count, forms, vars);
  t.lang = lang;
  return t;
}
