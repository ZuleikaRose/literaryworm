// One-click unsubscribe links for emails members chose to get (the monthly What's new). A
// token is the account id and an HMAC-SHA256 of it, signed with the unsubscribe_secret kept
// in Vault, so a link works without signing in but only for its own account, and can't be
// made up or changed to another account.

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function sign(userId: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`whats-new:${userId}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "<account id>.<64 hex>". */
export async function unsubscribeToken(userId: string, key: string): Promise<string> {
  return `${userId}.${await sign(userId, key)}`;
}

/** The account a token is for, or null when it's malformed or the signature doesn't match. */
export async function checkUnsubscribeToken(token: unknown, key: string): Promise<string | null> {
  if (typeof token !== "string" || token.length > 120) return null;
  const [userId, given, extra] = token.split(".");
  if (extra !== undefined || !userId || !given || !UUID.test(userId) || !/^[0-9a-f]{64}$/.test(given)) return null;
  const expected = await sign(userId, key);
  // Compared in time that doesn't depend on where the strings differ.
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0 ? userId : null;
}
