// Web Push, with nothing but Web Crypto: the message is encrypted for the browser (RFC 8291,
// aes128gcm) and the request signed with the app's VAPID key (RFC 8292), so the browser's push
// service (Google, Apple, Mozilla or Microsoft) only ever carries ciphertext.
//
// VAPID_PUBLIC_KEY below is public (the browser needs it to subscribe; src/lib/push.ts has the
// same). The private half is the VAPID_PRIVATE_KEY function setting (the key's `d`, base64url),
// never in the repo.

export const VAPID_PUBLIC_KEY = "BMpYPJ6jc-6y83Uq2wk9Jqs4ix-WpHYIGbA_iJitoh1bA4UCwIuU5rkh4wj5OXuUbXC8bFeje_Ito_CCWbUdfsY";
const VAPID_SUBJECT = "mailto:hello@literaryworm.com";

export interface PushSubscriptionKeys {
  endpoint: string;
  /** The browser's public key (base64url, 65 bytes uncompressed). */
  p256dh: string;
  /** The browser's auth secret (base64url, 16 bytes). */
  auth: string;
}

const enc = new TextEncoder();

export function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function bytesToB64url(bytes: Uint8Array<ArrayBuffer>): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** HKDF-SHA-256 with one block of output, which is all RFC 8291 needs. */
async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/**
 * Encrypts `payload` for one browser (RFC 8291 / RFC 8188, a single aes128gcm record).
 * `local` and `salt` are for tests; otherwise a fresh key and salt are made each time.
 */
export async function encryptPayload(
  sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  payload: Uint8Array<ArrayBuffer>,
  local?: CryptoKeyPair,
  salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16)),
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("That push subscription's keys aren't valid.");
  const keys = local ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // The record: the payload, then 0x02 (the last record's delimiter).
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, sealed);
}

/** The VAPID Authorization header for a push service (a JWT signed with ES256, 12 hours). */
export async function vapidAuthorization(
  endpoint: string,
  privateKeyD: string,
  now = Math.floor(Date.now() / 1000),
  publicKey = VAPID_PUBLIC_KEY,
): Promise<string> {
  const pub = b64urlToBytes(publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: privateKeyD, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const part = (o: unknown) => bytesToB64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: VAPID_SUBJECT })}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${bytesToB64url(signature)}, k=${publicKey}`;
}

/** What a notification shows: the service worker (public/sw.js) reads these fields. */
export interface PushMessage {
  title: string;
  body: string;
  /** A path on the site, opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
}

export type PushResult = "sent" | "gone" | "failed";

/**
 * Sends one notification. "gone" means the browser has unsubscribed (404 or 410): delete the
 * subscription. Push services are only https endpoints the browser gave us.
 */
export async function sendPush(sub: PushSubscriptionKeys, message: PushMessage, fetcher: typeof fetch = fetch): Promise<PushResult> {
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!privateKey) throw new Error("Missing environment variable VAPID_PRIVATE_KEY");
  if (!sub.endpoint.startsWith("https://")) return "gone";
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)));
  const res = await fetcher(sub.endpoint, {
    method: "POST",
    headers: {
      // VAPID_PUBLIC_KEY may be set to go with a different private key (tests); the app's otherwise.
      Authorization: await vapidAuthorization(sub.endpoint, privateKey, undefined, Deno.env.get("VAPID_PUBLIC_KEY") ?? VAPID_PUBLIC_KEY),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 3600),
      Urgency: "normal",
    },
    body,
  });
  await res.body?.cancel();
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "sent" : "failed";
}
