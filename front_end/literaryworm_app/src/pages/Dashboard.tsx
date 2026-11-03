import { type CSSProperties, useEffect, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Icon } from "../components/Icon";
import { formatMoney } from "../lib/billing";
import { readingTime } from "../lib/goals";
import { dateLocale, type T } from "../lib/i18n";
import { hasRole } from "../lib/staff";
import { loadDashboard, type StaffDashboard } from "../lib/staffApi";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const num = (t: T, n: number) => n.toLocaleString(dateLocale(t.lang));
const shortDay = (t: T, iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(t.lang), { month: "short", day: "numeric" });

/**
 * /dashboard, for billing staff and admins: totals for accounts, memberships, reading and clubs.
 * Totals only (staff_dashboard() never returns who); the database checks the role, this page
 * only decides what to show while it asks.
 */
export default function Dashboard() {
  const t = useT();
  useTitle(t("Dashboard"));
  const roles = useStaffRoles();
  const isDemo = useStore().state.account?.isDemo ?? false;
  const allowed = hasRole(roles, "billing");

  return (
    <div className="page dashboard-page">
      <BackLink />
      <h1>{t("Dashboard")}</h1>
      {allowed ? (
        <DashboardBody />
      ) : (
        <p className="account-sub">
          {isDemo ? t("The demo household has no staff access.") : t("The dashboard is for billing staff and admins. An admin can give you access in Account → Team access.")}
        </p>
      )}
    </div>
  );
}

function DashboardBody() {
  const t = useT();
  // Each load is a try; busy until the answer for the latest try arrives.
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<{ tries: number; data: StaffDashboard | null; error: string | null } | null>(null);
  const busy = result?.tries !== tries;
  const data = result?.data ?? null;
  const error = busy ? null : (result?.error ?? null);

  useEffect(() => {
    let live = true;
    loadDashboard().then(
      (d) => live && setResult({ tries, data: d, error: null }),
      (err: Error) => live && setResult((r) => ({ tries, data: r?.data ?? null, error: err.message })),
    );
    return () => {
      live = false;
    };
  }, [tries]);
  const reload = () => setTries((n) => n + 1);

  return (
    <>
      <div className="dashboard-bar">
        <p className="account-sub" aria-live="polite">
          {busy
            ? t("Loading the latest totals…")
            : data && t("Totals as of {when}. No names or emails are shown.", { when: new Date(data.generatedAt).toLocaleString(dateLocale(t.lang), { dateStyle: "medium", timeStyle: "short" }) })}
        </p>
        <button type="button" className="secondary-button" onClick={reload} disabled={busy}>
          {t("Refresh")}
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
      {data && <Totals data={data} />}
    </>
  );
}

