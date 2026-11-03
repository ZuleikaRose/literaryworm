import { tk, tr } from "./i18n";

/**
 * Staff roles: access beyond being a member (the same values as the database's staff_role). Any
 * role also gives a complimentary membership while it's held (the database sets it).
 */
export type StaffRole = "admin" | "developer" | "editor" | "billing" | "customer_service" | "blog" | "sales";

export const STAFF_ROLES: { value: StaffRole; label: string; description: string; inUse: boolean }[] = [
  { value: "admin", label: tk("Admin"), description: tk("Everything, including giving and removing access."), inUse: true },
  { value: "editor", label: tk("Editor"), description: tk("Edits the policy and help pages in the footer, and What's new."), inUse: true },
  { value: "developer", label: tk("Developer"), description: tk("Writes What's new and the maintenance notices shown before planned updates."), inUse: true },
  { value: "billing", label: tk("Billing"), description: tk("Sees the dashboard: totals for accounts, memberships and reading."), inUse: true },
  { value: "customer_service", label: tk("Customer service"), description: tk("Looks up a member by email to help them: plan, billing, listening and devices (Member lookup)."), inUse: true },
  { value: "blog", label: tk("Blog"), description: tk("For the blog. None in LiteraryWorm use it yet."), inUse: false },
  { value: "sales", label: tk("Sales"), description: tk("For sales tools. None in LiteraryWorm use it yet."), inUse: false },
];

/** A role's name in the chosen language. */
export const roleLabel = (role: StaffRole) => {
  const label = STAFF_ROLES.find((r) => r.value === role)?.label;
  return label ? tr(label) : role;
};

/** Whether `roles` allow `role` (admins can do everything). */
export const hasRole = (roles: StaffRole[], role: StaffRole) => roles.includes(role) || roles.includes("admin");

export interface StaffMember {
  /** Null for an invitation to an email with no account yet. */
  userId: string | null;
  email: string;
  name: string | null;
  roles: StaffRole[];
  invited: boolean;
}
