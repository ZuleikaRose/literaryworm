import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { hasRole, roleLabel, STAFF_ROLES, type StaffMember, type StaffRole } from "../lib/staff";
import { grantStaffRole, loadStaff, revokeStaffRole } from "../lib/staffApi";
import { Icon } from "./Icon";

/**
 * Account → Team access, for members with a staff role. Everyone with a role sees theirs; admins
 * also see the team, give a role to an email (an invitation if they haven't signed up yet) and
 * remove roles.
 */
export function TeamAccess({ roles }: { roles: StaffRole[] }) {
  const isAdmin = roles.includes("admin");
  return (
    <div className="team-access">
      <p>
        Your access: <strong>{roles.map(roleLabel).join(", ")}</strong>.
      </p>
      <ul className="team-roles" aria-label="What each role can do">
        {STAFF_ROLES.map((r) => (
          <li key={r.value}>
            <strong>{r.label}</strong> <span>{r.description}</span>
          </li>
        ))}
      </ul>
      <p className="goal-hint">
        Every role comes with a complimentary Premium membership, never charged, for as long as it's held. When someone's last
        role is removed, it ends and they can choose a plan.
      </p>
      {(hasRole(roles, "billing") || hasRole(roles, "customer_service")) && (
        <p className="team-tools">
          {hasRole(roles, "billing") && (
            <Link className="secondary-button" to="/dashboard">
              Open the dashboard
            </Link>
          )}
          {hasRole(roles, "customer_service") && (
            <Link className="secondary-button" to="/support">
              Look up a member
            </Link>
          )}
        </p>
      )}
      {isAdmin && <TeamManager />}
    </div>
  );
}

function TeamManager() {
  const [team, setTeam] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("editor");
  const [busy, setBusy] = useState(false);
  const id = useId();

  const reload = useCallback(
    () =>
      loadStaff().then(
        (list) => setTeam(list),
        (err: Error) => setError(err.message),
      ),
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  const grant = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const result = await grantStaffRole(email, role);
      setDone(
        result === "invited"
          ? `${email.trim()} has no account yet. They'll be ${roleLabel(role)} as soon as they sign up with that email.`
          : `${email.trim()} is now ${roleLabel(role)}.`,
      );
      setEmail("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't give that access. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (member: StaffMember, r: StaffRole) => {
    setError(null);
    setDone(null);
    try {
      await revokeStaffRole(member.email, r);
      setDone(`${member.email} is no longer ${roleLabel(r)}.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't remove that access. Try again.");
    }
  };

  return (
    <>
      <h3 className="team-heading">The team</h3>
      {team === null && !error && (
        <p className="goal-hint" role="status">
          Loading the team…
        </p>
      )}
      {team && (
        <ul className="team-list" role="list">
          {team.map((m) => (
            <li key={m.email}>
              <span className="team-who">
                <strong>{m.name ?? m.email}</strong>
                <small>
                  {m.name ? m.email : ""}
                  {m.invited ? (m.name ? " · " : "") + "invited, not signed up yet" : ""}
                </small>
              </span>
              <span className="team-chips">
                {m.roles.map((r) => (
                  <span key={r} className="team-chip">
                    {roleLabel(r)}
                    <button type="button" className="icon-button" onClick={() => revoke(m, r)}>
                      <Icon name="close" size={14} />
                      <span className="visually-hidden">
                        Remove {roleLabel(r)} from {m.email}
                      </span>
                    </button>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="team-grant" onSubmit={grant} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-email`}>
            Email
          </label>
          <input
            id={`${id}-email`}
            className="field-input"
            type="email"
            autoComplete="off"
            value={email}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-role`}>
            Access
          </label>
          <select id={`${id}-role`} className="field-input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="primary-button small-button" disabled={busy || !email.trim()}>
          {busy ? "Giving access…" : "Give access"}
        </button>
        <p className="goal-hint" id={`${id}-hint`}>
          Someone without an account gets the access, and the complimentary membership, when they sign up with this email.
        </p>
      </form>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <p className="form-success" role="status" hidden={!done}>
        <Icon name="check" size={16} /> {done}
      </p>
    </>
  );
}
