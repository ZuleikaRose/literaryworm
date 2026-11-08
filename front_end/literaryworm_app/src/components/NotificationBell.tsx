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
import { rich, type T, dateLocale } from "../lib/i18n";
import { useT } from "../lib/useT";

/** "Book club meets today at 7:00 PM" or "… tomorrow at 7:00 PM" (meetings in the bell are less than a day away). */
function meetingText(t: T, club: string, iso: string): string {
  const start = new Date(iso);
  const sameDay = start.toDateString() === new Date().toDateString();
  // The browser's own clock style in English; the chosen language's otherwise.
  const time = new Intl.DateTimeFormat(t.lang === "en" ? undefined : dateLocale(t.lang), { hour: "numeric", minute: "2-digit" }).format(start);
  return sameDay ? t("{club} meets today at {time}", { club, time }) : t("{club} meets tomorrow at {time}", { club, time });
}

/**
 * The header's bell: a count of what's new for the profile, and a panel listing books from its
 * reminders that are out and book clubs with new posts. Opening it marks the releases seen;
 * club posts stop counting once the club is opened.
 */
export function NotificationBell() {
  const { released, authorNews, news, meetings, polls, schedules, listening, natural, renewal, payment, offer, goals, badges, requests, count, seenAt, withClubs, markSeen, refresh } = useNotifications();
  const { open, setOpen, close, wrapRef, triggerRef } = usePopover();
  const t = useT();
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
  const empty = released.length === 0 && news.length === 0 && authorNews.length === 0 && listening === null && natural === null && renewal === null && payment === null && offer === null && goals.length === 0 && badges.length === 0 && meetings.length === 0 && polls.length === 0 && schedules.length === 0 && requests.length === 0;
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
        <div id={panelId} className="popover bell-panel" role="region" aria-label={t("Notifications")}>
          <h2 className="popover-title">{t("Notifications")}</h2>
          {empty ? (
            <p className="bell-empty">
              {rich(
                withClubs
                  ? t(
                      "Nothing new. Books you set {remind} on show up here when they come out, and so do new books from authors you follow, new posts, meetings and polls in your book clubs and news about your goals and streak.",
                    )
                  : t("Nothing new. Books you set {remind} on show up here when they come out, and so do new books from authors you follow and news about your goals and streak."),
                { remind: <strong>{t("Remind me")}</strong> },
              )}
            </p>
          ) : (
            <>
              {requests.length > 0 && (
                <>
                  <p className="popover-label">{t("Book requests")}</p>
                  <ul className="bell-list" role="list">
                    {requests.map(({ key, at, waiting }) => (
                      <li key={key}>
                        <Link className="bell-item" to="/account#family" onClick={() => close(false)}>
                          <Icon name="bookOpen" size={18} />
                          <span>
                            <strong>
                              {t("{name} asked for {title}", { name: waiting.profile.name, title: waiting.book.title })}
                              {isNewAlert(at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{t("Say yes or no in Account → Family.")}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {goals.length > 0 && (
                <>
                  <p className="popover-label">{t("Your reading")}</p>
                  <ul className="bell-list" role="list">
                    {goals.map((g) => (
                      <li key={g.kind}>
                        <Link className="bell-item" to="/library?view=goals" onClick={() => close(false)}>
                          <Icon name={g.kind === "streak" ? "clock" : "star"} size={18} />
                          <span>
                            <strong>
                              {g.kind === "streak"
                                ? t("Your {days}-day streak ends tonight", { days: g.days })
                                : g.kind === "close"
                                  ? t.plural(g.left, { one: "{count} book from your {year} goal", other: "{count} books from your {year} goal" }, { year: g.year })
                                  : t("You reached your {year} goal", { year: g.year })}
                              {isNewAlert(g.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {g.kind === "streak"
                                ? t("Read or listen for a minute today to keep it going.")
                                : g.kind === "close"
                                  ? t("{done} of {goal} books finished this year.", { done: g.goal - g.left, goal: g.goal })
                                  : t.plural(g.goal, {
                                      one: "{count} book finished. Well done! Set a bigger goal in Goals if you like.",
                                      other: "{count} books finished. Well done! Set a bigger goal in Goals if you like.",
                                    })}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {badges.length > 0 && (
                <>
                  <p className="popover-label">{t("Badges")}</p>
                  <ul className="bell-list" role="list">
                    {badges.map(({ badge, at }) => (
                      <li key={badge.id}>
                        <Link className="bell-item" to="/library?view=badges" onClick={() => close(false)}>
                          <Icon name={badge.icon} size={18} />
                          <span>
                            <strong>
                              {t("You earned {badge}", { badge: t(badge.title) })}
                              {isNewAlert(at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{t("{description}. See all your badges in My Library.", { description: t(badge.description) })}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(listening || natural || renewal || payment || offerPlan) && (
                <>
                  <p className="popover-label">{t("Your plan")}</p>
                  <ul className="bell-list" role="list">
                    {payment && (
                      <li>
                        <Link className="bell-item" to="/account#plan" onClick={() => close(false)}>
                          <Icon name="alert" size={18} />
                          <span>
                            <strong>
                              {t("Your last payment didn't go through")}
                              {isNewAlert(payment.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{t("Update your payment method in Account to keep your membership. Natural voices are paused until a payment succeeds.")}</small>
                          </span>
                        </Link>
                      </li>
                    )}
                    {renewal && plan && (
                      <li>
                        <Link className="bell-item" to="/account#plan" onClick={() => close(false)}>
                          <Icon name="calendar" size={18} />
                          <span>
                            <strong>
                              {switchPlan
                                ? t("Monthly billing starts on {date}", { date: endDate(renewal.renewsAt) })
                                : t("Your yearly membership renews on {date}", { date: endDate(renewal.renewsAt) })}
                              {isNewAlert(renewal.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {switchPlan
                                ? t("{plan} · {price} a month from then, instead of renewing the year.", { plan: switchPlan.name, price: formatPrice(switchPlan.price) })
                                : t("{plan} · {price}. To stop it, cancel in Account at least 48 hours before.", { plan: plan.name, price: formatPrice(plan.yearlyPrice) })}
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
                              {t("Switch to yearly and save {amount}", { amount: formatPrice(offer.saving) })}
                              {isNewAlert(offer.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {t("{plan} · {yearly} a year instead of {monthly} a month: two months free.", {
                                plan: offerPlan.name,
                                yearly: formatPrice(offerPlan.yearlyPrice),
                                monthly: formatPrice(offerPlan.price),
                              })}
                            </small>
                          </span>
                        </Link>
                      </li>
                    )}
                    {natural && (
                      <li>
                        <Link className="bell-item" to="/account#plan" onClick={() => close(false)}>
                          <Icon name="headphones" size={18} />
                          <span>
                            <strong>
                              {natural.used >= natural.limit ? t("This month's natural-voice reading is used up") : t("Most of this month's natural-voice reading is used")}
                              {isNewAlert(natural.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {t("{used} of {hours} hours of new natural-voice reading for your uploads. Parts already voiced still play.", {
                                used: hoursAndMinutes(natural.used),
                                hours: Math.round(natural.limit / 3600),
                              })}
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
                            {listening.used >= listening.limit ? t("This month's listening is used up") : t("Most of this month's listening is used")}
                            {isNewListeningAlert(listening, seenBefore) && <span className="bell-new">{t("New")}</span>}
                          </strong>
                          <small>
                            {t("{used} of {hours} hours, for the whole household", {
                              used: hoursAndMinutes(Math.min(listening.used, listening.limit)),
                              hours: listening.limit / 3600,
                            })}
                            {listeningNext &&
                              (listeningNext.audioHoursPerMonth === null
                                ? t(" · unlimited on {plan}", { plan: listeningNext.name })
                                : t(" · {hours} hours on {plan}", { hours: listeningNext.audioHoursPerMonth, plan: listeningNext.name }))}
                          </small>
                        </span>
                      </Link>
                    </li>
                    )}
                  </ul>
                </>
              )}
              {(news.length > 0 || meetings.length > 0 || polls.length > 0 || schedules.length > 0) && (
                <>
                  <p className="popover-label">{t("Book clubs")}</p>
                  <ul className="bell-list" role="list">
                    {meetings.map(({ meeting: m, at }) => (
                      <li key={m.id}>
                        <Link className="bell-item" to={`/clubs/${m.clubId}`} onClick={() => close(false)}>
                          <Icon name="calendar" size={18} />
                          <span>
                            <strong>
                              {meetingText(t, m.clubName, m.startsAt)}
                              {isNewAlert(at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{m.title}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {polls.map(({ poll: p, clubName, at }) => (
                      <li key={p.id}>
                        <Link className="bell-item" to={`/clubs/${p.clubId}`} onClick={() => close(false)}>
                          <Icon name="list" size={18} />
                          <span>
                            <strong>
                              {t("{club} asks: {question}", { club: clubName, question: p.question })}
                              {isNewAlert(at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{t("Vote on what to read next")}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {schedules.map((s) => (
                      <li key={`schedule-${s.clubId}`}>
                        <Link className="bell-item" to={`/clubs/${s.clubId}`} onClick={() => close(false)}>
                          <Icon name="library" size={18} />
                          <span>
                            <strong>
                              {s.week.from === s.week.to
                                ? t("This week in {club}: chapter {from}", { club: s.clubName, from: s.week.from + 1 })
                                : t("This week in {club}: chapters {from} to {to}", { club: s.clubName, from: s.week.from + 1, to: s.week.to + 1 })}
                              {isNewAlert(s.at, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>{t("Reading schedule · week {n}", { n: s.week.week })}</small>
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
                              {t.plural(n.posts, { one: "{count} new post · {book}", other: "{count} new posts · {book}" }, { book: n.bookTitle })}
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
                  <p className="popover-label">{t("New from authors you follow")}</p>
                  <ul className="bell-list" role="list">
                    {authorNews.map((n) => (
                      <li key={n.bookId}>
                        <Link className="bell-item" to={`/books/${n.bookId}`} onClick={() => close(false)}>
                          <Icon name="user" size={18} />
                          <span>
                            <strong>
                              {n.title}
                              {isNewAuthorBook(n, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {t("{author} · out {date}", { author: n.author, date: releaseLabel(n.published) })}
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
                  <p className="popover-label">{t("Out now")}</p>
                  <ul className="bell-list" role="list">
                    {released.map((r) => (
                      <li key={r.bookId}>
                        <Link className="bell-item" to={`/books/${r.bookId}`} onClick={() => close(false)}>
                          <Icon name="bookOpen" size={18} />
                          <span>
                            <strong>
                              {r.title}
                              {isNewRelease(r, seenBefore) && <span className="bell-new">{t("New")}</span>}
                            </strong>
                            <small>
                              {r.author ? t("{author} · out {date}", { author: r.author, date: releaseLabel(r.releaseDate) }) : t("out {date}", { date: releaseLabel(r.releaseDate) })}
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
            <Icon name="bell" size={17} /> {t("All reminders")}
          </Link>
        </div>
      )}
    </div>
  );
}
