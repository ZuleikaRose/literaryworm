import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { isInviteCode } from "../lib/clubs";
import { useClubs } from "../lib/useClubs";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile } from "../store/context";

type State = { status: "joining" } | { status: "wrong" } | { status: "error"; message: string };

/**
 * /clubs/join/:code: where a club invitation email links. Visitors sign in first (the route
 * guard brings them back here); then this joins with the code and opens the club.
 */
export default function JoinClub() {
  useTitle("Join a book club");
  const { code = "" } = useParams();
  const clubs = useClubs();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const kids = profile?.ageRating === "kids";
  const valid = isInviteCode(code);
  const [state, setState] = useState<State>({ status: "joining" });
  const [attempt, setAttempt] = useState(0);
  // One join per attempt, even when React runs the effect twice in development.
  const started = useRef(-1);

  useEffect(() => {
    if (kids || !valid || started.current === attempt) return;
    started.current = attempt;
    clubs.join(code).then(
      (id) => (id ? navigate(`/clubs/${id}`, { replace: true }) : setState({ status: "wrong" })),
      (err: Error) => setState({ status: "error", message: err.message }),
    );
  }, [kids, valid, code, clubs, navigate, attempt]);

  const retry = () => {
    setState({ status: "joining" });
    setAttempt((n) => n + 1);
  };

  let body;
  if (kids) {
    body = <p className="account-sub">Book clubs are for grown-up profiles. Switch profile to join this one.</p>;
  } else if (!valid || state.status === "wrong") {
    body = (
      <div className="form-alert">
        <Icon name="alert" size={17} />
        <p>
          That club link doesn't work any more: the club may have changed its code or been deleted. Ask for a new link, or enter a code
          in <Link to="/library?view=clubs">My Library → Clubs</Link>.
        </p>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <>
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} />
          {state.message}
        </p>
        <button type="button" className="primary-button" onClick={retry}>
          Try again
        </button>
      </>
    );
  } else {
    body = (
      <p className="account-sub" role="status">
        Joining the club…
      </p>
    );
  }

  return (
    <div className="page join-club-page">
      <h1>Join a book club</h1>
      {body}
    </div>
  );
}
