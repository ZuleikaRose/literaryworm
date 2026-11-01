import { assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { b64urlToBytes, bytesToB64url, encryptPayload, sendPush, VAPID_PUBLIC_KEY, vapidAuthorization } from "./webpush.ts";

// RFC 8291, Appendix A: the worked example, with its fixed keys and salt.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function keyPair(publicKey: string, d: string): Promise<CryptoKeyPair> {
  const pub = b64urlToBytes(publicKey);
  const jwk = { kty: "EC", crv: "P-256", x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true };
  return {
    publicKey: await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []),
    privateKey: await crypto.subtle.importKey("jwk", { ...jwk, d }, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
  };
}

Deno.test("encrypts exactly as RFC 8291's worked example", async () => {
  const body = await encryptPayload(
    { p256dh: RFC.uaPublic, auth: RFC.authSecret },
    new TextEncoder().encode(RFC.plaintext),
    await keyPair(RFC.asPublic, RFC.asPrivate),
    b64urlToBytes(RFC.salt),
  );
  assertEquals(bytesToB64url(body), RFC.body);
});

Deno.test("signs a VAPID token the public key verifies, for the push service's origin", async () => {
  // A throwaway pair stands in for the real one: same code path, checked against its own public key.
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", jwk.d!, 1_000_000, bytesToB64url(raw));
  const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
  const [, h, claims, sig, k] = match;
  assertEquals(k, bytesToB64url(raw));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(claims)));
  assertEquals(payload.aud, "https://fcm.googleapis.com");
  assertEquals(payload.exp, 1_000_000 + 12 * 3600);
  assertMatch(payload.sub, /^mailto:/);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${claims}`));
  assertEquals(ok, true);
});

Deno.test("the app's public key is a P-256 point", () => {
  const raw = b64urlToBytes(VAPID_PUBLIC_KEY);
  assertEquals(raw.length, 65);
  assertEquals(raw[0], 4);
});

Deno.test("reports an unsubscribed browser as gone, and sends the encrypted body", async () => {
  const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const p256dh = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey)));
  const auth = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
  const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  Deno.env.set("VAPID_PRIVATE_KEY", (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d!);
  Deno.env.set("VAPID_PUBLIC_KEY", bytesToB64url(new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey))));
  const seen: RequestInit[] = [];
  const respond = (status: number) => ((_url: string | URL | Request, init?: RequestInit) => {
    seen.push(init!);
    return Promise.resolve(new Response(null, { status }));
  }) as typeof fetch;
  const sub = { endpoint: "https://push.example/abc", p256dh, auth };
  const message = { title: "Out today", body: "Dune", url: "/books/dune" };
  assertEquals(await sendPush(sub, message, respond(201)), "sent");
  assertEquals(await sendPush(sub, message, respond(410)), "gone");
  assertEquals(await sendPush(sub, message, respond(500)), "failed");
  assertEquals(await sendPush({ ...sub, endpoint: "http://push.example/abc" }, message, respond(201)), "gone");
  const headers = seen[0].headers as Record<string, string>;
  assertEquals(headers["Content-Encoding"], "aes128gcm");
  assertMatch(headers.Authorization, /^vapid t=/);
  Deno.env.delete("VAPID_PRIVATE_KEY");
  Deno.env.delete("VAPID_PUBLIC_KEY");
});
