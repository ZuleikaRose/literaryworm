import { claimOfflineDevice, hasOfflineDevice, type OfflineClaim } from "./accountApi";
import { deviceLabel } from "./devicesApi";
import { clearOfflineBooks, readOfflinePlace, writeOfflinePlace } from "./offline";

/**
 * A member's devices that keep books with Read offline each hold one of their plan's places
 * (Basic 1, Standard 3, Premium 5). The database gives them out (claim_offline_device()); the
 * device remembers its own next to its books (lib/offline.ts). In-memory accounts don't use this.
 */

/** Takes (or confirms) this device's place before saving a book; `full` lists the devices holding them. */
export async function takeOfflinePlace(userId: string): Promise<OfflineClaim> {
  const held = await readOfflinePlace();
  const id = held?.userId === userId ? held.id : crypto.randomUUID();
  const claim = await claimOfflineDevice(id, deviceLabel());
  if (claim.status === "ok" && held?.id !== id) {
    // Books another account saved here go too: this device is now this member's place.
    if (held) await clearOfflineBooks();
    await writeOfflinePlace({ id, userId });
  }
  return claim;
}

/**
 * When a member opens the app: if this device's place was freed (from another device, or the
 * plan changed), its offline books are removed. Returns whether they were.
 */
export async function checkOfflinePlace(userId: string): Promise<boolean> {
  const held = await readOfflinePlace();
  if (!held || held.userId !== userId) return false;
  if (await hasOfflineDevice(held.id)) return false;
  await clearOfflineBooks();
  return true;
}
