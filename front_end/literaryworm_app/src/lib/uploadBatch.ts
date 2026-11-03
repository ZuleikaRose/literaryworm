import { EPUB_MAX_BYTES } from "./epub";
import { tr } from "./i18n";

/**
 * Adding several EPUBs at once (My Library → Uploads): up to `UPLOADS_AT_ONCE` files per choice,
 * each still at most 50 MB (`EPUB_MAX_BYTES`), read one after another so a big batch doesn't hold
 * many books in memory together. A profile keeps up to 50 uploads in all (the database checks).
 */
export const UPLOADS_AT_ONCE = 20;

export interface BatchFile {
  name: string;
  size: number;
}

export interface Skipped {
  name: string;
  reason: string;
}

/** Which chosen files to read: EPUBs within the size limit, the first 20; the rest with a reason. */
export function planBatch<T extends BatchFile>(files: T[]): { take: T[]; skipped: Skipped[]; overLimit: number } {
  const take: T[] = [];
  const skipped: Skipped[] = [];
  let overLimit = 0;
  for (const file of files) {
    if (!/\.epub$/i.test(file.name)) skipped.push({ name: file.name, reason: tr("isn't an EPUB") });
    else if (file.size > EPUB_MAX_BYTES) skipped.push({ name: file.name, reason: tr("is over 50 MB") });
    else if (take.length >= UPLOADS_AT_ONCE) overLimit += 1;
    else take.push(file);
  }
  return { take, skipped, overLimit };
}

/** What a finished batch says: how many are ready, and which weren't added and why. */
export function batchSummary(added: string[], failed: Skipped[], overLimit: number): { done: string | null; problem: string | null } {
  const done =
    added.length === 0 ? null : added.length === 1 ? tr("{title} is ready to read.", { title: added[0] }) : tr("{n} books are ready to read.", { n: added.length });
  const parts = failed.map((f) => `${f.name} ${f.reason}`);
  if (overLimit > 0)
    parts.push(tr.plural(overLimit, { one: "{count} more was left out: add up to {max} at a time", other: "{count} more were left out: add up to {max} at a time" }, { max: UPLOADS_AT_ONCE }));
  const problem = parts.length === 0 ? null : tr("Not added: {list}.", { list: parts.join("; ") });
  return { done, problem };
}
