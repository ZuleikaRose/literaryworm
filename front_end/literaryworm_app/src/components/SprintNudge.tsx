import { Link } from "react-router-dom";
import { clock, secondsLeft } from "../lib/sprints";
import { useReadingSprint } from "../lib/useReadingSprint";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/** On Home while the household's reading sprint is running and this profile hasn't joined: a way in. */
export function SprintNudge() {
  const t = useT();
  const { sprint, running, joined, now } = useReadingSprint({ kind: "household" });
  if (!sprint || !running || joined) return null;
  return (
    <Link className="home-nudge" to="/library?view=goals">
      <Icon name="clock" size={18} />
      <span>
        <strong>{t("A reading sprint is on at home: {time} left.", { time: clock(secondsLeft(sprint, now)) })}</strong> {t("Join in from Goals.")}
      </span>
    </Link>
  );
}
