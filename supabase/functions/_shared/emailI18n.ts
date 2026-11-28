// The language an email is written in: the account's (account_email_language() in the database:
// the member's choice in Account → Preferences, else the first grown-up profile's interface
// language, else English). Text is keyed by its English wording, like the app's t(): each email
// builder calls et(lang, "English text", { vars }), and _shared/emailText/<code>.json holds the
// translations (emailI18n_test.ts fails unless every dictionary has every key, with the same
// placeholders). Book titles, names, What's new entries and club posts stay as written.

import ar from "./emailText/ar.json" with { type: "json" };
import bg from "./emailText/bg.json" with { type: "json" };
import de from "./emailText/de.json" with { type: "json" };
import el from "./emailText/el.json" with { type: "json" };
import es from "./emailText/es.json" with { type: "json" };
import fr from "./emailText/fr.json" with { type: "json" };
import hi from "./emailText/hi.json" with { type: "json" };
import it from "./emailText/it.json" with { type: "json" };
import ja from "./emailText/ja.json" with { type: "json" };
import ko from "./emailText/ko.json" with { type: "json" };
import nl from "./emailText/nl.json" with { type: "json" };
import pl from "./emailText/pl.json" with { type: "json" };
import pt from "./emailText/pt.json" with { type: "json" };
import ro from "./emailText/ro.json" with { type: "json" };
import ru from "./emailText/ru.json" with { type: "json" };
import sv from "./emailText/sv.json" with { type: "json" };
import tl from "./emailText/tl.json" with { type: "json" };
import tr from "./emailText/tr.json" with { type: "json" };
import uk from "./emailText/uk.json" with { type: "json" };
import zh from "./emailText/zh.json" with { type: "json" };

export const EMAIL_LANGUAGES = ["en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl", "bg", "ro", "el"] as const;
export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number];

type Messages = Record<string, string>;
export const DICTIONARIES: Record<Exclude<EmailLanguage, "en">, Messages> = { ar, bg, de, el, es, fr, hi, it, ja, ko, nl, pl, pt, ro, ru, sv, tl, tr, uk, zh };

/** A language code from the database, or English when it's missing or unknown. */
export function emailLanguage(code: unknown): EmailLanguage {
  return typeof code === "string" && (EMAIL_LANGUAGES as readonly string[]).includes(code) ? (code as EmailLanguage) : "en";
}

export type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all)) : text);

/** The text in `lang`, with {placeholders} filled; English when there's no translation. */
export function et(lang: EmailLanguage, key: string, vars?: Vars): string {
  const translated = lang === "en" ? undefined : DICTIONARIES[lang][key];
  return fill(translated ?? key, vars);
}

/** A translator bound to one language: `const t = translator(lang); t("Hi {name},", { name })`. */
export const translator = (lang: EmailLanguage) => (key: string, vars?: Vars) => et(lang, key, vars);

/** The locale for Intl (Tagalog is "fil" there). */
export const emailLocale = (lang: EmailLanguage) => (lang === "tl" ? "fil" : lang === "en" ? "en-GB" : lang);

/** The <html> attributes: lang, and dir for Arabic. */
export const htmlLang = (lang: EmailLanguage) => `lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}`;
