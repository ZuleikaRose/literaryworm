import { AccountError } from "./accountApi";
import { tr } from "./i18n";
import type { ReferralRule } from "./referrals";
import { supabase } from "./supabase";

/** Refer a friend for members (migrations 6657, 6843): the member's code and how their invitations went. */
function client() {
  if (!supabase) throw new AccountError(tr("Inviting friends needs the LiteraryWorm backend, which isn't set up in this copy of the app."));
  return supabase;
}

export interface ReferralStatus {
  code: string;
  /** Friends who signed up with the code. */
  signedUp: number;
  /** Of those, how many have made their first payment. */
  joined: number;
  /** Free months earned for inviting under the old offer (before 2026-11-23); they stay. */
  monthsEarned: number;
  /** The member's one 20% inviting credit, in cents, once it's added. */
  creditCents: number | null;
  /** Friends who signed up and haven't made their first payment yet. */
  waiting: number;
  /** Whether the member has a paid plan now (the 20% goes only to an inviter with one when the friend pays). */
  hasPaidPlan: boolean;
  /** When this member joined with someone's invitation: which offer, whether their own credit was added, and whether it was taken back. */
  invited: { rule: ReferralRule; rewarded: boolean; creditCents: number | null; reversed: boolean } | null;
}

interface CountsRow {
  signed_up: number;
  rewarded: number;
  months_earned: number;
  credit_cents?: number | null;
  waiting?: number | null;
  has_paid_plan?: boolean | null;
}

interface OwnRow {
  rewarded_at: string | null;
  reward_rule?: ReferralRule | null;
  friend_credit_cents?: number | null;
  reversed_at?: string | null;
}

export async function loadReferrals(): Promise<ReferralStatus> {
  const db = client();
  const [code, counts, own] = await Promise.all([
    db.rpc("my_referral_code"),
    db.rpc("my_referrals"),
    db.from("referrals").select("rewarded_at, reward_rule, friend_credit_cents, reversed_at").limit(1),
  ]);
  if (code.error || counts.error) throw new AccountError(tr("We couldn't load your invitation link. Try again."));
  const c = ((counts.data ?? [])[0] ?? { signed_up: 0, rewarded: 0, months_earned: 0 }) as CountsRow;
  const mine = (own.data ?? [])[0] as OwnRow | undefined;
  return {
    code: code.data as string,
    signedUp: c.signed_up,
    joined: c.rewarded,
    monthsEarned: c.months_earned,
    creditCents: c.credit_cents ?? null,
    waiting: c.waiting ?? Math.max(0, c.signed_up - c.rewarded),
    hasPaidPlan: c.has_paid_plan ?? true,
    invited: mine
      ? {
          rule: mine.reward_rule ?? "percent_20",
          rewarded: Boolean(mine.rewarded_at),
          creditCents: mine.friend_credit_cents ?? null,
          reversed: Boolean(mine.reversed_at),
        }
      : null,
  };
}
