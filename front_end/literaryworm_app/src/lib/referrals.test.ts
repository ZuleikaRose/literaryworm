import { describe, expect, it } from "@jest/globals";
import {
  cleanReferralCode,
  type InviterHistory,
  inviterCredit,
  type Member,
  OLD_REFERRAL_MONTHS_MAX,
  REFERRAL_SHARE_PERCENT,
  referralCreditCents,
  referralLink,
  referralReward,
  referralSideCents,
  owedTransaction,
  refundTakesBack,
  ruleAtCutover,
} from "./referrals";

// The plans' prices in cents (public.plans: Basic $30, Standard $40, Premium $60 a month; yearly ten times).
const BASIC = { monthlyCents: 3000, yearlyCents: 30000 };
const STANDARD = { monthlyCents: 4000, yearlyCents: 40000 };
const PREMIUM = { monthlyCents: 6000, yearlyCents: 60000 };

const FRIEND_ID = "friend";
const INVITER_ID = "inviter";
const NO_HISTORY: InviterHistory = { freeMonths: 0, hasPercentCredit: false };

const member = (id: string, plan: Member["plan"], staff = false): Member => ({ id, staff, plan });
const friendOn = (plan: Member["plan"]) => member(FRIEND_ID, plan);
const inviterOn = (plan: Member["plan"]) => member(INVITER_ID, plan);

describe("refer a friend: codes and links", () => {
  it("accepts a code from a link, whatever its case", () => {
    expect(cleanReferralCode(" abcd2345 ")).toBe("ABCD2345");
    expect(cleanReferralCode("ABCD2345")).toBe("ABCD2345");
  });

  it("refuses anything that can't be a code", () => {
    expect(cleanReferralCode("ABCD234")).toBeNull();
    expect(cleanReferralCode("ABCD23450")).toBeNull();
    expect(cleanReferralCode("ABCDO123")).toBeNull(); // O and 1 are never used
    expect(cleanReferralCode(null)).toBeNull();
    expect(cleanReferralCode(undefined)).toBeNull();
    expect(cleanReferralCode("")).toBeNull();
    expect(cleanReferralCode("<script>")).toBeNull();
  });

  it("links to sign-up with the code", () => {
    expect(referralLink("ABCD2345", "https://www.literaryworm.com")).toBe("https://www.literaryworm.com/signup?ref=ABCD2345");
  });
});

describe("refer a friend: 20% of one month", () => {
  it("is 20%", () => {
    expect(REFERRAL_SHARE_PERCENT).toBe(20);
  });

  it("takes 20% of the monthly price on monthly billing", () => {
    expect(referralCreditCents(BASIC, "month")).toBe(600);
    expect(referralCreditCents(STANDARD, "month")).toBe(800);
    expect(referralCreditCents(PREMIUM, "month")).toBe(1200);
  });

  it("takes 20% of a twelfth of the yearly price on yearly billing", () => {
    expect(referralCreditCents(BASIC, "year")).toBe(500);
    expect(referralCreditCents(STANDARD, "year")).toBe(667); // 400.00 / 12 × 20% = 6.666…
    expect(referralCreditCents(PREMIUM, "year")).toBe(1000);
  });

  it("rounds to the cent, half up", () => {
    const ODD_MONTHLY_CENTS = 1299; // 259.8
    const YEARLY_HALF_CENTS = 30; // 30 / 60 = 0.5, rounds up
    const YEARLY_JUST_UNDER_HALF_CENTS = 29; // 0.48… rounds to nothing, so there's no credit
    expect(referralCreditCents({ monthlyCents: ODD_MONTHLY_CENTS, yearlyCents: null }, "month")).toBe(260);
    expect(referralCreditCents({ monthlyCents: null, yearlyCents: YEARLY_HALF_CENTS }, "year")).toBe(1);
    expect(referralCreditCents({ monthlyCents: 3, yearlyCents: YEARLY_JUST_UNDER_HALF_CENTS }, "year")).toBeNull();
    expect(referralCreditCents({ monthlyCents: 1003, yearlyCents: null }, "month")).toBe(201); // 200.6
    expect(referralCreditCents({ monthlyCents: 1002, yearlyCents: null }, "month")).toBe(200); // 200.4
  });

  it("uses the monthly price for a yearly plan with no yearly price", () => {
    expect(referralCreditCents({ monthlyCents: 3000, yearlyCents: null }, "year")).toBe(600);
  });

  it("gives nothing without a price, or when it rounds to nothing", () => {
    expect(referralCreditCents({ monthlyCents: 2, yearlyCents: null }, "month")).toBeNull(); // 0.4
    expect(referralCreditCents({ monthlyCents: 3, yearlyCents: null }, "month")).toBe(1); // 0.6
    expect(referralCreditCents(null, "month")).toBeNull();
    expect(referralCreditCents(undefined, "year")).toBeNull();
    expect(referralCreditCents({ monthlyCents: null, yearlyCents: null }, "month")).toBeNull();
    expect(referralCreditCents({ monthlyCents: 0, yearlyCents: 0 }, "year")).toBeNull();
    expect(referralCreditCents({ monthlyCents: -3000, yearlyCents: -30000 }, "year")).toBeNull();
    expect(referralCreditCents({ monthlyCents: Number.NaN, yearlyCents: undefined }, "month")).toBeNull();
  });

  it("reads a missing billing interval as monthly", () => {
    expect(referralCreditCents(BASIC, null)).toBe(600);
    expect(referralCreditCents(BASIC, undefined)).toBe(600);
  });

  it("keeps the old free month at the monthly price, yearly or not", () => {
    expect(referralSideCents("free_month", BASIC, "month")).toBe(3000);
    expect(referralSideCents("free_month", BASIC, "year")).toBe(3000);
    expect(referralSideCents("free_month", null, "month")).toBeNull();
    expect(referralSideCents("percent_20", PREMIUM, "year")).toBe(1000);
  });
});

