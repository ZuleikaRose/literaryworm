import { useEffect, useState } from "react";
import { useSprintCount } from "../lib/sprintCounter";
import { clock } from "../lib/sprints";
import { useActiveProfile } from "../store/context";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/** In the reader's top bar while this profile is in a reading sprint: time left and pages so far. */
export function SprintChip() {
  const t = useT();
  const count = useSprintCount();
  const profile = useActiveProfile();
  const [now, setNow] = useState(() => Date.now());
  const endsAt = count?.endsAt;
  useEffect(() => {
    if (endsAt === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!count || count.profileId !== profile?.id || now >= count.endsAt) return null;
  const left = Math.ceil((count.endsAt - now) / 1000);
  return (
    <p className="sprint-chip" role="timer" aria-label={t("Reading sprint: {time} left, pages read: {count}", { time: clock(left), count: count.pages })}>
      <Icon name="clock" size={15} />
      <span aria-hidden="true">
        {clock(left)} · {count.pages}
      </span>
    </p>
  );
}
