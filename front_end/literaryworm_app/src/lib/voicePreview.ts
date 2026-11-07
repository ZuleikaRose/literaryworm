import { castNamesFor, castVoiceId, NATURAL_VOICES } from "./naturalVoice";

/**
 * Voice previews: a few seconds of every natural voice (each narrator and each character voice),
 * recorded once by scripts/voice-previews.mjs into public/voices/preview and served with the site,
 * so hearing one costs nothing and sends nothing to Google. Played by
 * components/VoicePreviewButton.tsx in the player's voice menu and in Who reads whom.
 */

/** What each voice says, in its own language (by NaturalVoice.language). */
export const PREVIEW_TEXTS: Record<string, string> = {
  en: "Hello. This is how I would read your book aloud.",
  fr: "Bonjour. Voici comment je lirais votre livre à voix haute.",
  de: "Hallo. So würde ich Ihr Buch vorlesen.",
  es: "Hola. Así es como leería su libro en voz alta.",
  it: "Ciao. Ecco come leggerei il tuo libro ad alta voce.",
  pt: "Olá. É assim que eu leria o seu livro em voz alta.",
  nl: "Hallo. Zo zou ik je boek voorlezen.",
  ja: "こんにちは。あなたの本をこのように読み上げます。",
  zh: "你好。我会这样为你朗读你的书。",
  ko: "안녕하세요. 저는 이렇게 책을 읽어 드립니다.",
  hi: "नमस्ते। आपकी किताब इस तरह पढ़कर सुनाई जाएगी।",
  ar: "مرحبًا. هكذا سأقرأ كتابك بصوت عالٍ.",
  pl: "Dzień dobry. Tak zabrzmi twoja książka czytana na głos.",
  ru: "Здравствуйте. Вот так я прочитаю вашу книгу вслух.",
  tr: "Merhaba. Kitabınızı sesli olarak böyle okurum.",
  sv: "Hej. Så här skulle jag läsa din bok högt.",
  uk: "Вітаю. Ось так я читатиму вашу книжку вголос.",
  tl: "Kumusta. Ganito ko babasahin nang malakas ang iyong aklat.",
  bg: "Здравейте. Така ще звучи вашата книга, прочетена на глас.",
  ro: "Bună ziua. Așa aș citi cu voce tare cartea dumneavoastră.",
};

/** Every voice with a preview: id and the language it speaks. */
export function previewVoices(): { id: string; language: string }[] {
  const out = new Map<string, string>();
  for (const v of NATURAL_VOICES) {
    out.set(v.id, v.language);
    for (const name of castNamesFor(v.languageCode)) out.set(castVoiceId(v.languageCode, name), v.language);
  }
  return [...out.entries()].map(([id, language]) => ({ id, language }));
}

/** Where a voice's preview is, under public/ and the site's root. */
export const previewPath = (voiceId: string) => `voices/preview/${voiceId}.mp3`;