function Totals({ data }: { data: StaffDashboard }) {
  const t = useT();
  const currency = data.memberships[0]?.currency ?? "USD";
  const paid = data.memberships.reduce((n, m) => n + m.active, 0);
  const peak = Math.max(1, ...data.weeklySignUps.map((w) => w.count));

  return (
    <div className="stats">
      <ul className="stats-tiles" role="list">
        <li>
          <Icon name="users" size={20} />
          <strong>{num(t, data.accounts.total)}</strong>
          <span>
            {t.plural(data.accounts.total, { one: "account, {fresh} new in the last 30 days", other: "accounts, {fresh} new in the last 30 days" }, { fresh: num(t, data.accounts.new30Days) })}
          </span>
        </li>
        <li>
          <Icon name="check" size={20} />
          <strong>{num(t, paid)}</strong>
          <span>
            {t.plural(paid, { one: "paid membership active, {yearly} billed yearly", other: "paid memberships active, {yearly} billed yearly" }, { yearly: num(t, data.yearlyMemberships) })}
          </span>
        </li>
        <li>
          <Icon name="star" size={20} />
          <strong>{formatMoney(data.monthlyRevenueCents, currency)}</strong>
          <span>{t("a month at list price, before promo codes (a yearly membership counts a twelfth)")}</span>
        </li>
        <li>
          <Icon name="bookOpen" size={20} />
          <strong>{num(t, data.reading.activeReaders7Days)}</strong>
          <span>{t.plural(data.reading.activeReaders7Days, { one: "profile read or listened in the last 7 days", other: "profiles read or listened in the last 7 days" })}</span>
        </li>
        <li className={data.stripeEventsToReview > 0 ? "dashboard-warn" : undefined}>
          <Icon name="alert" size={20} />
          <strong>{num(t, data.stripeEventsToReview)}</strong>
          <span>{t.plural(data.stripeEventsToReview, { one: "Stripe event to review (disputes, refunds, fraud warnings)", other: "Stripe events to review (disputes, refunds, fraud warnings)" })}</span>
        </li>
      </ul>

      <section className="stats-card" aria-labelledby="dash-plans">
        <h2 id="dash-plans">{t("Memberships by plan")}</h2>
        {/* Focusable so keyboard users can scroll it sideways on a phone. */}
        <div className="dashboard-table-wrap" tabIndex={0} role="region" aria-labelledby="dash-plans">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">{t("Plan")}</th>
                <th scope="col">{t("Active")}</th>
                <th scope="col">{t("Cancelling")}</th>
                <th scope="col">{t("Paused")}</th>
                <th scope="col">{t("Payment due")}</th>
                <th scope="col">{t("Cancelled")}</th>
                <th scope="col">{t("Complimentary")}</th>
              </tr>
            </thead>
            <tbody>
              {data.memberships.map((m) => (
                <tr key={m.plan}>
                  <th scope="row">
                    {m.name}{" "}
                    <span>
                      {m.yearlyPriceCents !== null
                        ? t("{monthly} a month, {yearly} a year", { monthly: formatMoney(m.priceCents, m.currency), yearly: formatMoney(m.yearlyPriceCents, m.currency) })
                        : t("{price} a month", { price: formatMoney(m.priceCents, m.currency) })}
                    </span>
                  </th>
                  <td>{m.active}</td>
                  <td>{m.cancelling}</td>
                  <td>{m.paused}</td>
                  <td>{m.pastDue}</td>
                  <td>{m.cancelled}</td>
                  <td>{m.complimentary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="goal-hint">{t("Active counts paid memberships, monthly and yearly; cancelling ones are active until the end of the month or year they've paid for. Staff memberships are complimentary.")}</p>
      </section>

      <section className="stats-card" aria-labelledby="dash-weeks">
        <h2 id="dash-weeks">{t("New accounts, week by week")}</h2>
        <ol className="stats-months" role="list">
          {data.weeklySignUps.map((w) => (
            <li key={w.week}>
              <span className="stats-bar" aria-hidden="true" style={{ "--height": `${(w.count / peak) * 100}%` } as CSSProperties} />
              <span className="stats-month-name">
                <span aria-hidden="true">{shortDay(t, w.week)}</span>
                <span className="visually-hidden">
                  {t.plural(w.count, { one: "Week of {day}: {n} new account", other: "Week of {day}: {n} new accounts" }, { day: shortDay(t, w.week), n: num(t, w.count) })}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="goal-hint">{t("The last 12 weeks, each starting on a Monday; the last bar is this week so far.")}</p>
      </section>

      <div className="stats-pair">
        <section className="stats-card" aria-labelledby="dash-reading">
          <h2 id="dash-reading">{t("Reading, last 30 days")}</h2>
          <ul className="dashboard-list" role="list">
            <li>{t("{time} reading and listening", { time: readingTime(data.reading.minutes30Days * 60) })}</li>
            <li>{t("{time} of it listening", { time: readingTime(data.reading.listeningMinutes30Days * 60) })}</li>
            <li>{t.plural(data.reading.booksFinished30Days, { one: "{n} book finished", other: "{n} books finished" }, { n: num(t, data.reading.booksFinished30Days) })}</li>
            <li>
              {t.plural(data.accounts.profiles, { one: "{n} profile in all, {kids} of them Kids", other: "{n} profiles in all, {kids} of them Kids" }, { n: num(t, data.accounts.profiles), kids: num(t, data.accounts.kidsProfiles) })}
            </li>
          </ul>
        </section>
        <section className="stats-card" aria-labelledby="dash-clubs">
          <h2 id="dash-clubs">{t("Book clubs")}</h2>
          <ul className="dashboard-list" role="list">
            <li>{t.plural(data.clubs.running, { one: "{n} club running", other: "{n} clubs running" }, { n: num(t, data.clubs.running) })}</li>
            <li>{t.plural(data.clubs.posts30Days, { one: "{n} post in the last 30 days", other: "{n} posts in the last 30 days" }, { n: num(t, data.clubs.posts30Days) })}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
