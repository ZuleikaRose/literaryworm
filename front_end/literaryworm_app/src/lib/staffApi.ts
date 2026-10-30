import { AccountError, signedInUserId } from "./accountApi";
import type { StaffMember, StaffRole } from "./staff";
import { supabase } from "./supabase";

/**
 * Staff roles (staff_roles; granted and removed only by admins through grant_staff_role() and
 * revoke_staff_role()). Every message here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError("Team access needs the LiteraryWorm backend.");
  return supabase;
}

/** The signed-in member's own roles (none for most members). */
export async function myStaffRoles(): Promise<StaffRole[]> {
  const db = client();
  const { data, error } = await db.from("staff_roles").select("role").eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't check your access.");
  return (data as { role: StaffRole }[]).map((r) => r.role);
}

/** Everyone with a role, and waiting invitations (admins only). */
export async function loadStaff(): Promise<StaffMember[]> {
  const { data, error } = await client().rpc("staff_members");
  if (error) throw new AccountError("We couldn't load the team. Try again.");
  return (data as { user_id: string | null; email: string; display_name: string | null; roles: StaffRole[]; invited: boolean }[]).map((m) => ({
    userId: m.user_id,
    email: m.email,
    name: m.display_name,
    roles: m.roles,
    invited: m.invited,
  }));
}

/** Gives a role by email. Resolves "invited" when the email has no account yet (they get it on sign-up). */
export async function grantStaffRole(email: string, role: StaffRole): Promise<"granted" | "invited"> {
  const { data, error } = await client().rpc("grant_staff_role", { p_email: email, p_role: role });
  if (error) {
    if (/email address/i.test(error.message)) throw new AccountError("Enter an email address, like name@example.com.");
    if (/Only admins/i.test(error.message)) throw new AccountError("Only admins can give access.");
    throw new AccountError("We couldn't give that access. Try again.");
  }
  return data === "invited" ? "invited" : "granted";
}

/** Removes a role (or withdraws an invitation). */
export async function revokeStaffRole(email: string, role: StaffRole): Promise<void> {
  const { error } = await client().rpc("revoke_staff_role", { p_email: email, p_role: role });
  if (error) {
    if (/at least one admin/i.test(error.message)) throw new AccountError("LiteraryWorm needs at least one admin. Make someone else an admin first.");
    if (/Only admins/i.test(error.message)) throw new AccountError("Only admins can remove access.");
    throw new AccountError("We couldn't remove that access. Try again.");
  }
}

/** The staff dashboard's totals (staff_dashboard(): billing staff and admins only). */
export interface StaffDashboard {
  generatedAt: string;
  accounts: { total: number; new30Days: number; profiles: number; kidsProfiles: number };
  weeklySignUps: { week: string; count: number }[];
  memberships: {
    plan: string;
    name: string;
    priceCents: number;
    currency: string;
    active: number;
    paused: number;
    pastDue: number;
    cancelled: number;
    cancelling: number;
    complimentary: number;
  }[];
  monthlyRevenueCents: number;
  reading: { activeReaders7Days: number; minutes30Days: number; listeningMinutes30Days: number; booksFinished30Days: number };
  clubs: { running: number; posts30Days: number };
  stripeEventsToReview: number;
}

interface DashboardRow {
  generated_at: string;
  accounts: { total: number; new_30_days: number; profiles: number; kids_profiles: number };
  weekly_sign_ups: { week: string; count: number }[];
  memberships: {
    plan: string;
    name: string;
    price_cents: number;
    currency: string;
    active: number;
    paused: number;
    past_due: number;
    cancelled: number;
    cancelling: number;
    complimentary: number;
  }[];
  monthly_revenue_cents: number;
  reading: { active_readers_7_days: number; minutes_30_days: number; listening_minutes_30_days: number; books_finished_30_days: number };
  clubs: { running: number; posts_30_days: number };
  stripe_events_to_review: number;
}