describe("refer a friend: who gets what", () => {
  const monthly = (prices: typeof BASIC) => ({ ...prices, interval: "month" as const });
  const yearly = (prices: typeof BASIC) => ({ ...prices, interval: "year" as const });

  it("gives the friend and the inviter 20% of their own plans", () => {
    expect(referralReward("percent_20", friendOn(monthly(BASIC)), inviterOn(yearly(PREMIUM)), NO_HISTORY)).toEqual({
      friendCents: 600,
      referrerCents: 1000,
      referrerSkipped: null,
    });
  });

  it("gives the inviter nothing more for a second friend, while that friend still gets theirs", () => {
    const afterFirst: InviterHistory = { freeMonths: 0, hasPercentCredit: true };
    expect(referralReward("percent_20", friendOn(monthly(STANDARD)), inviterOn(monthly(BASIC)), afterFirst)).toEqual({
      friendCents: 800,
      referrerCents: null,
      referrerSkipped: "already_credited",
    });
  });

  it("gives nothing for inviting yourself", () => {
    const self = member(INVITER_ID, monthly(BASIC));
    expect(referralReward("percent_20", self, self, NO_HISTORY)).toEqual({ friendCents: null, referrerCents: null, referrerSkipped: "self" });
  });

  it("never rewards staff, on either side", () => {
    expect(referralReward("percent_20", member(FRIEND_ID, monthly(BASIC), true), inviterOn(monthly(BASIC)), NO_HISTORY)).toEqual({
      friendCents: null,
      referrerCents: null,
      referrerSkipped: "staff",
    });
    expect(referralReward("percent_20", friendOn(monthly(BASIC)), member(INVITER_ID, monthly(BASIC), true), NO_HISTORY).referrerSkipped).toBe("staff");
  });

  it("waits while the friend has no paid membership", () => {
    expect(referralReward("percent_20", friendOn(null), inviterOn(monthly(BASIC)), NO_HISTORY)).toEqual({
      friendCents: null,
      referrerCents: null,
      referrerSkipped: null,
    });
  });

  it("credits only the friend when the inviter has no paid membership", () => {
    expect(referralReward("percent_20", friendOn(monthly(BASIC)), inviterOn(null), NO_HISTORY)).toEqual({
      friendCents: 600,
      referrerCents: null,
      referrerSkipped: "no_membership",
    });
  });

  it("doesn't count free months earned before the change against the one 20% credit", () => {
    const oldMonths: InviterHistory = { freeMonths: OLD_REFERRAL_MONTHS_MAX, hasPercentCredit: false };
    expect(referralReward("percent_20", friendOn(monthly(BASIC)), inviterOn(monthly(STANDARD)), oldMonths)).toEqual({
      friendCents: 600,
      referrerCents: 800,
      referrerSkipped: null,
    });
  });

  it("honours a free month earned before the change, up to the old 2 for inviting", () => {
    expect(referralReward("free_month", friendOn(monthly(BASIC)), inviterOn(yearly(STANDARD)), NO_HISTORY)).toEqual({
      friendCents: 3000,
      referrerCents: 4000,
      referrerSkipped: null,
    });
    expect(referralReward("free_month", friendOn(monthly(BASIC)), inviterOn(monthly(STANDARD)), { freeMonths: OLD_REFERRAL_MONTHS_MAX, hasPercentCredit: false }).referrerSkipped).toBe(
      "limit_reached",
    );
  });
});

