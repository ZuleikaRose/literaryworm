// Which of a member's devices this browser is (listening_devices.id), kept in local storage so a
// refresh or a second tab is the same device rather than a new one. It holds a random id and the
// member it's for, nothing else; signing out removes it. Where storage is blocked, each visit is a
// device, as before.

export const DEVICE_STORAGE_KEY = "literaryworm-device";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The bit of Storage this needs (so tests can pass a stand-in). */
export type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): DeviceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * This browser's device id for the member: the kept one when it's theirs, else a new one, kept for
 * next time. Another member's id is replaced (ids are unique across accounts).
 */
export function deviceIdFor(userId: string, storage: DeviceStorage | null = browserStorage(), make: () => string = () => crypto.randomUUID()): string {
  try {
    const kept = JSON.parse(storage?.getItem(DEVICE_STORAGE_KEY) ?? "null") as { userId?: unknown; id?: unknown } | null;
    if (kept && kept.userId === userId && typeof kept.id === "string" && UUID.test(kept.id)) return kept.id;
  } catch {
    // Unreadable: make a new one.
  }
  const id = make();
  try {
    storage?.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ userId, id }));
  } catch {
    // Storage blocked or full: this visit is a device of its own.
  }
  return id;
}

/** Forgets this browser's device id (at sign-out). */
export function forgetDeviceId(storage: DeviceStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(DEVICE_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}
