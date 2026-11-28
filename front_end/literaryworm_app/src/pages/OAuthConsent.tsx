import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AccountPasswordField } from "../components/AccountPasswordField";
import { Icon } from "../components/Icon";
import { AccountError } from "../lib/accountApi";
import { isRequestId, returnPlace } from "../lib/connectedApps";
import { allowConnection, type ConnectionRequest, connectionRequest, refuseConnection } from "../lib/connectedAppsApi";
import { rich } from "../lib/i18n";
import { useAccount } from "../lib/useAccount";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile } from "../store/context";

type State = { status: "loading" } | { status: "ready"; details: ConnectionRequest } | { status: "gone"; message: string } | { status: "leaving"; app: string };

/**
 * /oauth/consent?request=…: where an AI assistant (MCP) or the command line sends a member to
 * allow it to read their account. Visitors log in first (the route guard brings them back here).
 * It shows what the app calls itself, where it sends the member back and exactly what it can
 * read (and, when the app asks and the member leaves it on, change in the library), and allowing
 * asks for the account password, so a profile left open can't connect an app.
 * The `mcp` function does the checking; this page only asks and then sends the browser on.
 */
export default function OAuthConsent() {
  const t = useT();
  useTitle(t("Connect an app"));
  const [params] = useSearchParams();
  const request = params.get("request");
  const valid = isRequestId(request);
  const { account, remote } = useAccount();
  const profile = useActiveProfile();
  const kids = profile?.ageRating === "kids";
  const able = valid && remote && !kids;
  const [state, setState] = useState<State>({ status: "loading" });
  const [password, setPassword] = useState("");
  // Only asked about when the app asked to change the library; on until the member turns it off.
  const [library, setLibrary] = useState(true);
  const [busy, setBusy] = useState<"allow" | "refuse" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!able || !request) return;
    let live = true;
    connectionRequest(request).then(
      (details) => live && setState({ status: "ready", details }),
      (err: Error) => live && setState({ status: "gone", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [able, request]);

  const answer = async (kind: "allow" | "refuse") => {
    if (!request || state.status !== "ready") return;
    if (kind === "allow" && !password) {
      setError(t("Enter your account password."));
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const to = kind === "allow" ? await allowConnection(request, password, state.details.library && library) : await refuseConnection(request);
      setState({ status: "leaving", app: state.details.app });
      window.location.assign(to);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void answer("allow");
  };

  let body;
  if (!valid) {
    body = <Alert>{t("This link is missing its request. Go back to the app and connect again.")}</Alert>;
  } else if (account?.isDemo || !remote) {
    body = <Alert>{t("The demo household can't connect apps. Log in to your own account to connect one.")}</Alert>;
  } else if (kids) {
    body = <Alert>{t("Connecting an app is for grown-ups. Switch to a grown-up profile to carry on.")}</Alert>;
  } else if (state.status === "loading") {
    body = <p role="status">{t("Loading…")}</p>;
  } else if (state.status === "gone") {
    body = <Alert>{state.message}</Alert>;
  } else if (state.status === "leaving") {
    body = (
      <p className="form-success" role="status">
        <Icon name="check" size={17} /> {t("Going back to {app}. You can close this tab once it has your answer.", { app: state.app })}
      </p>
    );
  } else {
    const { app, redirectUri, library: asksLibrary } = state.details;
    const place = returnPlace(redirectUri);
    const where = place?.kind === "web" ? place.host : place?.kind === "device" ? t("a program on this device") : place ? t("an app on this device ({scheme})", { scheme: place.scheme }) : redirectUri;
    body = (
      <form className="account-form" onSubmit={submit} noValidate>
        <h2 className="consent-app">{t("Connect {app} to LiteraryWorm?", { app })}</h2>
        <p>{t("It's asking to read your LiteraryWorm account. It will be able to read:")}</p>
        <ul className="consent-list">
          <li>{t("Your library and how far through each book you are")}</li>
          <li>{t("Your highlights and the notes on them")}</li>
          <li>{t("Reading time for grown-up and teen profiles")}</li>
        </ul>
        {asksLibrary && (
          <label className="check-row consent-library">
            <input type="checkbox" checked={library} onChange={(e) => setLibrary(e.target.checked)} />
            <span>
              <strong>{t("It also asks to change your library")}</strong>
              <small>{t("Add LiteraryWorm books to your library and change a book's status, such as marking it finished. It can't remove books, and never touches books read on a Kids profile. Leave this off and it only reads.")}</small>
            </span>
          </label>
        )}
        <p>
          {rich(
            asksLibrary && library
              ? t("It can't change anything else. It never sees your password or payment details, or a Kids profile's reading time. You can remove it at any time in {place}.")
              : t("It can't change anything. It never sees your password or payment details, or a Kids profile's reading time. You can remove it at any time in {place}."),
            { place: <Link to="/account#sign-in">{t("Account → Sign-in")}</Link> },
          )}
        </p>
        <p className="field-hint">
          {rich(t("If you allow it, you'll be sent back to {place}. Only allow an app you started connecting yourself."), { place: <strong className="consent-place">{where}</strong> })}
        </p>
        <AccountPasswordField value={password} onChange={setPassword} error={null} />
        {error && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{error}</p>
          </div>
        )}
        <div className="goal-actions">
          <button type="submit" className="primary-button" disabled={busy !== null}>
            {busy === "allow" ? t("Allowing…") : t("Allow")}
          </button>
          <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void answer("refuse")}>
            {t("Don't allow")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="page legal-page">
      <h1>{t("Connect an app")}</h1>
      {body}
    </article>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <div className="form-alert" role="alert">
      <Icon name="alert" size={17} />
      <p>{children}</p>
    </div>
  );
}
