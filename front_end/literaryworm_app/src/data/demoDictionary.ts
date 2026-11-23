import type { DictionaryEntry } from "../lib/dictionaryApi";

/**
 * The demo's offline dictionary: words from the first pages of its books (Pride and Prejudice,
 * Frankenstein, Alice's Adventures in Wonderland and the sample uploads) and the words already
 * in its My words, with short definitions written for the demo. The demo asks the `dictionary`
 * function like everyone else when the backend is there (it's public), and falls back to these
 * when it isn't or the function can't be reached, so a lookup always has something to show.
 */

type Sense = [partOfSpeech: string, definition: string, example?: string];

const entry = (word: string, ...senses: Sense[]): DictionaryEntry => {
  const meanings: DictionaryEntry["meanings"] = [];
  for (const [partOfSpeech, definition, example] of senses) {
    const meaning = meanings.find((m) => m.partOfSpeech === partOfSpeech) ?? meanings[meanings.push({ partOfSpeech, definitions: [] }) - 1];
    meaning.definitions.push({ definition, example: example ?? null });
  }
  return { word, phonetic: null, meanings, sourceUrl: null, demo: true };
};

const ENTRIES: DictionaryEntry[] = [
  // Pride and Prejudice, chapter 1.
  entry("truth", ["noun", "Something that is true; the way things really are."]),
  entry("universally", ["adverb", "By everyone, or in every case."]),
  entry("acknowledged", ["adjective", "Accepted or admitted as true by people in general."], ["verb", "Admitted or recognised (past tense of acknowledge)."]),
  entry("possession", ["noun", "The state of owning or having something."], ["noun", "Something that is owned."]),
  entry("fortune", ["noun", "A large amount of money or property."], ["noun", "Chance or luck, good or bad."]),
  entry("neighbourhood", ["noun", "The area around a place, and the people who live there."]),
  entry("rightful", ["adjective", "Belonging to someone by right; proper or fair."]),
  entry("property", ["noun", "Something owned, such as land, a house or goods."]),
  entry("candour", ["noun", "The quality of being open and honest."]),
  entry("ardent", ["adjective", "Very enthusiastic or passionate."]),
  entry("amiable", ["adjective", "Friendly and pleasant to be with."]),
  // Frankenstein, the preface and the first letter.
  entry("physiological", ["adjective", "To do with how living bodies and their parts work."]),
  entry("supernatural", ["adjective", "Beyond what science or the laws of nature can explain."], ["noun", "Things of that kind, such as ghosts."]),
  entry("occurrence", ["noun", "Something that happens; an event."]),
  entry("imagination", ["noun", "The ability to picture things in the mind that aren't present or real."]),
  entry("melancholy", ["noun", "A deep, lasting sadness."], ["adjective", "Sad and thoughtful."]),
  entry("enterprise", ["noun", "A bold or difficult undertaking."]),
  entry("evil", ["noun", "Great wickedness, or harm."], ["adjective", "Very wicked or harmful."]),
  entry("forebodings", ["noun", "Feelings that something bad is going to happen."]),
  // Alice's Adventures in Wonderland, chapter 1.
  entry("peeped", ["verb", "Looked quickly or secretly, often through a gap (past tense of peep)."]),
  entry("conversations", ["noun", "Talks between two or more people (plural of conversation)."]),
  entry("considering", ["verb", "Thinking carefully about something."]),
  entry("pleasure", ["noun", "A feeling of happy enjoyment."]),
  entry("remarkable", ["adjective", "Unusual enough to be noticed or talked about."]),
  entry("curiosity", ["noun", "A strong wish to know or learn something."]),
  entry("waistcoat", ["noun", "A short, sleeveless garment with buttons down the front, worn over a shirt."]),
  entry("hedge", ["noun", "A row of bushes planted close together to make a boundary."]),
  entry("rabbit", ["noun", "A small furry animal with long ears that lives in a burrow."]),
  entry("marmalade", ["noun", "A jam made from oranges or other citrus fruit."]),
  entry("curious", ["adjective", "Eager to know or learn something."], ["adjective", "Strange or unusual."]),
  // The sample uploads.
  entry("lantern", ["noun", "A lamp with a case around its light, to carry or hang up."]),
  entry("tide", ["noun", "The regular rise and fall of the sea, usually twice a day."]),
  entry("harbour", ["noun", "A sheltered stretch of water where boats can stay safely."]),
  entry("coast", ["noun", "The land along the edge of the sea."]),
];

export const DEMO_DICTIONARY: Record<string, DictionaryEntry> = Object.fromEntries(ENTRIES.map((e) => [e.word, e]));

/** A word the demo's offline dictionary has, to suggest when it lacks one. */
export const DEMO_DICTIONARY_EXAMPLE = "fortune";
