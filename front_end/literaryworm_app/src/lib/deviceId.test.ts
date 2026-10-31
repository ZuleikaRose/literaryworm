import { describe, expect, it } from "@jest/globals";
import { DEVICE_STORAGE_KEY, type DeviceStorage, deviceIdFor, forgetDeviceId } from "./deviceId";

function memoryStorage(initial: Record<string, string> = {}): DeviceStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const ID_A = "0b6f1c3e-2d4a-4f5b-8c6d-7e8f9a0b1c2d";
const ID_B = "1c7a2d4f-3e5b-4a6c-9d7e-8f9a0b1c2d3e";

describe("deviceIdFor", () => {
  it("keeps the same id for the same member across visits", () => {
    const storage = memoryStorage();
    expect(deviceIdFor("ann", storage, () => ID_A)).toBe(ID_A);
    expect(deviceIdFor("ann", storage, () => ID_B)).toBe(ID_A);
    expect(JSON.parse(storage.data[DEVICE_STORAGE_KEY])).toEqual({ userId: "ann", id: ID_A });
  });

  it("gives another member on the same browser a new id", () => {
    const storage = memoryStorage({ [DEVICE_STORAGE_KEY]: JSON.stringify({ userId: "ann", id: ID_A }) });
    expect(deviceIdFor("sam", storage, () => ID_B)).toBe(ID_B);
    expect(JSON.parse(storage.data[DEVICE_STORAGE_KEY])).toEqual({ userId: "sam", id: ID_B });
  });

  it("replaces anything unreadable or not an id", () => {
    for (const bad of ["", "{}", "not json",JSON.stringify({ userId: "ann", id: "x'; drop" }), JSON.stringify(["ann"])]) {
      const storage = memoryStorage({ [DEVICE_STORAGE_KEY]: bad });
      expect(deviceIdFor("ann", storage, () => ID_B)).toBe(ID_B);
    }
  });

  it("still works when storage is missing or throws", () => {
    expect(deviceIdFor("ann", null, () => ID_A)).toBe(ID_A);
    const blocked: DeviceStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(deviceIdFor("ann", blocked, () => ID_B)).toBe(ID_B);
    expect(() => forgetDeviceId(blocked)).not.toThrow();
  });

  it("is forgotten at sign-out", () => {
    const storage = memoryStorage();
    deviceIdFor("ann", storage, () => ID_A);
    forgetDeviceId(storage);
    expect(storage.data[DEVICE_STORAGE_KEY]).toBeUndefined();
    expect(deviceIdFor("ann", storage, () => ID_B)).toBe(ID_B);
  });
});
