import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as accountApi from "../lib/accountApi";
import { confirmVisitorAdult } from "../lib/adultGate";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";
import { Icon } from "./Icon";

/**
 * Shown instead of a book marked mature until an adult profile (once, kept with the profile) or a
 * visitor (once a visit) confirms they're 18 or older (lib/adultGate.ts). Kids and Teen profiles
 * never get here: their page says the book isn't on their shelf.
 */
export function AdultGate({ onConfirmed }: { onConfirmed: () => void }) {
  const t = useT();
  useTitle(t("This book is for adults"));
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const confirm = () => {
    if (!profile) {
      confirmVisitorAdult();
      onConfirmed();
      return;
    }
    // Shown straight away; members' answer is kept for every device in the background.
    dispatch({ type: "patchProfileData", patch: { matureOkAt: Date.now() } });
    if (state.account?.userId && !state.account.isDemo) {
      accountApi.saveMatureOk(profile.id).catch((err: Error) => setError(err.message));
    }
    onConfirmed();
  };

  return (
    <section className="page empty-state" aria-labelledby="adult-gate-title">
      <span className="empty-icon">
        <Icon name="lock" size={28} />
      </span>
      <h1 id="adult-gate-title" ref={heading} tabIndex={-1}>
        {t("This book is for adults")}
      </h1>
      <p>{t("It's marked as mature. Continue only if you're 18 or older.")}</p>
      {profile && <p className="goal-hint">{t("We'll remember your answer for this profile.")}</p>}
      <p className="goal-actions">
        <button type="button" className="primary-button" onClick={confirm}>
          {t("I'm 18 or older, show it")}
        </button>
        <button type="button" className="secondary-button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
          {t("Go back")}
        </button>
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}
