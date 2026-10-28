/** Staff roles: access beyond being a member (the same values as the database's staff_role). */
export type StaffRole = "admin" | "developer" | "editor" | "billing" | "customer_service" | "blog";

export const STAFF_ROLES: { value: StaffRole; label: string; description: string; inUse: boolean }[] = [
  { value: "admin", label: "Admin", description: "Everything, including giving and removing access.", inUse: true },
  { value: "editor", label: "Editor", description: "Edits the policy and help pages in the footer.", inUse: true },
  { value: "developer", label: "Developer", description: "For developer tools. None in LiteraryWorm use it yet.", inUse: false },
  { value: "billing", label: "Billing", description: "For billing tools. None in LiteraryWorm use it yet.", inUse: false },
  { value: "customer_service", label: "Customer service", description: "For support tools. None in LiteraryWorm use it yet.", inUse: false },
  { value: "blog", label: "Blog", description: "For the blog. None in LiteraryWorm use it yet.", inUse: false },
];

export const roleLabel = (role: StaffRole) => STAFF_ROLES.find((r) => r.value === role)?.label ?? role;

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
