import { deviceLabel } from "./devicesApi";
import { base64UrlToBytes, isPushKind, PUSH_KINDS, type PushKind, type PushState, pushState } from "./pushState";
import { supabase } from "./supabase";

export type { PushState } from "./pushState";

/**
 * Notifications on this device (Web Push), for members: a book they asked to be reminded about
 * comes out. The browser subscribes with the app's public VAPID key and the database keeps the
 * subscription (save_push_subscription(), push_subscriptions); the release-emails function sends,
 * and public/sw.js shows them. Needs the service worker, so only production builds offer it. On
 * iPhone and iPad, Safari offers it only in the app added to the Home Screen.
 */

/** Public by design (the browser needs it); supabase/functions/_shared/webpush.ts has the same. */
export const VAPID_PUBLIC_KEY = "BMpYPJ6jc-6y83Uq2wk9Jqs4ix-WpHYIGbA_iJitoh1bA4UCwIuU5rkh4wj5OXuUbXC8bFeje_Ito_CCWbUdfsY";

const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return (await reg?.pushManager?.getSubscription()) ?? null;
}

/** This device's state, read from the browser. */
export async function readPushState(): Promise<PushState> {
  const hasNotification = typeof Notification !== "undefined";
  return pushState({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
    apple: isApple(),
    standalone: isStandalone(),
    subscribed: Boolean(await currentSubscription().catch(() => null)),
    backend: Boolean(supabase),
    production: import.meta.env.PROD,
  });
}

export class PushError extends Error {}

/** Asks the browser, subscribes, and saves this device for the account. */
export async function turnOnPush(): Promise<void> {
  if (!supabase) throw new PushError("Notifications need the LiteraryWorm backend.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new PushError(permission === "denied" ? "Your browser is blocking notifications from LiteraryWorm. Allow them in its site settings, then try again." : "Notifications weren't turned on.");
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  const keys = sub.toJSON().keys ?? {};
  if (!keys.p256dh || !keys.auth) throw new PushError("This browser didn't give the keys notifications need. Try another browser.");
  // The time zone sets "evening" for the streak nudge.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_label: deviceLabel(), p_time_zone: zone });
  if (error) {
    await sub.unsubscribe().catch(() => undefined);
    throw new PushError(error.message.includes("20 devices") ? error.message : "We couldn't turn on notifications. Try again.");
  }
}

/** Stops notifications on this device: the browser's subscription and the account's row. */
export async function turnOffPush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  if (supabase) {
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    if (error) throw new PushError("We couldn't turn off notifications. Try again.");
  }
  await sub.unsubscribe().catch(() => undefined);
}

/** At sign-out: a shared device stops getting this account's notifications. Never throws. */
export async function forgetPushOnSignOut(): Promise<void> {
  await turnOffPush().catch((err: unknown) => console.error("notifications: couldn't turn off at sign-out:", err));
}

/** The kinds of notification the account's devices get (account_private.push_kinds). */
export async function loadPushKinds(): Promise<PushKind[]> {
  if (!supabase) return [...PUSH_KINDS.map((k) => k.id)];
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("account_private").select("push_kinds").eq("user_id", auth.user?.id ?? "").maybeSingle();
  if (error || !data) throw new PushError("We couldn't load which notifications you get.");
  return (data.push_kinds as string[]).filter(isPushKind);
}

export async function savePushKinds(kinds: PushKind[]): Promise<void> {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("account_private").update({ push_kinds: kinds }).eq("user_id", auth.user?.id ?? "");
  if (error) throw new PushError("We couldn't save that. Try again.");
}
