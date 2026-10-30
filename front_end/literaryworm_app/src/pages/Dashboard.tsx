import { type CSSProperties, useEffect, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Icon } from "../components/Icon";
import { formatMoney } from "../lib/billing";
import { readingTime } from "../lib/goals";
import { hasRole } from "../lib/staff";
import { loadDashboard, type StaffDashboard } from "../lib/staffApi";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * /dashboard, for billing staff and admins: totals for accounts, memberships, reading and clubs.
 * Totals only (staff_dashboard() never returns who); the database checks the role, this page
 * only decides what to show while it asks.
 */
export default function Dashboard() {
  useTitle("Dashboard");
  const roles = useStaffRoles();
  const isDemo = useStore().state.account?.isDemo ?? false;
  const allowed = hasRole(roles, "billing");

  return (
    <div className="page dashboard-page">
      <BackLink />
      <h1>Dashboard</h1>
      {allowed ? (
        <DashboardBody />
      ) : (
        <p className="account-sub">
          {isDemo ? "The demo household has no staff access." : "The dashboard is for billing staff and admins. An admin can give you access in Account → Team access."}
        </p>
      )}
    </div>
  );
}

function DashboardBody() {
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
  const reload = () => setTries((t) => t + 1);

  return (
    <>
      <div className="dashboard-bar">
        <p className="account-sub" aria-live="polite">
          {busy
            ? "Loading the latest totals…"
            : data && `Totals as of ${new Date(data.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. No names or emails are shown.`}
        </p>
        <button type="button" className="secondary-button" onClick={reload} disabled={busy}>
          Refresh
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
  const currency = data.memberships[0]?.currency ?? "USD";
  const paid = data.memberships.reduce((n, m) => n + m.active, 0);
  const peak = Math.max(1, ...data.weeklySignUps.map((w) => w.count));

  return (
    <div className="stats">
      <ul className="stats-tiles" role="list">
        <li>
          <Icon name="users" size={20} />
          <strong>{data.accounts.total.toLocaleString("en-US")}</strong>
          <span>
            {data.accounts.total === 1 ? "account" : "accounts"}, {data.accounts.new30Days.toLocaleString("en-US")} new in the last 30 days
          </span>
        </li>
        <li>
          <Icon name="check" size={20} />
          <strong>{paid.toLocaleString("en-US")}</strong>
          <span>
            paid {paid === 1 ? "membership" : "memberships"} active, {data.yearlyMemberships.toLocaleString("en-US")} billed yearly
          </span>
        </li>
        <li>
          <Icon name="star" size={20} />
          <strong>{formatMoney(data.monthlyRevenueCents, currency)}</strong>
          <span>a month at list price, before promo codes (a yearly membership counts a twelfth)</span>
        </li>
        <li>
          <Icon name="bookOpen" size={20} />
          <strong>{data.reading.activeReaders7Days.toLocaleString("en-US")}</strong>
          <span>{data.reading.activeReaders7Days === 1 ? "profile" : "profiles"} read or listened in the last 7 days</span>
        </li>
        <li className={data.stripeEventsToReview > 0 ? "dashboard-warn" : undefined}>
          <Icon name="alert" size={20} />
          <strong>{data.stripeEventsToReview.toLocaleString("en-US")}</strong>
          <span>Stripe {data.stripeEventsToReview === 1 ? "event" : "events"} to review (disputes, refunds, fraud warnings)</span>
        </li>
      </ul>

      <section className="stats-card" aria-labelledby="dash-plans">
        <h2 id="dash-plans">Memberships by plan</h2>
        {/* Focusable so keyboard users can scroll it sideways on a phone. */}
        <div className="dashboard-table-wrap" tabIndex={0} role="region" aria-labelledby="dash-plans">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Active</th>
                <th scope="col">Cancelling</th>
                <th scope="col">Paused</th>
                <th scope="col">Payment due</th>
                <th scope="col">Cancelled</th>
                <th scope="col">Complimentary</th>
              </tr>
            </thead>
            <tbody>
              {data.memberships.map((m) => (
                <tr key={m.plan}>
                  <th scope="row">
                    {m.name}{" "}
                    <span>
                      {formatMoney(m.priceCents, m.currency)} a month
                      {m.yearlyPriceCents !== null && `, ${formatMoney(m.yearlyPriceCents, m.currency)} a year`}
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
        <p className="goal-hint">Active counts paid memberships, monthly and yearly; cancelling ones are active until the end of the month or year they've paid for. Staff memberships are complimentary.</p>
      </section>

      <section className="stats-card" aria-labelledby="dash-weeks">
        <h2 id="dash-weeks">New accounts, week by week</h2>
        <ol className="stats-months" role="list">
          {data.weeklySignUps.map((w) => (
            <li key={w.week}>
              <span className="stats-bar" aria-hidden="true" style={{ "--height": `${(w.count / peak) * 100}%` } as CSSProperties} />
              <span className="stats-month-name">
                <span aria-hidden="true">{shortDay(w.week)}</span>
                <span className="visually-hidden">
                  Week of {shortDay(w.week)}: {count(w.count, "new account", "new accounts")}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="goal-hint">The last 12 weeks, each starting on a Monday; the last bar is this week so far.</p>
      </section>

      <div className="stats-pair">
        <section className="stats-card" aria-labelledby="dash-reading">
          <h2 id="dash-reading">Reading, last 30 days</h2>
          <ul className="dashboard-list" role="list">
            <li>{readingTime(data.reading.minutes30Days * 60)} reading and listening</li>
            <li>{readingTime(data.reading.listeningMinutes30Days * 60)} of it listening</li>
            <li>{count(data.reading.booksFinished30Days, "book", "books")} finished</li>
            <li>
              {count(data.accounts.profiles, "profile", "profiles")} in all, {data.accounts.kidsProfiles.toLocaleString("en-US")} of them Kids
            </li>
          </ul>
        </section>
        <section className="stats-card" aria-labelledby="dash-clubs">
          <h2 id="dash-clubs">Book clubs</h2>
          <ul className="dashboard-list" role="list">
            <li>{count(data.clubs.running, "club", "clubs")} running</li>
            <li>{count(data.clubs.posts30Days, "post", "posts")} in the last 30 days</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