describe("refer a friend: the cut-over", () => {
  it("keeps the free month for a referral rewarded before the change", () => {
    expect(ruleAtCutover({ rewardedAt: "2026-11-20T10:00:00Z" })).toBe("free_month");
  });

  it("keeps the free month for a friend who paid before the change, even if the claim was handed back", () => {
    expect(ruleAtCutover({ rewardedAt: null, friendPaidAt: "2026-11-20T10:00:00Z" })).toBe("free_month");
    expect(ruleAtCutover({ rewardedAt: null, creditRecorded: true })).toBe("free_month");
  });

  it("gives 20% to a referral whose friend hadn't paid yet, and to every new one", () => {
    expect(ruleAtCutover({ rewardedAt: null, creditRecorded: false, friendPaidAt: null })).toBe("percent_20");
    expect(ruleAtCutover({})).toBe("percent_20");
    expect(ruleAtCutover(null)).toBe("percent_20");
    expect(ruleAtCutover(undefined)).toBe("percent_20");
    expect(ruleAtCutover({ rewardedAt: "" })).toBe("percent_20");
  });
});

describe("refer a friend: what each side is still owed", () => {
  const NONE = { credit: null, reversal: null, recredit: null };
  const CREDITED = { ...NONE, credit: "cbtxn_1" };
  const REVERSED = { ...CREDITED, reversal: "cbtxn_2" };
  const ACTIVE = { reversed: false, round: 0 };
  const TAKEN_BACK = { reversed: true, round: 1 };
  const GIVEN_AGAIN = { reversed: false, round: 1 };

  it("owes a credit until it's made, and never twice", () => {
    expect(owedTransaction("percent_20", NONE, ACTIVE)).toBe("credit");
    expect(owedTransaction("percent_20", CREDITED, ACTIVE)).toBeNull();
    expect(owedTransaction("free_month", NONE, ACTIVE)).toBe("credit");
  });

  it("takes a made credit back once; one never made is never made", () => {
    expect(owedTransaction("percent_20", CREDITED, TAKEN_BACK)).toBe("reversal");
    expect(owedTransaction("percent_20", REVERSED, TAKEN_BACK)).toBeNull();
    expect(owedTransaction("percent_20", NONE, TAKEN_BACK)).toBeNull();
  });

  it("gives it again after a won dispute, once", () => {
    expect(owedTransaction("percent_20", REVERSED, GIVEN_AGAIN)).toBe("recredit");
    expect(owedTransaction("percent_20", { ...REVERSED, recredit: "cbtxn_3" }, GIVEN_AGAIN)).toBeNull();
    expect(owedTransaction("percent_20", NONE, GIVEN_AGAIN)).toBe("credit");
  });

  it("never takes a free month back", () => {
    expect(owedTransaction("free_month", CREDITED, TAKEN_BACK)).toBeNull();
  });

  it("takes back only on a full refund of the payment that earned it", () => {
    expect(refundTakesBack("percent_20", true, "in_1", "in_1")).toBe(true);
    expect(refundTakesBack("percent_20", false, "in_1", "in_1")).toBe(false);
    expect(refundTakesBack("percent_20", true, "in_2", "in_1")).toBe(false);
    expect(refundTakesBack("percent_20", true, null, null)).toBe(false);
    expect(refundTakesBack("free_month", true, "in_1", "in_1")).toBe(false);
  });
});

describe("refer a friend: the inviter's credit on Account", () => {
  it("is earned once it's added", () => {
    expect(inviterCredit(600, 0)).toBe("earned");
    expect(inviterCredit(600, 2)).toBe("earned");
  });

  it("is pending while a friend who signed up hasn't paid", () => {
    expect(inviterCredit(null, 1)).toBe("pending");
    expect(inviterCredit(null, 1, true)).toBe("pending");
  });

  it("says when the credit was taken back, even with friends still to pay", () => {
    expect(inviterCredit(null, 0, true, true)).toBe("taken_back");
    expect(inviterCredit(null, 2, false, true)).toBe("taken_back");
    expect(inviterCredit(800, 0, true, true)).toBe("earned");
  });

  it("needs a paid plan when the member has none while a friend is still to pay", () => {
    expect(inviterCredit(null, 1, false)).toBe("needs_plan");
    expect(inviterCredit(600, 1, false)).toBe("earned");
    expect(inviterCredit(null, 0, false)).toBe("none");
  });

  it("is none with no friends waiting, or nothing to read", () => {
    expect(inviterCredit(null, 0)).toBe("none");
    expect(inviterCredit(undefined, undefined)).toBe("none");
    expect(inviterCredit(0, 0)).toBe("none");
  });
});
