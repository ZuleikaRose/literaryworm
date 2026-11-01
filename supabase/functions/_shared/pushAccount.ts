// Reaching an account's devices from any function: the push_subscriptions rows (service role),
// sending through _shared/webpush.ts, forgetting devices that have unsubscribed. The kinds an
// account wants are account_private.push_kinds (migration 6550).

import { serviceClient } from "./supabase.ts";
import { type PushMessage, type PushResult, sendPush } from "./webpush.ts";

export interface Device {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushKind = "release" | "meeting" | "club_posts" | "streak" | "request";

/** The database and push service behind release-emails/push.ts's DeviceDeps. */
export function serviceDeviceDeps() {
  return {
    async devices(userIds: string[]): Promise<Device[]> {
      if (userIds.length === 0) return [];
      const { data, error } = await serviceClient().from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
      if (error) throw error;
      return data.map((d) => ({ id: d.id, userId: d.user_id, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth }));
    },
    send: (device: Device, message: PushMessage): Promise<PushResult> => sendPush(device, message),
    async forget(ids: string[]) {
      const { error } = await serviceClient().from("push_subscriptions").delete().in("id", ids);
      if (error) throw error;
    },
    async touch(ids: string[]) {
      const { error } = await serviceClient().from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
  };
}

/**
 * Sends one notification to an account's devices if it keeps `kind` on. Never throws: a
 * notification is a courtesy, and whatever called this has already done its job.
 */
export async function notifyAccount(userId: string, kind: PushKind, message: PushMessage): Promise<void> {
  try {
    const { data, error } = await serviceClient().from("account_private").select("push_kinds").eq("user_id", userId).maybeSingle();
    if (error || !data || !(data.push_kinds as string[]).includes(kind)) return;
    const deps = serviceDeviceDeps();
    const devices = await deps.devices([userId]);
    const gone: string[] = [];
    const sent: string[] = [];
    for (const d of devices) {
      const result = await deps.send(d, message).catch(() => "failed" as const);
      if (result === "gone") gone.push(d.id);
      else if (result === "sent") sent.push(d.id);
    }
    if (gone.length) await deps.forget(gone);
    if (sent.length) await deps.touch(sent);
  } catch (err) {
    console.error(`push: couldn't notify account ${userId}`, err);
  }
}

/** A grown-up's answer to a Kids profile's book request. */
export function requestPush(profileName: string, title: string, bookId: string, approved: boolean): PushMessage {
  return approved
    ? { title: `${profileName} can read ${title}`, body: "A grown-up said yes to the request. It's on their Home now.", url: `/books/${encodeURIComponent(bookId)}`, tag: `request-${bookId}` }
    : { title: `${profileName}'s request: not this time`, body: `A grown-up said no to ${title} for now.`, url: "/", tag: `request-${bookId}` };
}
