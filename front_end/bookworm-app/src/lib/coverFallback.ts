import { books } from "../data/books";
import type { CoverStyle } from "../types";

const palettes: CoverStyle[] = books.map((b) => b.cover);

/** A stable drawn cover for a Google Books title with no image, picked from the catalog's palettes. */
export function fallbackCover(id: string): CoverStyle {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length];
}
