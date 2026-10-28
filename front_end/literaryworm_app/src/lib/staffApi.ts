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
