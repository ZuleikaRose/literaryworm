import { useEffect, useState } from "react";
import { usesBackend } from "../lib/backend";
import { type MaintenanceNotice, NOTICE_REFRESH_MS, noticeState, noticeWhen, showingNotices } from "../lib/maintenance";
import { loadShowingNotices } from "../lib/maintenanceApi";
import { Icon } from "./Icon";

/** Notices dismissed in this tab (in memory, like the rest of the app: a refresh shows them again). */
const dismissed = new Set<string>();

/**
 * The planned-work banner across the top of every site page: notices developers and admins wrote
 * at /maintenance, from when they're announced until the work ends. It checks again every few
 * minutes and when the tab comes back, so a notice added during a visit still appears.
 */
export function MaintenanceBanner() {
  const [notices, setNotices] = useState<MaintenanceNotice[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [, setDismissals] = useState(0);

  useEffect(() => {
    if (!usesBackend) return;
    let live = true;
    const check = () =>
      loadShowingNotices().then(
        (list) => {
          if (!live) return;
          setNotices(list);
          setNow(Date.now());
        },
        // A banner that can't load stays quiet; the page itself still works.
        (err: Error) => console.error("maintenance:", err.message),
      );
    void check();
    const timer = window.setInterval(check, NOTICE_REFRESH_MS);
    // Between checks, notices still move from announced to under way to gone on time.
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const shown = showingNotices(notices, now).filter((n) => !dismissed.has(n.id));
  if (shown.length === 0) return null;

  return (
    <section className="maintenance-banner" aria-label="Planned updates">
      {shown.map((n) => {
        const underWay = noticeState(n, now) === "under way";
        return (
          <div key={n.id} className={`maintenance-notice${underWay ? " is-under-way" : ""}`}>
            <Icon name="alert" size={18} />
            <p>
              <strong>{underWay ? `Happening now: ${n.title}` : n.title}</strong> <span className="maintenance-when">{noticeWhen(n)}.</span>{" "}
              {n.message}
            </p>
            <button
              type="button"
              className="icon-button maintenance-dismiss"
              aria-label={`Hide the notice: ${n.title}`}
              onClick={() => {
                dismissed.add(n.id);
                setDismissals((c) => c + 1);
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        );
      })}
    </section>
  );
}
