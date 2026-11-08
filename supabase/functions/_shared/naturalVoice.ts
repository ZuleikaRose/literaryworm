// Natural voices for uploaded books: Google Cloud Text-to-Speech (Chirp 3: HD voices) reads a
// member's own upload, a piece at a time as they listen, and each piece is kept beside the upload
// so hearing it again costs nothing. This file is word for word the same in
// front_end/literaryworm_app/src/lib/naturalVoice.ts and supabase/functions/_shared/naturalVoice.ts
// (naturalVoice.test.ts checks), so the browser and the natural-voice function cut a chapter into
// the same pieces and agree on the voices and the limits. It has no imports, so it runs in both.

export type NaturalVoiceAccent = "British" | "American" | "Australian";

export interface NaturalVoice {
  /** Google's name for the voice. */
  id: string;
  /** The name shown in the player. */
  name: string;
  /** The book language it reads ("en", "fr", …). */
  language: string;
  /** English voices only: the accent the player groups it under. */
  accent: NaturalVoiceAccent | null;
  languageCode: string;
}

const voice = (languageCode: string, name: string, accent: NaturalVoiceAccent | null = null, language = languageCode.slice(0, 2), id?: string): NaturalVoice => ({
  id: id ?? `${languageCode}-Chirp3-HD-${name}`,
  name,
  language,
  accent,
  languageCode,
});

/**
 * The voices offered: a woman's and a man's in each English accent the player offers, and in
 * each of the app's other languages, for books written in them.
 */
export const NATURAL_VOICES: readonly NaturalVoice[] = [
  voice("en-GB", "Aoede", "British"),
  voice("en-GB", "Charon", "British"),
  voice("en-US", "Kore", "American"),
  voice("en-US", "Puck", "American"),
  voice("en-AU", "Leda", "Australian"),
  voice("en-AU", "Fenrir", "Australian"),
  voice("fr-FR", "Aoede"),
  voice("fr-FR", "Charon"),
  voice("de-DE", "Aoede"),
  voice("de-DE", "Charon"),
  voice("es-ES", "Aoede"),
  voice("es-ES", "Charon"),
  voice("it-IT", "Aoede"),
  voice("it-IT", "Charon"),
  voice("pt-BR", "Aoede"),
  voice("pt-BR", "Charon"),
  voice("nl-NL", "Aoede"),
  voice("nl-NL", "Charon"),
  voice("ja-JP", "Aoede"),
  voice("ja-JP", "Charon"),
  // Google's codes for Mandarin, Arabic and Filipino (Tagalog) aren't the book's two letters.
  voice("cmn-CN", "Aoede", null, "zh"),
  voice("cmn-CN", "Charon", null, "zh"),
  voice("ko-KR", "Aoede"),
  voice("ko-KR", "Charon"),
  voice("hi-IN", "Aoede"),
  voice("hi-IN", "Charon"),
  voice("ar-XA", "Aoede", null, "ar"),
  voice("ar-XA", "Charon", null, "ar"),
  voice("pl-PL", "Aoede"),
  voice("pl-PL", "Charon"),
  voice("ru-RU", "Aoede"),
  voice("ru-RU", "Charon"),
  voice("tr-TR", "Aoede"),
  voice("tr-TR", "Charon"),
  voice("sv-SE", "Aoede"),
  voice("sv-SE", "Charon"),
  voice("uk-UA", "Aoede"),
  voice("uk-UA", "Charon"),
  // Google has no Chirp 3: HD voices for Filipino: its Neural2 voices read Tagalog books instead.
  voice("fil-PH", "Neural2 A", null, "tl", "fil-ph-Neural2-A"),
  voice("fil-PH", "Neural2 D", null, "tl", "fil-ph-Neural2-D"),
  voice("bg-BG", "Aoede"),
  voice("bg-BG", "Charon"),
  voice("ro-RO", "Aoede"),
  voice("ro-RO", "Charon"),
  voice("el-GR", "Aoede"),
  voice("el-GR", "Charon"),
];

