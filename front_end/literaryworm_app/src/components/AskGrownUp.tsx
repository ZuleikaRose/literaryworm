import { useId, useState } from "react";
import type { Book } from "../types";
import { AccountError } from "../lib/accountApi";
import { canAsk, requestFor } from "../lib/bookRequests";
import { useBookRequests } from "../lib/useBookRequests";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useActiveProfile } from "../store/context";
import { Icon } from "./Icon";

/**
 * On a book that isn't on a Kids profile's shelf: Ask a grown-up, then where the request
 * stands. A grown-up answers in Account → Family; a yes opens the book (lib/bookRequests.ts).
 */
export function AskGrownUp({ book }: { book: Book }) {
  const profile = useActiveProfile();
  const { requestsOf, ask, remove } = useBookRequests();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const t = useT();
  if (!profile || !canAsk(book, profile)) return null;
  const request = requestFor(requestsOf(profile.id), book.id);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ask-grown-up">
      {!request ? (
        <button type="button" className="primary-button" disabled={busy} aria-describedby={error ? errorId : undefined} onClick={() => run(() => ask(profile, book.id))}>
          <Icon name="bell" size={17} /> {busy ? t("Asking…") : t("Ask a grown-up")}
        </button>
      ) : request.status === "pending" ? (
        <>
          <p role="status">
            <Icon name="check" size={16} /> {rich(t("You asked for {title}. A grown-up can say yes in Account → Family."), { title: <cite>{book.title}</cite> })}
          </p>
          <button type="button" className="text-button" disabled={busy} onClick={() => run(() => remove(profile, book.id))}>
            {t("Don't ask after all")}
          </button>
        </>
      ) : request.status === "declined" ? (
        <p role="status">{t("A grown-up said not this one for now. Talk to them if you'd still like to read it.")}</p>
      ) : null}
      {error && (
        <p className="field-error" id={errorId}>
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </div>
  );
}
