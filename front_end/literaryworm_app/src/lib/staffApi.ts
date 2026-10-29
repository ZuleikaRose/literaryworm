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
