import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { badgeText, bellLabel, isNewRelease } from "../lib/notifications";
import { releaseLabel } from "../lib/release";
import { useNotifications } from "../lib/useNotifications";
import { usePopover } from "../lib/usePopover";
import { Icon } from "./Icon";

/**
 * The header's bell: a count of what's new for the profile, and a panel listing books from its
 * reminders that are out and book clubs with new posts. Opening it marks the releases seen;
 * club posts stop counting once the club is opened.
 */
export function NotificationBell() {
  const { released, news, count, seenAt, withClubs, markSeen, refresh } = useNotifications();
  const { open, setOpen, close, wrapRef, triggerRef } = usePopover();
  const panelId = useId();
  // What was seen before this opening, so the panel can still mark what's new while it's open.
  const [seenBefore, setSeenBefore] = useState(seenAt);

  const toggle = () => {
    if (!open) {
      setSeenBefore(seenAt);
      void refresh();
      void markSeen();
    }
    setOpen(!open);
  };
  const empty = released.length === 0 && news.length === 0;

  return (
    <div className="popover-wrap" ref={wrapRef}>
      <button ref={triggerRef} type="button" className="icon-button bell-button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <Icon name="bell" />
        {count > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {badgeText(count)}
          </span>
        )}
        <span className="visually-hidden">{bellLabel(count)}</span>
      </button>
      {open && (
        <div id={panelId} className="popover bell-panel" role="region" aria-label="Notifications">
          <h2 className="popover-title">Notifications</h2>
          {empty ? (
            <p className="bell-empty">
              Nothing new. Books you set <strong>Remind me</strong> on show up here when they come out
              {withClubs ? ", and so do new posts in your book clubs" : ""}.
            </p>
          ) : (
            <>
              {news.length > 0 && (
                <>
                  <p className="popover-label">Book clubs</p>
                  <ul className="bell-list" role="list">
                    {news.map((n) => (
                      <li key={n.clubId}>
                        <Link className="bell-item" to={`/clubs/${n.clubId}`} onClick={() => close(false)}>
                          <Icon name="users" size={18} />
                          <span>
                            <strong>{n.clubName}</strong>
                            <small>
                              {n.posts} new {n.posts === 1 ? "post" : "posts"} · {n.bookTitle}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {released.length > 0 && (
                <>
                  <p className="popover-label">Out now</p>
                  <ul className="bell-list" role="list">
                    {released.map((r) => (
                      <li key={r.bookId}>
                        <Link className="bell-item" to={`/books/${r.bookId}`} onClick={() => close(false)}>
                          <Icon name="bookOpen" size={18} />
                          <span>
                            <strong>
                              {r.title}
                              {isNewRelease(r, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>
                              {r.author ? `${r.author} · ` : ""}out {releaseLabel(r.releaseDate)}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <hr className="menu-sep" />
          <Link className="menu-item" to="/library?view=reminders" onClick={() => close(false)}>
            <Icon name="bell" size={17} /> All reminders
          </Link>
        </div>
      )}
    </div>
  );
}
