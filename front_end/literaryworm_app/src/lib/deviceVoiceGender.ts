import type { VoiceGender } from "./naturalVoice";

/**
 * Whose a device voice is. The Web Speech API doesn't say, so it's read from the name devices give
 * their voices (Microsoft's, Apple's, Google's and Android's English voices, and the words "male" and
 * "female" some put in the name). Null when the name doesn't tell: the menus list those as other voices.
 */

const WOMEN = new Set(
  [
    // Microsoft
    "libby", "sonia", "maisie", "hollie", "abbi", "bella", "olivia", "aria", "jenny", "michelle", "ana", "emma", "ava",
    "natasha", "annette", "carly", "elsie", "freya", "joanne", "kim", "tina", "zira", "hazel", "susan", "heather",
    "catherine", "linda", "clara", "molly", "nancy", "sara", "jane", "amber", "ashley", "cora", "elizabeth", "monica",
    // Apple
    "kate", "serena", "stephanie", "martha", "fiona", "moira", "karen", "samantha", "allison", "victoria", "tessa",
    "veena", "nicky", "shelley", "sandy", "flo", "grandma", "kathy", "zoe", "joelle",
    // Google, Android and others
    "amy", "joanna", "kendra", "kimberly", "salli", "ivy", "nicole", "olive",
  ],
);

const MEN = new Set(
  [
    // Microsoft
    "ryan", "thomas", "alfie", "elliot", "ethan", "noah", "oliver", "guy", "davis", "andrew", "brian", "christopher",
    "eric", "roger", "steffan", "william", "duncan", "ken", "darren", "neil", "tim", "mark", "david", "george", "james",
    "richard", "sean", "jason", "tony", "jacob", "brandon",
    // Apple
    "daniel", "arthur", "fred", "alex", "aaron", "gordon", "lee", "rishi", "tom", "evan", "nathan", "reed", "rocko",
    "eddy", "grandpa", "ralph", "albert", "junior", "jamie",
    // Google, Android and others
    "brian", "joey", "justin", "matthew", "russell", "geraint",
  ],
);

export function deviceVoiceGender(voice: { name: string }): VoiceGender | null {
  const name = voice.name.toLowerCase();
  // "Google UK English Female", "English (United Kingdom) male": the words say so.
  if (/\bfemale\b/.test(name)) return "woman";
  if (/\bmale\b/.test(name)) return "man";
  // Otherwise the voice's own first name, after the vendor: "Microsoft Ryan Online (Natural) - English".
  const words = name
    .replace(/^(microsoft|google|apple|samsung|amazon)\s+/, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const word of words.slice(0, 2)) {
    if (WOMEN.has(word)) return "woman";
    if (MEN.has(word)) return "man";
  }
  return null;
}
