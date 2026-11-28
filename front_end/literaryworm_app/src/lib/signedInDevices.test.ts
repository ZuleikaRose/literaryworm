import { describe, expect, it } from "@jest/globals";
import { DEMO_HERE_ID, demoSignedInDevices, DEVICE_FRESH_MS, devicesForList, otherDevices } from "./signedInDevices";

describe("where you're logged in", () => {
  const now = 1_800_000_000_000;
  const devices = [
    { id: "old", label: "Firefox on Linux", lastSeenAt: now - 3_600_000 },
    { id: "here", label: "Chrome on Windows", lastSeenAt: now - 50_000 },
    { id: "phone", label: "Safari on iPhone", lastSeenAt: now - 10_000 },
  ];

  it("puts this device first, then the most recently seen", () => {
    expect(devicesForList(devices, "here", now).map((d) => d.id)).toEqual(["here", "phone", "old"]);
    expect(devicesForList(devices, null, now).map((d) => d.id)).toEqual(["phone", "here", "old"]);
  });

  it("says which are open now", () => {
    const list = devicesForList(devices, "here", now);
    expect(list.map((d) => d.open)).toEqual([true, true, false]);
    expect(devicesForList([{ id: "x", label: "X", lastSeenAt: now - DEVICE_FRESH_MS }], null, now)[0].open).toBe(false);
  });

  it("counts the other devices", () => {
    expect(otherDevices(devicesForList(devices, "here", now))).toBe(2);
    expect(otherDevices(devicesForList(devices, "nowhere", now))).toBe(3);
  });

  it("gives the demo a sample with this device first", () => {
    const list = devicesForList(demoSignedInDevices(now), DEMO_HERE_ID, now);
    expect(list[0].here).toBe(true);
    expect(otherDevices(list)).toBe(2);
  });
});
