import { tk, tr } from "./i18n";

/**
 * Content notes (the `content-notes` Edge Function, written by AI and kept per catalog book): the
 * topics and levels, in the function's order, and how to read them. Pure, so Jest can load it; the
 * call is in lib/contentNotesApi.ts.
 */
export const CONTENT_TOPICS = [
  { topic: "violence", label: tk("Violence") },
  { topic: "death", label: tk("Death") },
  { topic: "frightening", label: tk("Frightening scenes") },
  { topic: "language", label: tk("Language") },
  { topic: "sexual_content", label: tk("Sexual content") },
  { topic: "substance_use", label: tk("Alcohol and drugs") },
  { topic: "discrimination", label: tk("Prejudice") },
  { topic: "self_harm", label: tk("Self-harm and suicide") },
] as const;
export type ContentTopic = (typeof CONTENT_TOPICS)[number]["topic"];
export type ContentLevel = "none" | "mild" | "moderate" | "strong";

export interface ContentNote {
  topic: ContentTopic;
  level: ContentLevel;
  note: string;
}

export interface BookContentNotes {
  overall: string;
  notes: ContentNote[];
}

export const LEVEL_LABEL: Record<ContentLevel, string> = { none: tk("None"), mild: tk("Mild"), moderate: tk("Moderate"), strong: tk("Strong") };
const RANK: Record<ContentLevel, number> = { none: 0, mild: 1, moderate: 2, strong: 3 };

export const topicLabel = (topic: ContentTopic) => CONTENT_TOPICS.find((t) => t.topic === topic)?.label ?? topic;

/** The notes worth showing first: anything above none, strongest first (ties in topic order). */
export function present(notes: ContentNote[]): ContentNote[] {
  const order = (t: ContentTopic) => CONTENT_TOPICS.findIndex((x) => x.topic === t);
  return notes.filter((n) => n.level !== "none").sort((a, b) => RANK[b.level] - RANK[a.level] || order(a.topic) - order(b.topic));
}

/** The strongest level in the notes ("none" when there's nothing). */
export function strongest(notes: ContentNote[]): ContentLevel {
  return notes.reduce<ContentLevel>((top, n) => (RANK[n.level] > RANK[top] ? n.level : top), "none");
}

/** "Strong: frightening scenes. Moderate: violence, death." for a short line under a request. */
export function notesLine(notes: ContentNote[]): string {
  const shown = present(notes);
  if (!shown.length) return tr("Nothing to flag.");
  const groups = (["strong", "moderate", "mild"] as const)
    .map((level) => ({ level, topics: shown.filter((n) => n.level === level).map((n) => tr(topicLabel(n.topic)).toLowerCase()) }))
    .filter((g) => g.topics.length);
  return groups.map((g) => tr("{level}: {topics}.", { level: tr(LEVEL_LABEL[g.level]), topics: g.topics.join(", ") })).join(" ");
}
