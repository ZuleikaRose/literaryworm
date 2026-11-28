/**
 * Where you're logged in (Account → Sign-in, components/SignedInDevices.tsx): the account's
 * devices (listening_devices, which keeps every open copy of the app for a day), this one first.
 * Pure, so it's tested without a backend.
 */

/** A device counts as open if it checked in within this long (it checks in every minute). */
export const DEVICE_FRESH_MS = 150_000;

export interface SeenDevice {
  id: string;
  label: string;
  lastSeenAt: number;
}

export interface DeviceListItem extends SeenDevice {
  /** This browser. */
  here: boolean;
  /** Checked in within the last couple of minutes. */
  open: boolean;
}

/** This device first, then the others, most recently seen first. */
export function devicesForList(devices: SeenDevice[], hereId: string | null, now: number): DeviceListItem[] {
  return devices
    .map((d) => ({ ...d, here: d.id === hereId, open: d.id === hereId || now - d.lastSeenAt < DEVICE_FRESH_MS }))
    .sort((a, b) => Number(b.here) - Number(a.here) || b.lastSeenAt - a.lastSeenAt);
}

/** How many devices "Log out on every other device" would log out. */
export const otherDevices = (items: DeviceListItem[]) => items.filter((d) => !d.here).length;

/** The demo household's sample list: nothing is ever logged out. */
export function demoSignedInDevices(now: number): SeenDevice[] {
  return [
    { id: "demo-here", label: "Chrome on Windows", lastSeenAt: now },
    { id: "demo-phone", label: "Safari on iPhone", lastSeenAt: now - 60_000 },
    { id: "demo-tablet", label: "Chrome on Android", lastSeenAt: now - 5 * 3_600_000 },
  ];
}
export const DEMO_HERE_ID = "demo-here";
