import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { GrownUpDialog } from "../components/GrownUpDialog";
import { Icon } from "../components/Icon";
import { PinDialog } from "../components/PinDialog";
import { ProfileEditor } from "../components/ProfileEditor";
import { allGenres } from "../data/books";
import { planById } from "../data/plans";
import { ageRatingDetails, lockMinutesLeft } from "../lib/profiles";
import { useProfiles } from "../lib/useProfiles";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";
import { MAX_PROFILES } from "../store/state";
import type { Profile } from "../types";

type Pending = { kind: "manage" } | { kind: "add" } | { kind: "edit"; profile: Profile };

export default function Profiles() {
  useTitle("Who's reading?");
  const { state, dispatch } = useStore();
  const household = useProfiles();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;

  // A child on (or just back from) a Kids profile can't reach profile settings without a grown-up.
  const { profiles, account } = state;
  const guardProfile = profiles.find((p) => p.id === (state.activeProfileId ?? state.lastProfileId));
  const kidsGuard = guardProfile?.ageRating === "kids";
  // Account's "Manage profiles" link opens straight into managing (asking a grown-up first on Kids).
  const askedToManage = params.get("manage") === "1";

  const [managing, setManaging] = useState(askedToManage && !kidsGuard);
  const [editing, setEditing] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null });
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [grownUpFor, setGrownUpFor] = useState<Pending | null>(askedToManage && kidsGuard ? { kind: "manage" } : null);
  const [grownUpOk, setGrownUpOk] = useState(false);

  const plan = account?.planId ? planById.get(account.planId) : undefined;
  const profileLimit = Math.min(plan?.profiles ?? 1, MAX_PROFILES);
  const canAdd = profiles.length < profileLimit;
  const needsGrownUp = kidsGuard && !grownUpOk;

  const run = (action: Pending) => {
    if (action.kind === "manage") setManaging(true);
    if (action.kind === "add") setEditing({ open: true, profile: null });
    if (action.kind === "edit") setEditing({ open: true, profile: action.profile });
  };
  const guarded = (action: Pending) => (needsGrownUp ? setGrownUpFor(action) : run(action));

  const enter = (profile: Profile) => {
    dispatch({ type: "selectProfile", id: profile.id });
    navigate(from && from !== "/profiles" ? from : "/browse");
  };

  const choose = (profile: Profile) => {
    if (managing) return guarded({ kind: "edit", profile });
    if (profile.hasPin) return setPinFor(profile);
    enter(profile);
  };

  // Step 3 of sign-up: pick genres for the first profile.
  const setupProfile = params.get("setup") === "1" && profiles.length === 1 ? profiles[0] : null;
  if (setupProfile) {
    return (
      <GenreSetup
        profile={setupProfile}
        onDone={async (genres) => {
          try {
            await household.setGenres(setupProfile, genres);
          } catch {
            // Genres only seed recommendations: keep them for this visit and carry on.
            dispatch({ type: "updateProfile", id: setupProfile.id, patch: { favoriteGenres: genres } });
          }
          setParams({}, { replace: true });
        }}
      />
    );
  }

  return (
    <section className="profiles-page" aria-labelledby="profiles-title">
      <h1 id="profiles-title">{managing ? "Manage profiles" : "Who's reading?"}</h1>
      <p className="profiles-sub">
        {managing ? "Choose a profile to edit it." : "Each profile has its own shelf, history and recommendations."}
      </p>

      <ul className="profile-grid">
        {profiles.map((p) => {
          const locked = lockMinutesLeft(p) > 0;
          // The accessible name comes from the visible text plus this hidden state, so it always
          // contains what sighted users see (WCAG 2.5.3 Label in Name).
          const status = managing ? "edit" : p.hasPin ? (locked ? "locked" : "PIN required") : null;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`profile-tile${managing ? " is-managing" : ""}`}
                onClick={() => choose(p)}
              >
                <span className="profile-tile-avatar">
                  <Avatar name={p.name} avatar={p.avatar} size={112} />
                  {managing && (
                    <span className="profile-tile-badge edit" aria-hidden="true">
                      <Icon name="edit" size={16} />
                    </span>
                  )}
                  {!managing && p.hasPin && (
                    <span className="profile-tile-badge" aria-hidden="true">
                      <Icon name="lock" size={15} />
                    </span>
                  )}
                </span>
                <span className="profile-tile-name">{p.name}</span>
                <span className="profile-tile-meta">
                  {p.ageRating !== "all" && (
                    <span className="rating-chip">
                      {ageRatingDetails[p.ageRating].label}
                      <span className="visually-hidden"> profile</span>
                    </span>
                  )}
                  {p.dailyLimitMinutes && (
                    <span className="rating-chip">
                      <Icon name="clock" size={12} /> {p.dailyLimitMinutes} min
                      <span className="visually-hidden"> daily limit</span>
                    </span>
                  )}
                </span>
                {status && <span className="visually-hidden">({status})</span>}
              </button>
            </li>
          );
        })}
        {canAdd && (
          <li>
            <button
              type="button"
              className="profile-tile add"
              onClick={() => guarded({ kind: "add" })}
            >
              <span className="profile-tile-avatar add-avatar">
                <Icon name="plus" size={36} />
              </span>
              <span className="profile-tile-name">Add profile</span>
              <span className="profile-tile-meta">
                {profiles.length} of {profileLimit} used
              </span>
            </button>
          </li>
        )}
      </ul>

      {!canAdd && profiles.length < MAX_PROFILES && plan && (
        <p className="profiles-note">
          Your {plan.name} plan includes {profileLimit === 1 ? "1 profile" : `${profileLimit} profiles`}.{" "}
          <Link to="/plans">Change plan</Link> to add more.
        </p>
      )}

      <div className="profiles-actions">
        {managing ? (
          <button type="button" className="primary-button" onClick={() => setManaging(false)}>
            Done
          </button>
        ) : (
          <button type="button" className="secondary-button" onClick={() => guarded({ kind: "manage" })}>
            <Icon name="settings" size={17} /> Manage profiles
          </button>
        )}
      </div>

      <ProfileEditor open={editing.open} profile={editing.profile} onClose={() => setEditing({ open: false, profile: null })} />
      <PinDialog
        profile={pinFor}
        onClose={() => setPinFor(null)}
        onUnlocked={(p) => {
          setPinFor(null);
          enter(p);
        }}
      />
      <GrownUpDialog
        open={Boolean(grownUpFor)}
        action={grownUpFor?.kind === "add" ? "add a profile" : "manage profiles"}
        onClose={() => setGrownUpFor(null)}
        onConfirmed={() => {
          const action = grownUpFor;
          setGrownUpOk(true);
          setGrownUpFor(null);
          if (action) run(action);
        }}
      />
    </section>
  );
}

function GenreSetup({ profile, onDone }: { profile: Profile; onDone: (genres: string[]) => Promise<void> }) {
  const [genres, setGenres] = useState<string[]>(profile.favoriteGenres);
  const toggle = (g: string) => setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  return (
    <section className="profiles-page setup" aria-labelledby="setup-title">
      <p className="eyebrow">Step 3 of 3</p>
      <h1 id="setup-title">What do you like to read, {profile.name}?</h1>
      <p className="profiles-sub">Pick a few genres to start your recommendations. You can change them later.</p>
      <fieldset className="chip-group chip-group-lg">
        <legend className="visually-hidden">Favorite genres</legend>
        {allGenres.map((g) => (
          <label key={g} className="chip">
            <input type="checkbox" checked={genres.includes(g)} onChange={() => toggle(g)} />
            <span>
              {genres.includes(g) && <Icon name="check" size={14} />}
              {g}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="profiles-actions">
        <button type="button" className="primary-button" onClick={() => onDone(genres)}>
          {genres.length ? `Continue with ${genres.length} ${genres.length === 1 ? "genre" : "genres"}` : "Skip for now"}
        </button>
      </div>
    </section>
  );
}
