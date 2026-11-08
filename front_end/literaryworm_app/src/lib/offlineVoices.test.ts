import { describe, expect, it } from "@jest/globals";
import { storageSize, voicePartsIn, voicesPrefix } from "./offlineVoices";

const ID = "u-0123456789abcdef0123456789abcdef";

describe("an upload's natural voice on this device", () => {
  it("counts only that upload's voiced parts", () => {
    const entries = [
      { path: `/uploads/${ID}.json`, bytes: 50_000 },
      { path: `${voicesPrefix(ID)}en-GB-Chirp3-HD-Aoede-0-0.mp3`, bytes: 400_000 },
      { path: `${voicesPrefix(ID)}en-GB-Chirp3-HD-Aoede-0-1-c1.mp3`, bytes: 300_000 },
      { path: `/uploads/u-ffffffffffffffffffffffffffffffff/voices/x-0-0.mp3`, bytes: 999_999 },
    ];
    expect(voicePartsIn(entries, ID)).toEqual({ parts: 2, bytes: 700_000 });
  });

  it("is empty with nothing kept", () => {
    expect(voicePartsIn([], ID)).toEqual({ parts: 0, bytes: 0 });
  });

  it("says sizes the way a phone does", () => {
    expect(storageSize(0)).toBe("1 KB");
    expect(storageSize(640_000)).toBe("640 KB");
    expect(storageSize(23_400_000)).toBe("23 MB");
    expect(storageSize(1_234_000_000)).toBe("1.2 GB");
  });
});
