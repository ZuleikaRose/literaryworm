// Release-day notifications on the devices a member turned them on for (Account → Preferences),
// sent in the same hourly run as the emails. Each reminder is claimed once
// (claim_release_pushes(), release_reminders.pushed_at). A device whose push service says it has
// unsubscribed is forgotten; any other failure loses only that notification (the book is on Home
// and in the bell anyway, and the email is separate).

import { type EmailLanguage, translator } from "../_shared/emailI18n.ts";
import type { PushMessage, PushResult, PushSubscriptionKeys } from "../_shared/webpush.ts";

export interface DuePush {
  userId: string;
  profileName: string | null;
  volumeId: string;
  title: string;
  author: string | null;
  /** The account's email language, also used for its notifications; English when absent. */
  language?: EmailLanguage;
}

export interface Device extends PushSubscriptionKeys {
  id: string;
  userId: string;
}

/** Reaching an account's devices (the database and push service, or stubs in tests). */
export interface DeviceDeps {
  devices: (userIds: string[]) => Promise<Device[]>;
  send: (device: Device, message: PushMessage) => Promise<PushResult>;
  /** Deletes devices that have unsubscribed. */
  forget: (deviceIds: string[]) => Promise<void>;
  /** Notes when devices last got a notification. */
  touch: (deviceIds: string[]) => Promise<void>;
}

export interface PushDeps extends DeviceDeps {
  claim: (max: number) => Promise<DuePush[]>;
}

export interface PushTally {
  accounts: number;
  sent: number;
  gone: number;
  failed: number;
}

/** Sends each account's messages to every one of its devices; forgets the unsubscribed ones. */
export async function deliver(deps: DeviceDeps, messages: Map<string, PushMessage[]>): Promise<PushTally> {
  if (messages.size === 0) return { accounts: 0, sent: 0, gone: 0, failed: 0 };
  const devices = await deps.devices([...messages.keys()]);
  const sent = new Set<string>();
  const gone = new Set<string>();
  let failed = 0;
  for (const device of devices) {
    for (const message of messages.get(device.userId) ?? []) {
      if (gone.has(device.id)) break;
      try {
        const result = await deps.send(device, message);
        if (result === "sent") sent.add(device.id);
        else if (result === "gone") gone.add(device.id);
        else failed += 1;
      } catch (err) {
        failed += 1;
        console.error(`push: a notification to account ${device.userId} failed`, err);
      }
    }
  }
  if (gone.size) await deps.forget([...gone]);
  const touched = [...sent].filter((id) => !gone.has(id));
  if (touched.length) await deps.touch(touched);
  return { accounts: messages.size, sent: touched.length, gone: gone.size, failed };
}

/** One notification an account: the book, or how many came out. Taps open the book or Home. */
export function releasePush(books: DuePush[]): PushMessage {
  const t = translator(books[0]?.language ?? "en");
  if (books.length === 1) {
    const [b] = books;
    const asked = b.profileName ? t("You asked to be reminded on {name}'s profile.", { name: b.profileName }) : t("You asked to be reminded.");
    return {
      title: t("Out today: {title}", { title: b.title }),
      body: `${b.author ? `${t("By {author}.", { author: b.author })} ` : ""}${asked}`,
      url: `/books/${encodeURIComponent(b.volumeId)}`,
      tag: `release-${b.volumeId}`,
    };
  }
  const names = books.map((b) => b.title);
  const listed =
    names.length > 3
      ? t("{list} and {count} more", { list: names.slice(0, 3).join(", "), count: names.length - 3 })
      : t("{list} and {last}", { list: names.slice(0, -1).join(", "), last: names.at(-1) ?? "" });
  return { title: t("{count} books you were waiting for are out", { count: books.length }), body: listed, url: "/", tag: "release-several" };
}

export const PUSH_BATCH = 200;

export async function pushReleases(deps: PushDeps): Promise<PushTally> {
  const due = await deps.claim(PUSH_BATCH);
  const byUser = new Map<string, DuePush[]>();
  for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  return deliver(deps, new Map([...byUser].map(([user, books]) => [user, [releasePush(books)]])));
}
