// The affiliate program for members and sales staff (migration 6679): apply, see how the link is
// doing (counts only), and for staff, review applications. Clicks are counted by the
// affiliate-click Edge Function. Nothing here is sent anywhere but our own backend.

import { AccountError } from "./accountApi";
import type { AffiliateStatus } from "./affiliates";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { tr } from "./i18n";
import { supabase } from "./supabase";

function client() {
  if (!supabase) throw new AccountError(tr("The affiliate program needs the LiteraryWorm backend, which isn't set up in this copy of the app."));
  return supabase;
}

export interface AffiliateStats {
  clicks30Days: number;
  clicksTotal: number;
  signedUp: number;
  paid: number;
  earnedCents: number;
}

export interface MyAffiliate {
  status: AffiliateStatus;
  website: string;
  channels: string;
  code: string | null;
  appliedAt: string;
  stats: AffiliateStats | null;
}

/** The demo household's sample: an approved affiliate with a few weeks of results. */
export const DEMO_AFFILIATE: MyAffiliate = {
  status: "approved",
  website: "https://averyreads.example",
  channels: "A monthly reading newsletter and short book videos.",
  code: "AVERYREAD2",
  appliedAt: "2026-10-01T09:00:00Z",
  stats: { clicks30Days: 48, clicksTotal: 131, signedUp: 6, paid: 4, earnedCents: 1600 },
};

/** The member's application and, once approved, their link's counts; null when they haven't applied. */
export async function loadMyAffiliate(): Promise<MyAffiliate | null> {
  const db = client();
  const { data, error } = await db.from("affiliates").select("status, website, channels, code, applied_at").maybeSingle();
  if (error) throw new AccountError(tr("We couldn't load your affiliate details. Try again."));
  if (!data) return null;
  const row = data as { status: AffiliateStatus; website: string; channels: string; code: string | null; applied_at: string };
  let stats: AffiliateStats | null = null;
  if (row.status !== "pending" && row.status !== "declined") {
    const counts = await db.rpc("my_affiliate");
    const c = (counts.data ?? [])[0] as
      | { clicks_30_days: number; clicks_total: number; signed_up: number; paid: number; earned_cents: number }
      | undefined;
    if (!counts.error && c) {
      stats = { clicks30Days: c.clicks_30_days, clicksTotal: c.clicks_total, signedUp: c.signed_up, paid: c.paid, earnedCents: c.earned_cents };
    }
  }
  return { status: row.status, website: row.website, channels: row.channels, code: row.code, appliedAt: row.applied_at, stats };
}

export async function applyAffiliate(website: string, channels: string): Promise<void> {
  const { error } = await client().rpc("apply_affiliate", {
    p_website: website.trim(),
    p_channels: channels.trim(),
    p_discloses: true,
    p_no_children: true,
  });
  if (error) {
    if (/already applied/i.test(error.message)) throw new AccountError(tr("You've already applied."));
    if (/complimentary/i.test(error.message)) throw new AccountError(tr("Staff memberships aren't billed, so staff can't be affiliates."));
    throw new AccountError(tr("We couldn't send your application. Try again."));
  }
}

export interface Application {
  accountId: string;
  displayName: string | null;
  status: AffiliateStatus;
  website: string;
  channels: string;
  appliedAt: string;
  decidedAt: string | null;
  code: string | null;
}

/** Every application, pending first: sales staff and admins only (the database checks). */
export async function loadApplications(): Promise<Application[]> {
  const { data, error } = await client().rpc("affiliate_applications");
  if (error) throw new AccountError(tr("We couldn't load the applications. Try again."));
  return ((data ?? []) as {
    account_id: string;
    display_name: string | null;
    status: AffiliateStatus;
    website: string;
    channels: string;
    applied_at: string;
    decided_at: string | null;
    code: string | null;
  }[]).map((r) => ({
    accountId: r.account_id,
    displayName: r.display_name,
    status: r.status,
    website: r.website,
    channels: r.channels,
    appliedAt: r.applied_at,
    decidedAt: r.decided_at,
    code: r.code,
  }));
}

export async function reviewAffiliate(accountId: string, decision: "approved" | "declined" | "suspended"): Promise<void> {
  const { error } = await client().rpc("review_affiliate", { p_account: accountId, p_decision: decision });
  if (error) throw new AccountError(tr("We couldn't save that decision. Try again."));
}

/** Counts one visit to an affiliate's link (once per visitor and day; the function decides). Never fails loudly. */
export function recordAffiliateClick(code: string): void {
  if (!usesBackend) return;
  void fetch(`${SUPABASE_URL}/functions/v1/affiliate-click`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY! },
    body: JSON.stringify({ code }),
    keepalive: true,
  }).catch(() => undefined);
}
