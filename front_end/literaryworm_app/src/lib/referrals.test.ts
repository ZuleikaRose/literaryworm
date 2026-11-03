import { describe, expect, it } from "@jest/globals";
import { cleanReferralCode, monthsLeftToEarn, REFERRAL_MONTHS_MAX, referralLink } from "./referrals";

describe("refer a friend", () => {
  it("accepts a code from a link, whatever its case", () => {
    expect(cleanReferralCode(" abcd2345 ")).toBe("ABCD2345");
    expect(cleanReferralCode("ABCD2345")).toBe("ABCD2345");
  });

  it("refuses anything that can't be a code", () => {
    expect(cleanReferralCode("ABCD234")).toBeNull();
    expect(cleanReferralCode("ABCD23450")).toBeNull();
    expect(cleanReferralCode("ABCDO123")).toBeNull(); // O and 1 are never used
    expect(cleanReferralCode(null)).toBeNull();
    expect(cleanReferralCode("<script>")).toBeNull();
  });

  it("links to sign-up with the code", () => {
    expect(referralLink("ABCD2345", "https://www.literaryworm.com")).toBe("https://www.literaryworm.com/signup?ref=ABCD2345");
  });

  it("stops at 2 free months for inviting", () => {
    expect(REFERRAL_MONTHS_MAX).toBe(2);
    expect(monthsLeftToEarn(0)).toBe(2);
    expect(monthsLeftToEarn(1)).toBe(1);
    expect(monthsLeftToEarn(2)).toBe(0);
    expect(monthsLeftToEarn(5)).toBe(0);
  });
});