/** The languages natural voices read, besides English (two letters, as uploaded_books.language keeps them). */
export const NATURAL_LANGUAGES = ["fr", "de", "es", "it", "pt", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl", "bg", "ro", "el"] as const;

/** The voices offered for a book: its own language's first (when there are some), then English. */
export function voicesFor(language: string | null): NaturalVoice[] {
  const own = language && language !== "en" ? NATURAL_VOICES.filter((v) => v.language === language) : [];
  return [...own, ...NATURAL_VOICES.filter((v) => v.language === "en")];
}

/** The voice a book starts with: its language's first, else a British woman's. */
export function defaultNaturalVoice(language: string | null): NaturalVoice {
  return voicesFor(language)[0];
}

/** A British woman's voice, like the device voice the player picks first. */
export const DEFAULT_NATURAL_VOICE = "en-GB-Chirp3-HD-Aoede";

/** ProfileData.narrationVoice for a natural voice: this, then the voice's id. */
export const NATURAL_PREFIX = "natural:";

export function naturalVoice(id: string): NaturalVoice | null {
  return NATURAL_VOICES.find((v) => v.id === id) ?? null;
}

/** About how many characters a voice reads in an hour at normal speed (14 a second). */
export const CHARACTERS_PER_HOUR = 50400;

/**
 * Hours of new natural-voice reading each account can have voiced a month, by plan. Pieces
 * already voiced play again free; listening still counts towards the plan's audiobook hours.
 */
export const NATURAL_VOICE_HOURS: Record<string, number> = { basic: 2, standard: 6, premium: 12 };

/**
 * During a first membership's free week, an account can have this many hours voiced, whatever its
 * plan; the plan's own hours start with the first successful payment.
 */
export const NATURAL_VOICE_TRIAL_HOURS = 1;

/** The share of the month's natural-voice reading at which the bell gives a heads-up. */
export const NATURAL_VOICE_ALERT_SHARE = 0.8;

/** The month natural_voice_usage counts in: its first day, in UTC ("2026-11-01"). */
export function naturalVoiceMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Seconds of new natural-voice reading used and left this month, from characters used. */
export function naturalVoiceTime(planId: string, characters: number, trial = false): { used: number; left: number; limit: number } {
  const perSecond = CHARACTERS_PER_HOUR / 3600;
  const limit = naturalVoiceLimit(planId, trial) / perSecond;
  const used = Math.min(limit, characters / perSecond);
  return { used, left: limit - used, limit };
}

/** This month's limit for a plan, in characters sent to Google (0 for anything else); during the free week, the trial's hour at most. */
export function naturalVoiceLimit(planId: string, trial = false): number {
  const hours = Object.hasOwn(NATURAL_VOICE_HOURS, planId) ? NATURAL_VOICE_HOURS[planId] : 0;
  return Math.round((trial ? Math.min(hours, NATURAL_VOICE_TRIAL_HOURS) : hours) * CHARACTERS_PER_HOUR);
}

/** Whether a profile is offered natural voices for a book: members' own stored uploads and the public-domain classics; Kids profiles only with a grown-up's yes. */
export function naturalVoiceOffered(input: { member: boolean; ageRating: string | null; uploadPath: string | null; kidsAllowed?: boolean; publicDomain?: boolean }): boolean {
  // Kids profiles only when a grown-up turned them on (reader_profiles.kids_natural_voices).
  // A member's upload, or a public-domain classic (its own text, read by the natural-voice function).
  return input.member && input.ageRating !== null && (input.ageRating !== "kids" || input.kidsAllowed === true) && (input.uploadPath !== null || input.publicDomain === true);
}

/**
 * The most characters in one piece: about 85 seconds of reading in English, and under Google's
 * 5,000 bytes a request even in scripts of three bytes a character (Chinese, Japanese, Hindi).
 */
export const SEGMENT_CHARS = 1200;

export interface VoiceSegment {
  /** Where the piece starts in the chapter's text. */
  offset: number;
  text: string;
}

// After a sentence's end (with any closing quotes or brackets) and its spaces; after a Chinese or
// Japanese full stop, a Hindi danda or an Arabic question mark (spaces or not); or at a line break.
const BREAK = /[.!?…]["'”’)\]]*\s+|[。！？।؟][」』”’)）]*\s*|\n\s*/g;

/**
 * A chapter cut into the pieces a natural voice reads: whole sentences up to SEGMENT_CHARS, a
 * sentence longer than that at a space (or, with no space, at the limit).
 */
export function voiceSegments(chapter: string): VoiceSegment[] {
  const breaks: number[] = [];
  for (const m of chapter.matchAll(BREAK)) breaks.push((m.index ?? 0) + m[0].length);
  const segments: VoiceSegment[] = [];
  let start = 0;
  let b = 0;
  while (start < chapter.length) {
    while (start < chapter.length && /\s/.test(chapter[start])) start++;
    if (start >= chapter.length) break;
    let end = chapter.length;
    if (chapter.length - start > SEGMENT_CHARS) {
      const limit = start + SEGMENT_CHARS;
      while (b < breaks.length && breaks[b] <= start) b++;
      let best = -1;
      for (let i = b; i < breaks.length && breaks[i] <= limit; i++) best = breaks[i];
      if (best > start) end = best;
      else {
        const space = chapter.lastIndexOf(" ", limit);
        end = space > start ? space + 1 : limit;
      }
    }
    const text = chapter.slice(start, end).trimEnd();
    if (text) segments.push({ offset: start, text });
    start = end;
  }
  return segments;
}

/** The private bucket the voiced pieces are kept in. */
export const VOICE_BUCKET = "upload-voices";

/**
 * Where one voiced piece is kept: the account's folder, then the upload's, so both delete as a
 * folder. Pieces cut for character voices (chapterPieces()) are numbered apart, with a "c".
 */
export function voiceFile(userId: string, uploadId: string, voiceId: string, chapter: number, segment: number, cast = false, sayKey = ""): string {
  return `${userId}/${uploadId}/${voiceId}-${chapter}-${cast ? "c" : ""}${segment}${sayKey ? `-p${sayKey}` : ""}.mp3`;
}

/**
 * Pronunciations: a listener's respellings of names (or words) a natural voice says wrongly, per
 * book: the word as the book writes it, to how it sounds ("Hermione" to "her-MY-oh-nee"). Only the
 * text sent to Google changes (sayAs()), never what the reader or the read-along shows, and a piece
 * gets a file of its own (pronunciationKey()) only when it has one of the words, so the rest of
 * the book is never voiced again.
 */
export type Pronunciations = Record<string, string>;

/** The most words a book can have respelled. */
export const PRONUNCIATIONS_MAX = 50;
export const PRONOUNCE_WORD_MAX = 40;
export const PRONOUNCE_SAY_MAX = 60;
// Letters (any script) with spaces, hyphens and apostrophes between them.
const PRONOUNCEABLE = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*-?$/u;

/** Whether a word and its respelling can be kept (both tidied first: trimmed, single spaces). */
export function validPronunciation(word: string, say: string): boolean {
  return (
    word.length > 0 &&
    word.length <= PRONOUNCE_WORD_MAX &&
    say.length > 0 &&
    say.length <= PRONOUNCE_SAY_MAX &&
    PRONOUNCEABLE.test(word) &&
    PRONOUNCEABLE.test(say) &&
    word.toLowerCase() !== say.toLowerCase()
  );
}

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");

/** A book's pronunciations from anywhere (the database, a request): valid ones only, one per word. */
export function parsePronunciations(value: unknown): Pronunciations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Pronunciations = {};
  const seen = new Set<string>();
  for (const [rawWord, rawSay] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= PRONUNCIATIONS_MAX) break;
    if (typeof rawSay !== "string") continue;
    const word = tidy(rawWord);
    const say = tidy(rawSay);
    if (!validPronunciation(word, say) || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    out[word] = say;
  }
  return out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The word on its own (not inside a longer one), in any case, spaces matching any run of spaces.
const wordPattern = (word: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${word.split(" ").map(escapeRegExp).join("\\s+")}(?![\\p{L}\\p{M}])`, "giu");
// Longest first, so "Mary Anne" is respelled before "Mary".
const byLength = (pron: Pronunciations) => Object.keys(pron).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));

/** The pronunciations whose words are in `text`. */
export function piecePronunciations(text: string, pron: Pronunciations): Pronunciations {
  const out: Pronunciations = {};
  for (const word of byLength(pron)) if (wordPattern(word).test(text)) out[word] = pron[word];
  return out;
}

/** `text` as it's sent to Google: each word replaced by its respelling. */
export function sayAs(text: string, pron: Pronunciations): string {
  let out = text;
  for (const word of byLength(pron)) out = out.replace(wordPattern(word), pron[word]);
  return out;
}

/** A short key for a set of pronunciations ("" for none), the same in the browser and the function. */
export function pronunciationKey(pron: Pronunciations): string {
  const entries = Object.keys(pron)
    .map((w) => `${w.toLowerCase()}=${pron[w]}`)
    .sort();
  if (!entries.length) return "";
  // FNV-1a over the UTF-16 code units, 32 bits.
  let hash = 0x811c9dc5;
  for (const ch of entries.join("\n")) {
    for (let i = 0; i < ch.length; i++) {
      hash ^= ch.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Character voices: when the listener turns them on, what the characters say (the text inside
 * quotation marks or dash dialogue) is read by other voices than the narration. A speaker named
 * beside the words ("said Elizabeth", "Mr. Darcy replied") keeps the same voice all book long;
 * words with no named speaker take the speaker named elsewhere in the same paragraph, else, when
 * two people are talking in turn, the one who spoke the paragraph before last, else one voice kept
 * for speech. Voices are dealt out, not matched to the character. Speech and names are found in
 * every language uploads are read in: quotation marks of each (and 「」 『』), dialogue that opens
 * a paragraph with a dash, verbs of saying (SAID_BY_LANGUAGE) beside capitalised names in Latin,
 * Cyrillic and Greek scripts, and the words around the verb in Chinese, Japanese, Korean, Hindi and Arabic. Chapters with no speech are
 * read exactly as without character voices (the same pieces, the same files).
 */
export const CAST_NAMES: readonly string[] = ["Charon", "Kore", "Puck", "Leda", "Fenrir", "Zephyr", "Orus", "Despina"];

export interface VoicePiece extends VoiceSegment {
  /** The voice that reads it (Google's name). */
  voice: string;
  /** Cut for character voices (numbered apart in voiceFile()). */
  cast: boolean;
  /** Whose speech it is (lower case), for a speed per character (lib/castSpeeds.ts); never part of a file's name. */
  speaker?: string | null;
}

export interface CastSegment extends VoiceSegment {
  speech: boolean;
  /** The speaker named for it, when there is one. */
  speaker: string | null;
}

// Verbs of saying in the languages uploads are read in, for books that write names with capital
// letters (Latin and Cyrillic scripts): "said Elizabeth", "Elizabeth said", "dijo Juan", "сказал Иван".
const SAID_BY_LANGUAGE: Record<string, string[]> = {
  en: ["said", "says", "asked", "asks", "cried", "replied", "answered", "shouted", "whispered", "exclaimed", "continued", "added", "returned", "called", "muttered", "murmured", "began", "remarked", "observed", "declared", "repeated", "insisted", "demanded", "inquired", "enquired", "sighed", "laughed", "growled", "snapped"],
  fr: ["dit", "demanda", "répondit", "s'écria", "s’écria", "reprit", "ajouta", "murmura", "cria", "répliqua", "s'exclama", "s’exclama", "chuchota"],
  de: ["sagte", "fragte", "antwortete", "rief", "flüsterte", "meinte", "erwiderte", "murmelte", "schrie"],
  es: ["dijo", "preguntó", "respondió", "exclamó", "contestó", "gritó", "añadió", "murmuró", "susurró", "replicó"],
  pt: ["disse", "perguntou", "respondeu", "gritou", "exclamou", "murmurou", "sussurrou", "acrescentou", "retrucou"],
  it: ["disse", "chiese", "rispose", "gridò", "esclamò", "domandò", "sussurrò", "mormorò", "aggiunse", "replicò"],
  nl: ["zei", "vroeg", "antwoordde", "riep", "fluisterde", "mompelde", "zegt", "vraagt"],
  pl: ["powiedział", "powiedziała", "zapytał", "zapytała", "spytał", "spytała", "odpowiedział", "odpowiedziała", "krzyknął", "krzyknęła", "rzekł", "rzekła", "szepnął", "szepnęła"],
  sv: ["sade", "sa", "frågade", "svarade", "ropade", "viskade", "utbrast", "mumlade"],
  tr: ["dedi", "sordu", "diye sordu", "cevap verdi", "yanıtladı", "bağırdı", "fısıldadı"],
  tl: ["sabi ni", "tanong ni", "sagot ni", "sigaw ni", "bulong ni", "wika ni"],
  ru: ["сказал", "сказала", "спросил", "спросила", "ответил", "ответила", "крикнул", "крикнула", "прошептал", "прошептала", "воскликнул", "воскликнула", "произнёс", "произнесла"],
  bg: ["каза", "попита", "отговори", "извика", "прошепна", "възкликна", "рече"],
  ro: ["spuse", "zise", "întrebă", "răspunse", "strigă", "șopti", "exclamă", "a spus", "a întrebat", "a răspuns"],
  el: ["είπε", "ρώτησε", "απάντησε", "φώναξε", "ψιθύρισε", "αναφώνησε", "μουρμούρισε", "πρόσθεσε", "συνέχισε"],
  uk: ["сказав", "сказала", "запитав", "запитала", "спитав", "спитала", "відповів", "відповіла", "крикнув", "крикнула", "прошепотів", "прошепотіла", "вигукнув", "вигукнула"],
};
// Longest first, so "sade" is tried before "sa".
const SAID = Object.values(SAID_BY_LANGUAGE)
  .flat()
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"))
  .join("|");
const TITLES = "Mr|Mrs|Ms|Miss|Dr|Lady|Lord|Sir|Captain|Aunt|Uncle|Madame|Monsieur|Mademoiselle|Herr|Frau|Señor|Señora|Don|Doña|Dom|Dona|Signor|Signora|Pan|Pani|Fru|Bay|Bayan|Gospodin|Domnul|Doamna|Domnișoara|Господин|Госпожа|Κύριος|Κυρία|Δεσποινίς|Κος|Κα";
const NAME = `(?:(?:${TITLES})\\.?\\s+)?\\p{Lu}[\\p{Ll}\\p{M}'’-]+`;
// Greek puts an article before a name ("ρώτησε η Ελένη"); it's skipped, not part of the name.
const ARTICLE = "(?:(?:ο|η|το|οι)\\s+)?";
// Scripts without capital letters name speakers with words around the verb.
const HAN_SAID = "说道|问道|答道|喊道|叫道|回答|说|问|道|喊";
const JA_SAID = "言った|言う|聞いた|尋ねた|答えた|叫んだ|呟いた|つぶやいた|囁いた|ささやいた";
const KO_SAID = "말했다|물었다|대답했다|외쳤다|속삭였다|중얼거렸다";
const HI_SAID = "कहा|पूछा|जवाब दिया|उत्तर दिया|चिल्लाया|चिल्लाई|बोला|बोली";
const AR_SAID = "قال|قالت|سأل|سألت|أجاب|أجابت|صاح|صاحت|همس|همست";
/** After the words: each pattern's first group that matched is the speaker. */
const AFTER = [
  new RegExp(`^[\\s,.!?;:—–―-]*(?:${ARTICLE}(${NAME})\\s+(?:${SAID})(?!\\p{L})|(?:${SAID})\\s+${ARTICLE}(${NAME}))`, "u"),
  new RegExp(`^[，,。.]?\\s*(\\p{Script=Han}{2,3})(?:${HAN_SAID})`, "u"),
  new RegExp(`^と(?:(\\p{Script=Han}{1,4}|\\p{Script=Katakana}{2,8})(?:は|が))?(?:${JA_SAID})`, "u"),
  new RegExp(`^(?:라고|하고)\\s*(\\p{Script=Hangul}{2,4})(?:이|가|은|는)\\s*(?:${KO_SAID})`, "u"),
  new RegExp(`^[,।]?\\s*(\\p{Script=Devanagari}+)\\s+ने\\s+(?:${HI_SAID})`, "u"),
  new RegExp(`^[،,.]?\\s*(?:${AR_SAID})\\s+(\\p{Script=Arabic}{2,})`, "u"),
];
/** Before the words. */
const BEFORE = [
  new RegExp(`(?:(${NAME})\\s+(?:${SAID})|(?:${SAID})\\s+${ARTICLE}(${NAME}))\\s*[,:]?\\s*$`, "u"),
  new RegExp(`(\\p{Script=Han}{2,3})(?:${HAN_SAID})[:：，,]?\\s*$`, "u"),
  new RegExp(`(\\p{Script=Han}{1,4}|\\p{Script=Katakana}{2,8})(?:は|が)\\s*$`, "u"),
  new RegExp(`(\\p{Script=Hangul}{2,4})(?:이|가|은|는)\\s*(?:${KO_SAID})[.:]?\\s*$`, "u"),
  new RegExp(`(\\p{Script=Devanagari}+)\\s+ने\\s+(?:${HI_SAID})[,:]?\\s*$`, "u"),
  new RegExp(`(?:${AR_SAID})\\s+(\\p{Script=Arabic}{2,})\\s*[:،,]?\\s*$`, "u"),
];
// Pronouns and the like, which aren't names, in every language above.
const NOT_NAMES = new Set([
  "he", "she", "i", "they", "it", "we", "you", "one", "the", "this", "that", "then", "there", "her", "his", "him", "someone", "everyone", "nobody", "somebody",
  "il", "elle", "ils", "elles", "on", "je", "er", "sie", "es", "ich", "man", "él", "ella", "yo", "ellos", "ellas", "usted",
  "ele", "ela", "eles", "eu", "você", "lui", "lei", "egli", "ella", "io", "hij", "zij", "ze", "ik", "jij",
  "ona", "oni", "ja", "ty", "han", "hon", "jag", "de", "o", "ben", "sen", "siya", "ako", "ikaw",
  "αυτός", "αυτή", "αυτοί", "αυτές", "εκείνος", "εκείνη", "εγώ", "εσύ", "εμείς", "εσείς",
  "он", "она", "они", "я", "ты", "він", "вона", "вони", "той", "тя", "те", "аз", "ти", "el", "ea", "ei", "ele", "eu", "tu", "dumneavoastră",
  "他", "她", "我", "你", "他们", "她们", "彼", "彼女", "私", "僕", "俺", "그", "그녀", "나", "너", "वह", "मैं", "उस", "هو", "هي", "أنا",
]);
// Words inside quotation marks, to the end of the paragraph when the closing mark is left off (as
// novels do when a speech runs on into the next paragraph): “…”, "…", «…», „…“, ”…” (Swedish),
// ‹…›, and the Japanese and Chinese 「…」 and 『…』.
const QUOTED =
  /“[^”\n]*(?:”|(?=\n)|$)|"[^"\n]*(?:"|(?=\n)|$)|«[^»\n]*(?:»|(?=\n)|$)|„[^“”\n]*(?:[“”]|(?=\n)|$)|”[^”\n]*(?:”|(?=\n)|$)|‹[^›\n]*(?:›|(?=\n)|$)|「[^」\n]*(?:」|(?=\n)|$)|『[^』\n]*(?:』|(?=\n)|$)/g;
// A paragraph that opens with a dash is dialogue (Spanish, Portuguese, Italian, Polish, Russian,
// Ukrainian, Swedish, Turkish…): "—Hola —dijo Juan—. ¿Vienes?" is speech, narration, speech.
const DASH = /[—–―]/g;
// Inside dash dialogue with no closing dash ("— Bună ziua, zise Ion."), a comma before a verb of
// saying and a name ends the speech; the rest is narration.
const INLINE_SAID = new RegExp(`,\\s+(?=(?:${SAID})\\s+${ARTICLE}${NAME}|${NAME}\\s+(?:${SAID})(?!\\p{L}))`, "u");

function speakerIn(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    const name = m ? (m.slice(1).find((g) => g !== undefined) ?? null) : null;
    if (name) return NOT_NAMES.has(name.toLowerCase()) ? null : name.replace(/\s+/g, " ");
  }
  return null;
}

/** Where the speech is: quoted words anywhere, and the spoken parts of paragraphs that open with a dash. */
function speechSpans(chapter: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const m of chapter.matchAll(QUOTED)) spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  let lineStart = 0;
  for (const line of chapter.split("\n")) {
    const lead = /^\s*[—–―]\s*/.exec(line);
    if (lead) {
      const dashes = [...line.matchAll(DASH)].map((m) => m.index ?? 0);
      // Between dashes the parts take turns: speech, narration, speech…
      for (let i = 0; i < dashes.length; i += 2) {
        let start = dashes[i] + 1;
        let end = i + 1 < dashes.length ? dashes[i + 1] : line.length;
        while (start < end && /\s/.test(line[start])) start++;
        while (end > start && /\s/.test(line[end - 1])) end--;
        const inline = INLINE_SAID.exec(line.slice(start, end));
        if (inline) end = start + inline.index + 1;
        if (end > start) spans.push({ start: lineStart + start, end: lineStart + end });
      }
    }
    lineStart += line.length + 1;
  }
  // In order, without overlaps (a quotation inside dash dialogue counts once), each with something to say.
  spans.sort((a, b) => a.start - b.start);
  const kept: { start: number; end: number }[] = [];
  for (const s of spans) {
    if (kept.length && s.start < kept[kept.length - 1].end) continue;
    if (/[\p{L}\p{N}]/u.test(chapter.slice(s.start, s.end))) kept.push(s);
  }
  return kept;
}

/**
 * A chapter cut into narration and speech, each part as long as voiceSegments() allows, with the
 * speaker named for each speech; null when the chapter has no speech (read as voiceSegments()).
 */
export function castSegments(chapter: string): CastSegment[] | null {
  const spans = speechSpans(chapter);
  const quotes: { start: number; end: number; speaker: string | null }[] = spans.map((s, i) => {
    const lineStart = chapter.lastIndexOf("\n", s.start - 1) + 1;
    const lineEnd = chapter.indexOf("\n", s.end);
    const next = spans[i + 1]?.start ?? chapter.length;
    const limit = Math.min(next, lineEnd < 0 ? chapter.length : lineEnd);
    const after = chapter.slice(s.end, limit);
    // Words that run up to the next speech, in one clause ending in a colon or comma, introduce it
    // ("Mary said: “…”"), so they name the next speaker, not this one.
    const introducesNext = limit === next && /[,:：，،]\s*$/u.test(after) && !/[.!?。！？।؟]/u.test(after);
    const before = chapter.slice(Math.max(lineStart, s.start - 60, spans[i - 1]?.end ?? 0), s.start);
    return { ...s, speaker: (introducesNext ? null : speakerIn(after, AFTER)) ?? speakerIn(before, BEFORE) };
  });
  if (!quotes.length) return null;
  // Unnamed speech takes the speaker named nearest it in the same paragraph.
  const paragraphOf = (at: number) => chapter.lastIndexOf("\n", at - 1);
  quotes.forEach((q, i) => {
    if (q.speaker) return;
    const p = paragraphOf(q.start);
    for (let d = 1; d < quotes.length; d++) {
      for (const j of [i - d, i + d]) {
        const other = quotes[j];
        if (other && other.speaker && paragraphOf(other.start) === p) {
          q.speaker = other.speaker;
          return;
        }
      }
    }
  });
  // Two people talking in turn: in a run of paragraphs of speech, a paragraph whose speaker isn't
  // named ("he said", or nothing) is the one who spoke the paragraph before last, when the last two
  // were different people. A paragraph of narration alone ends the run.
  let last: string | null = null;
  let beforeLast: string | null = null;
  let paragraph = -2;
  let paragraphSpeaker: string | null = null;
  for (const q of quotes) {
    const p = paragraphOf(q.start);
    if (p !== paragraph) {
      const between = chapter.slice(paragraph + 1, p + 1);
      // A narration-only paragraph sits between this one and the last that had speech.
      if (paragraph >= -1 && between.split("\n").slice(1, -1).some((line) => /[\p{L}\p{N}]/u.test(line))) {
        last = beforeLast = null;
      }
      if (paragraphSpeaker && paragraphSpeaker !== last) {
        beforeLast = last;
        last = paragraphSpeaker;
      }
      paragraph = p;
      paragraphSpeaker = null;
    }
    if (!q.speaker && beforeLast && last && beforeLast !== last) q.speaker = beforeLast;
    paragraphSpeaker ??= q.speaker;
  }

  const parts: CastSegment[] = [];
  const add = (start: number, end: number, speech: boolean, speaker: string | null) => {
    const text = chapter.slice(start, end);
    // Narration between speeches that's only spaces and punctuation isn't read.
    if (!/[\p{L}\p{N}]/u.test(text)) return;
    for (const piece of voiceSegments(text)) parts.push({ offset: start + piece.offset, text: piece.text, speech, speaker });
  };
  let at = 0;
  for (const q of quotes) {
    add(at, q.start, false, null);
    add(q.start, q.end, true, q.speaker);
    at = q.end;
  }
  add(at, chapter.length, false, null);
  return parts;
}

/** The character voice for a speech: another voice than the narrator's, the same one for a speaker every time. */
/**
 * The listener's choice of voice for named speakers in one book: speaker (lower case) to one of
 * CAST_NAMES. Kept per profile and book; checked by parseCastChoices() on both sides.
 */
export type CastChoices = Record<string, string>;

/** The most speakers a book keeps a choice for, and the longest name. */
export const CAST_CHOICES_MAX = 50;
export const CAST_SPEAKER_MAX = 60;

/** Choices as they arrive from anywhere: only speakers with a known voice, at most CAST_CHOICES_MAX. */
export function parseCastChoices(value: unknown): CastChoices {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CastChoices = {};
  for (const [speaker, name] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= CAST_CHOICES_MAX) break;
    const key = speaker.trim().toLowerCase();
    if (key && key.length <= CAST_SPEAKER_MAX && typeof name === "string" && ALL_CAST_NAMES.has(name)) out[key] = name;
  }
  return out;
}

/**
 * The character voice for a speech: the listener's choice for that speaker if there is one, else
 * another voice than the narrator's, the same one for a speaker every time.
 */
export function speakerVoice(narrator: NaturalVoice, speaker: string | null, choices: CastChoices = {}): string {
  const names = castNamesFor(narrator.languageCode);
  const chosen = speaker ? choices[speaker.toLowerCase()] : undefined;
  if (chosen && names.includes(chosen)) return castVoiceId(narrator.languageCode, chosen);
  const pool = names.filter((n) => castVoiceId(narrator.languageCode, n) !== narrator.id);
  let pick = pool[0];
  if (speaker && pool.length > 1) {
    let hash = 0;
    for (const ch of speaker.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    pick = pool[1 + (hash % (pool.length - 1))];
  }
  return castVoiceId(narrator.languageCode, pick);
}

/**
 * Character voices Google lacks in a language (scripts/check-natural-voices.mjs checks every one),
 * and languages with no Chirp 3: HD voices at all, which use these of their own instead.
 */
const CAST_MISSING: Record<string, string[]> = { "ru-RU": ["Despina"] };
const OTHER_CAST: Record<string, string[]> = { "fil-PH": ["Wavenet A", "Wavenet B", "Wavenet C", "Wavenet D"] };

/** The character voices a language offers, by the names the player shows. */
export function castNamesFor(languageCode: string): string[] {
  return OTHER_CAST[languageCode] ?? CAST_NAMES.filter((n) => !CAST_MISSING[languageCode]?.includes(n));
}

/** Google's name for a character voice in a language: "en-GB-Chirp3-HD-Kore", "fil-PH-Wavenet-A". */
export function castVoiceId(languageCode: string, name: string): string {
  return OTHER_CAST[languageCode] ? `${languageCode}-${name.replace(" ", "-")}` : `${languageCode}-Chirp3-HD-${name}`;
}

/** Every character voice name in any language (what a saved choice may name). */
const ALL_CAST_NAMES = new Set([...CAST_NAMES, ...Object.values(OTHER_CAST).flat()]);

/** The named speakers in a book, most speeches first (for choosing their voices), at most `max`. */
export function bookSpeakers(chapters: string[], max = 20): { speaker: string; speeches: number }[] {
  const counts = new Map<string, { speaker: string; speeches: number }>();
  for (const chapter of chapters) {
    for (const part of castSegments(chapter) ?? []) {
      if (!part.speech || !part.speaker) continue;
      const key = part.speaker.toLowerCase();
      const seen = counts.get(key);
      if (seen) seen.speeches += 1;
      else counts.set(key, { speaker: part.speaker, speeches: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.speeches - a.speeches || a.speaker.localeCompare(b.speaker)).slice(0, max);
}

/** A chapter's pieces as the narrator reads them, with character voices or without. */
export function chapterPieces(chapter: string, narrator: NaturalVoice, characterVoices: boolean, choices: CastChoices = {}): VoicePiece[] {
  const cast = characterVoices ? castSegments(chapter) : null;
  if (!cast) return voiceSegments(chapter).map((p) => ({ ...p, voice: narrator.id, cast: false }));
  return cast.map((p) => ({
    offset: p.offset,
    text: p.text,
    voice: p.speech ? speakerVoice(narrator, p.speaker, choices) : narrator.id,
    cast: true,
    speaker: p.speech && p.speaker ? p.speaker.toLowerCase() : null,
  }));
}
