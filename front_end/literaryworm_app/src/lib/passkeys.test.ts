import { describe, expect, it } from "@jest/globals";
import { PASSKEY_NAME_MAX, passkeyMessage, passkeyNameError, passkeysSupported, sortPasskeys, toPasskey } from "./passkeys";

describe("toPasskey", () => {
  it("keeps the name and dates Supabase sends", () => {
    expect(toPasskey({ id: "a", friendly_name: "iCloud Keychain", created_at: "2026-10-31T10:00:00Z", last_used_at: "2026-10-31T12:00:00Z" })).toEqual({
      id: "a",
      name: "iCloud Keychain",
      createdAt: Date.parse("2026-10-31T10:00:00Z"),
      lastUsedAt: Date.parse("2026-10-31T12:00:00Z"),
    });
  });

  it("names a passkey without a name, and copes with missing or bad dates", () => {
    const p = toPasskey({ id: "b", friendly_name: "  ", created_at: "not a date", last_used_at: null });
    expect(p.name).toBe("Passkey");
    expect(p.createdAt).toBe(0);
    expect(p.lastUsedAt).toBeNull();
    expect(toPasskey({ id: "c", created_at: "2026-01-01T00:00:00Z" }).lastUsedAt).toBeNull();
  });
});

describe("sortPasskeys", () => {
  it("puts the newest first without changing the list it's given", () => {
    const list = [
      { id: "old", name: "A", createdAt: 1, lastUsedAt: null },
      { id: "new", name: "B", createdAt: 3, lastUsedAt: null },
      { id: "mid", name: "C", createdAt: 2, lastUsedAt: null },
    ];
    expect(sortPasskeys(list).map((p) => p.id)).toEqual(["new", "mid", "old"]);
    expect(list.map((p) => p.id)).toEqual(["old", "new", "mid"]);
  });
});

describe("passkeyNameError", () => {
  it("needs 1 to 120 characters once trimmed", () => {
    expect(passkeyNameError("   ")).toMatch(/Enter a name/);
    expect(passkeyNameError("Work laptop")).toBeNull();
    expect(passkeyNameError("x".repeat(PASSKEY_NAME_MAX))).toBeNull();
    expect(passkeyNameError("x".repeat(PASSKEY_NAME_MAX + 1))).toMatch(/120 characters or fewer/);
    expect(passkeyNameError(`  ${"x".repeat(PASSKEY_NAME_MAX)}  `)).toBeNull();
  });
});

describe("passkeysSupported", () => {
  it("needs the WebAuthn API on a secure page", () => {
    function PublicKeyCredential() {}
    expect(passkeysSupported({ PublicKeyCredential, isSecureContext: true })).toBe(true);
    expect(passkeysSupported({ PublicKeyCredential, isSecureContext: false })).toBe(false);
    expect(passkeysSupported({ isSecureContext: true })).toBe(false);
    expect(passkeysSupported(undefined)).toBe(false);
  });
});

describe("passkeyMessage", () => {
  it("treats a closed prompt as a cancel, worded for adding or logging in", () => {
    expect(passkeyMessage({ code: "ERROR_CEREMONY_ABORTED" }, "add")).toBe("No passkey was added. Try again when you're ready.");
    expect(passkeyMessage({ name: "NotAllowedError" }, "signin")).toMatch(/cancelled/);
    expect(passkeyMessage({ code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: { name: "NotAllowedError" } }, "signin")).toMatch(/cancelled/);
  });

  it("explains Supabase's passkey errors", () => {
    expect(passkeyMessage({ code: "webauthn_credential_exists" }, "add")).toMatch(/already has a passkey/);
    expect(passkeyMessage({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" }, "add")).toMatch(/already has a passkey/);
    expect(passkeyMessage({ code: "too_many_passkeys" }, "add")).toMatch(/Remove one/);
    expect(passkeyMessage({ code: "webauthn_credential_not_found" }, "signin")).toMatch(/Account → Sign-in/);
    expect(passkeyMessage({ code: "webauthn_challenge_expired" }, "signin")).toBe("That took too long. Try again.");
    expect(passkeyMessage({ code: "email_not_confirmed" }, "signin")).toMatch(/Confirm your email/);
    expect(passkeyMessage({ code: "passkey_disabled" }, "signin")).toMatch(/aren't available/);
    expect(passkeyMessage({ code: "ERROR_INVALID_RP_ID" }, "add")).toMatch(/literaryworm\.com/);
  });

  it("covers rate limits, being offline and anything else", () => {
    expect(passkeyMessage({ status: 429 }, "signin")).toMatch(/Too many tries/);
    expect(passkeyMessage({ message: "Failed to fetch" }, "add")).toMatch(/connection/);
    expect(passkeyMessage({}, "add")).toBe("We couldn't add the passkey. Try again.");
    expect(passkeyMessage({}, "signin")).toMatch(/log in with your password/);
  });
});
