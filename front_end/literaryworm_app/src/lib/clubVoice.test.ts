import { describe, expect, it } from "@jest/globals";
import { CHARACTERS_PER_MINUTE, CLUB_VOICE_MINUTES, clubVoiceLeft, isClubVoiceMinutes } from "./clubVoice";

describe("club listening hours", () => {
  it("offers the database's choices only", () => {
    expect(CLUB_VOICE_MINUTES).toEqual([30, 60, 120, 180]);
    expect(isClubVoiceMinutes(60)).toBe(true);
    expect(isClubVoiceMinutes(45)).toBe(false);
    expect(isClubVoiceMinutes("60")).toBe(false);
    expect(isClubVoiceMinutes(null)).toBe(false);
  });

  it("counts 840 characters a minute, as the database does", () => {
    expect(CHARACTERS_PER_MINUTE).toBe(840);
  });

  it("gives what's used and left this month, never past the gift", () => {
    expect(clubVoiceLeft(60, 0)).toEqual({ used: 0, left: 60 });
    expect(clubVoiceLeft(60, 840 * 25)).toEqual({ used: 25, left: 35 });
    expect(clubVoiceLeft(30, 840 * 90)).toEqual({ used: 30, left: 0 });
    expect(clubVoiceLeft(30, -5)).toEqual({ used: 0, left: 30 });
  });

  it("is null when the club gives no hours", () => {
    expect(clubVoiceLeft(null, 100)).toBeNull();
    expect(clubVoiceLeft(undefined, 0)).toBeNull();
    expect(clubVoiceLeft(0, 0)).toBeNull();
  });
});
