import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice, planById } from "../data/plans";
import { endDate } from "../lib/billing";
import { badgeText, bellLabel, isNewAlert, isNewAuthorBook, isNewListeningAlert, isNewRelease } from "../lib/notifications";
import { hoursAndMinutes, nextPlanUp, planCheckoutPath } from "../lib/planLimits";
import { releaseLabel } from "../lib/release";
import { useNotifications } from "../lib/useNotifications";
import { usePopover } from "../lib/usePopover";
import { useStore } from "../store/context";
import { Icon } from "./Icon";

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "today at 7:00 PM" or "tomorrow at 7:00 PM" (meetings in the bell are less than a day away). */
function meetingWhen(iso: string): string {
  const start = new Date(iso);
  const sameDay = start.toDateString() === new Date().toDateString();
  return `${sameDay ? "today" : "tomorrow"} at ${clock.format(start)}`;
}

/**
 * The header's bell: a count of what's new for the profile, and a panel listing books from its
 * reminders that are out and book clubs with new posts. Opening it marks the releases seen;
 * club posts stop counting once the club is opened.
 */
export function NotificationBell() {
  const { released, authorNews, news, meetings, listening, renewal, offer, goals, count, seenAt, withClubs, markSeen, refresh } = useNotifications();
  const { open, setOpen, close, wrapRef, triggerRef } = usePopover();
  const planId = useStore().state.account?.planId ?? null;
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
  const listeningNext = listening ? nextPlanUp(planId) : null;
  const empty = released.length === 0 && news.length === 0 && authorNews.length === 0 && listening === null && renewal === null && offer === null && goals.length === 0 && meetings.length === 0;
  const plan = planId ? planById.get(planId) : undefined;
  const switchPlan = renewal?.switchToMonthly ? planById.get(renewal.switchToMonthly) : undefined;
  const offerPlan = offer ? planById.get(offer.planId) : undefined;

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
              Nothing new. Books you set <strong>Remind me</strong> on show up here when they come out, and so do new books from
              authors you follow{withClubs ? ", new posts and meetings in your book clubs" : ""} and news about your goals and streak.
            </p>
          ) : (
            <>
              {goals.length > 0 && (
                <>
                  <p className="popover-label">Your reading</p>
                  <ul className="bell-list" role="list">
                    {goals.map((g) => (
                      <li key={g.kind}>
                        <Link className="bell-item" to="/library?view=goals" onClick={() => close(false)}>
                          <Icon name={g.kind === "streak" ? "clock" : "star"} size={18} />
                          <span>
                            <strong>
                              {g.kind === "streak"
                                ? `Your ${g.days}-day streak ends tonight`
                                : g.kind === "close"
                                  ? `${g.left === 1 ? "1 book" : `${g.left} books`} from your ${g.year} goal`
                                  : `You reached your ${g.year} goal`}
                              {isNewAlert(g.at, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>
                              {g.kind === "streak"
                                ? "Read or listen for a minute today to keep it going."
                                : g.kind === "close"
                                  ? `${g.goal - g.left} of ${g.goal} books finished this year.`
                                  : `${g.goal} ${g.goal === 1 ? "book" : "books"} finished. Well done! Set a bigger goal in Goals if you like.`}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(listening || renewal || offerPlan) && (
                <>
                  <p className="popover-label">Your plan</p>
                  <ul className="bell-list" role="list">
                    {renewal && plan && (
                      <li>
                        <Link className="bell-item" to="/account#plan" onClick={() => close(false)}>
                          <Icon name="calendar" size={18} />
                          <span>
                            <strong>
                              {switchPlan
                                ? `Monthly billing starts on ${endDate(renewal.renewsAt)}`
                                : `Your yearly membership renews on ${endDate(renewal.renewsAt)}`}
                              {isNewAlert(renewal.at, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>
                              {switchPlan
                                ? `${switchPlan.name} · ${formatPrice(switchPlan.price)} a month from then, instead of renewing the year.`
                                : `${plan.name} · ${formatPrice(plan.yearlyPrice)}. To stop it, cancel in Account at least 48 hours before.`}
                            </small>
                          </span>
                        </Link>
                      </li>
                    )}
                    {offer && offerPlan && (
                      <li>
                        <Link className="bell-item" to="/plans?billing=yearly" onClick={() => close(false)}>
                          <Icon name="star" size={18} />
                          <span>
                            <strong>
                              Switch to yearly and save {formatPrice(offer.saving)}
                              {isNewAlert(offer.at, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>
                              {offerPlan.name} · {formatPrice(offerPlan.yearlyPrice)} a year instead of {formatPrice(offerPlan.price)} a month: two months free.
                            </small>
                          </span>
                        </Link>
                      </li>
                    )}
                    {listening && (
                    <li>
                      <Link className="bell-item" to={listeningNext ? planCheckoutPath(listeningNext) : "/account#plan"} onClick={() => close(false)}>
                        <Icon name="headphones" size={18} />
                        <span>
                          <strong>
                            {listening.used >= listening.limit ? "This month's listening is used up" : "Most of this month's listening is used"}
                            {isNewListeningAlert(listening, seenBefore) && <span className="bell-new">New</span>}
                          </strong>
                          <small>
                            {hoursAndMinutes(Math.min(listening.used, listening.limit))} of {listening.limit / 3600} hours, for the whole household
                            {listeningNext &&
                              ` · ${listeningNext.audioHoursPerMonth === null ? "unlimited" : `${listeningNext.audioHoursPerMonth} hours`} on ${listeningNext.name}`}
                          </small>
                        </span>
                      </Link>
                    </li>
                    )}
                  </ul>
                </>
              )}
              {(news.length > 0 || meetings.length > 0) && (
                <>
                  <p className="popover-label">Book clubs</p>
                  <ul className="bell-list" role="list">
                    {meetings.map(({ meeting: m, at }) => (
                      <li key={m.id}>
                        <Link className="bell-item" to={`/clubs/${m.clubId}`} onClick={() => close(false)}>
                          <Icon name="calendar" size={18} />
                          <span>
                            <strong>
                              {m.clubName} meets {meetingWhen(m.startsAt)}
                              {isNewAlert(at, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>{m.title}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
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
              {authorNews.length > 0 && (
                <>
                  <p className="popover-label">New from authors you follow</p>
                  <ul className="bell-list" role="list">
                    {authorNews.map((n) => (
                      <li key={n.bookId}>
                        <Link className="bell-item" to={`/books/${n.bookId}`} onClick={() => close(false)}>
                          <Icon name="user" size={18} />
                          <span>
                            <strong>
                              {n.title}
                              {isNewAuthorBook(n, seenBefore) && <span className="bell-new">New</span>}
                            </strong>
                            <small>
                              {n.author} · out {releaseLabel(n.published)}
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
