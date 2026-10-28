import { useEffect, useState } from "react";
import { useStore } from "../store/context";
import type { StaffRole } from "./staff";
import { myStaffRoles } from "./staffApi";

/** The signed-in member's staff roles: none for visitors, the demo and most members (and while checking). */
export function useStaffRoles(): StaffRole[] {
  const userId = useStore().state.account?.userId ?? null;
  const [found, setFound] = useState<{ userId: string; roles: StaffRole[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    myStaffRoles().then(
      (roles) => live && setFound({ userId, roles }),
      (err: Error) => console.error("staff: couldn't check access:", err.message),
    );
    return () => {
      live = false;
    };
  }, [userId]);
  return userId && found?.userId === userId ? found.roles : [];
}