export async function loadDashboard(): Promise<StaffDashboard> {
  const { data, error } = await client().rpc("staff_dashboard");
  if (error) {
    if (/Only billing staff/i.test(error.message)) throw new AccountError("The dashboard is for billing staff and admins.");
    throw new AccountError("We couldn't load the dashboard. Try again.");
  }
  const d = data as DashboardRow;
  return {
    generatedAt: d.generated_at,
    accounts: { total: d.accounts.total, new30Days: d.accounts.new_30_days, profiles: d.accounts.profiles, kidsProfiles: d.accounts.kids_profiles },
    weeklySignUps: d.weekly_sign_ups,
    memberships: d.memberships.map((m) => ({
      plan: m.plan,
      name: m.name,
      priceCents: m.price_cents,
      currency: m.currency,
      active: m.active,
      paused: m.paused,
      pastDue: m.past_due,
      cancelled: m.cancelled,
      cancelling: m.cancelling,
      complimentary: m.complimentary,
    })),
    monthlyRevenueCents: d.monthly_revenue_cents,
    reading: {
      activeReaders7Days: d.reading.active_readers_7_days,
      minutes30Days: d.reading.minutes_30_days,
      listeningMinutes30Days: d.reading.listening_minutes_30_days,
      booksFinished30Days: d.reading.books_finished_30_days,
    },
    clubs: { running: d.clubs.running, posts30Days: d.clubs.posts_30_days },
    stripeEventsToReview: d.stripe_events_to_review,
  };
}

/** One member, as customer service sees them (support_member_lookup(): no library, reading or Stripe ids). */
export interface MemberLookup {
  name: string | null;
  email: string;
  joinedAt: string;
  emailConfirmed: boolean;
  twoStep: boolean;
  staff: boolean;
  /** Null when they've never chosen a plan. */
  planName: string | null;
  status: string | null;
  billingDay: number | null;
  nextBillingAt: string | null;
  cancelAt: string | null;
  giftUntil: string | null;
  complimentary: boolean;
  cardOnFile: boolean;
  profiles: number;
  kidsProfiles: number;
  maxProfiles: number;
  listeningMinutes: number;
  /** Null for unlimited. */
  audioHours: number | null;
  downloadDevices: number;
  offlineDevices: { label: string; lastSeenAt: string }[];
  devicesOpenToday: number;
}

interface LookupRow {
  status: "ok" | "not_found" | "too_many";
  member?: {
    name: string | null;
    email: string;
    joined_at: string;
    email_confirmed: boolean;
    two_step: boolean;
    staff: boolean;
    plan_name: string | null;
    status: string | null;
    billing_day: number | null;
    next_billing_at: string | null;
    cancel_at: string | null;
    gift_until: string | null;
    complimentary: boolean;
    card_on_file: boolean;
    profiles: number;
    kids_profiles: number;
    max_profiles: number;
    listening_minutes: number;
    audio_hours: number | null;
    download_devices: number;
    offline_devices: { label: string; last_seen_at: string }[];
    devices_open_today: number;
  };
}

/** Looks up a member by email for customer service; null when no account has that email. Each lookup is recorded. */
export async function lookupMember(email: string): Promise<MemberLookup | null> {
  const { data, error } = await client().rpc("support_member_lookup", { p_email: email.trim() });
  if (error) {
    if (/Only customer service/i.test(error.message)) throw new AccountError("Member lookup is for customer service staff and admins.");
    if (/Enter the member/i.test(error.message)) throw new AccountError("Enter the member's email address.");
    throw new AccountError("We couldn't look that up. Try again.");
  }
  const row = data as LookupRow;
  if (row.status === "too_many") throw new AccountError("That's 60 lookups this hour. Try again later.");
  if (row.status === "not_found" || !row.member) return null;
  const m = row.member;
  return {
    name: m.name,
    email: m.email,
    joinedAt: m.joined_at,
    emailConfirmed: m.email_confirmed,
    twoStep: m.two_step,
    staff: m.staff,
    planName: m.plan_name,
    status: m.status,
    billingDay: m.billing_day,
    nextBillingAt: m.next_billing_at,
    cancelAt: m.cancel_at,
    giftUntil: m.gift_until,
    complimentary: m.complimentary,
    cardOnFile: m.card_on_file,
    profiles: m.profiles,
    kidsProfiles: m.kids_profiles,
    maxProfiles: m.max_profiles,
    listeningMinutes: m.listening_minutes,
    audioHours: m.audio_hours,
    downloadDevices: m.download_devices,
    offlineDevices: m.offline_devices.map((d) => ({ label: d.label, lastSeenAt: d.last_seen_at })),
    devicesOpenToday: m.devices_open_today,
  };
}
