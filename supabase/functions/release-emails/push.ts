// Release-day notifications on the devices a member turned them on for (Account → Preferences),
// sent in the same hourly run as the emails. Each reminder is claimed once
// (claim_release_pushes(), release_reminders.pushed_at). A device whose push service says it has
// unsubscribed is forgotten; any other failure loses only that notification (the book is on Home
// and in the bell anyway, and the email is separate).

import type { PushMessage, PushResult, PushSubscriptionKeys } from "../_shared/webpush.ts";

export interface DuePush {
  userId: string;
  profileName: string | null;
  volumeId: string;
  title: string;
  author: string | null;
}

export interface Device extends PushSubscriptionKeys {
  id: string;
  userId: string;
}

export interface PushDeps {
  claim: (max: number) => Promise<DuePush[]>;
  devices: (userIds: string[]) => Promise<Device[]>;
  send: (device: Device, message: PushMessage) => Promise<PushResult>;
  /** Deletes devices that have unsubscribed. */
  forget: (deviceIds: string[]) => Promise<void>;
  /** Notes when devices last got a notification. */
  touch: (deviceIds: string[]) => Promise<void>;
}

/** One notification an account: the book, or how many came out. Taps open the book or Home. */
export function releasePush(books: DuePush[]): PushMessage {
  if (books.length === 1) {
    const [b] = books;
    return {
      title: `Out today: ${b.title}`,
      body: `${b.author ? `By ${b.author}. ` : ""}You asked to be reminded${b.profileName ? ` on ${b.profileName}'s profile` : ""}.`,
      url: `/books/${encodeURIComponent(b.volumeId)}`,
      tag: `release-${b.volumeId}`,
    };
  }
  const names = books.map((b) => b.title);
  const listed = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { title: `${books.length} books you were waiting for are out`, body: listed, url: "/", tag: "release-several" };
}

export const PUSH_BATCH = 200;

export async function pushReleases(deps: PushDeps): Promise<{ accounts: number; sent: number; gone: number; failed: number }> {
  const due = await deps.claim(PUSH_BATCH);
  const byUser = new Map<string, DuePush[]>();
  for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  if (byUser.size === 0) return { accounts: 0, sent: 0, gone: 0, failed: 0 };
  const devices = await deps.devices([...byUser.keys()]);
  const sent: string[] = [];
  const gone: string[] = [];
  let failed = 0;
  for (const device of devices) {
    const books = byUser.get(device.userId);
    if (!books) continue;
    try {
      const result = await deps.send(device, releasePush(books));
      if (result === "sent") sent.push(device.id);
      else if (result === "gone") gone.push(device.id);
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`release-emails: a notification to account ${device.userId} failed`, err);
    }
  }
  if (gone.length) await deps.forget(gone);
  if (sent.length) await deps.touch(sent);
  return { accounts: byUser.size, sent: sent.length, gone: gone.length, failed };
}
