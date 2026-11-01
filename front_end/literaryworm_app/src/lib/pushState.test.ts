import { describe, expect, it } from "@jest/globals";
import { base64UrlToBytes, isPushKind, type PushEnvironment, pushState, toggleKind } from "./pushState";

const env = (overrides: Partial<PushEnvironment> = {}): PushEnvironment => ({
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  apple: false,
  standalone: false,
  subscribed: false,
  backend: true,
  production: true,
  ...overrides,
});

describe("pushState", () => {
  it("is off until the browser allows it and the device is subscribed", () => {
    expect(pushState(env())).toBe("off");
    expect(pushState(env({ permission: "granted" }))).toBe("off");
    expect(pushState(env({ permission: "granted", subscribed: true }))).toBe("on");
  });

  it("says when the browser blocks notifications", () => {
    expect(pushState(env({ permission: "denied" }))).toBe("blocked");
  });

  it("asks iPhone and iPad readers to add the app to the Home Screen first", () => {
    expect(pushState(env({ apple: true, hasPushManager: false, hasNotification: false }))).toBe("install-first");
    // In the Home Screen app, Safari offers it.
    expect(pushState(env({ apple: true, standalone: true }))).toBe("off");
  });

  it("isn't offered without the backend, a production build or the browser's support", () => {
    expect(pushState(env({ backend: false }))).toBe("unsupported");
    expect(pushState(env({ production: false }))).toBe("unsupported");
    expect(pushState(env({ hasServiceWorker: false }))).toBe("unsupported");
    expect(pushState(env({ hasPushManager: false }))).toBe("unsupported");
  });
});

describe("base64UrlToBytes", () => {
  it("decodes the app's public key to an uncompressed P-256 point", () => {
    const key = base64UrlToBytes("BMpYPJ6jc-6y83Uq2wk9Jqs4ix-WpHYIGbA_iJitoh1bA4UCwIuU5rkh4wj5OXuUbXC8bFeje_Ito_CCWbUdfsY");
    expect(key.length).toBe(65);
    expect(key[0]).toBe(4);
  });

  it("handles padding and the URL-safe letters", () => {
    expect([...base64UrlToBytes("-_8")]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes("YQ")]).toEqual([0x61]);
  });
});

describe("notification kinds", () => {
  it("turns one on or off and keeps the list in order", () => {
    expect(toggleKind(["streak", "release"], "meeting", true)).toEqual(["release", "meeting", "streak"]);
    expect(toggleKind(["release", "meeting"], "release", false)).toEqual(["meeting"]);
  });

  it("knows the kinds the database allows", () => {
    expect(isPushKind("club_posts")).toBe(true);
    expect(isPushKind("anything")).toBe(false);
  });
});
