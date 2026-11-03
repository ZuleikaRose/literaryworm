import { AccountError } from "./accountApi";
import { tr } from "./i18n";
import { supabase } from "./supabase";

/** Refer a friend for members (migration 6657): the member's code and how their invitations went. */
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
  /** Free months earned for inviting (at most 2). */
  monthsEarned: number;
  /** When this member joined with someone's invitation: whether their own free month has been added. */
  invited: { rewarded: boolean } | null;
}

export async function loadReferrals(): Promise<ReferralStatus> {
  const db = client();
  const [code, counts, own] = await Promise.all([
    db.rpc("my_referral_code"),
    db.rpc("my_referrals"),
    db.from("referrals").select("rewarded_at").limit(1),
  ]);
  if (code.error || counts.error) throw new AccountError(tr("We couldn't load your invitation link. Try again."));
  const c = ((counts.data ?? [])[0] ?? { signed_up: 0, rewarded: 0, months_earned: 0 }) as { signed_up: number; rewarded: number; months_earned: number };
  const mine = (own.data ?? [])[0] as { rewarded_at: string | null } | undefined;
  return {
    code: code.data as string,
    signedUp: c.signed_up,
    joined: c.rewarded,
    monthsEarned: c.months_earned,
    invited: mine ? { rewarded: Boolean(mine.rewarded_at) } : null,
  };
}
