import { useState } from "react";
import { canQueue, UP_NEXT_MAX } from "../lib/upNext";
import { useUpNext } from "../lib/useUpNext";
import { useT } from "../lib/useT";
import type { Book } from "../types";
import { Icon } from "./Icon";

/** Add to Up next / In Up next, for catalog audiobooks on the book page. */
export function UpNextButton({ book }: { book: Book }) {
  const upNext = useUpNext();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!canQueue(book)) return null;
  const queued = upNext.has(book.id);

  async function toggle() {
    setError(null);
    if (!queued && upNext.full) {
      setError(t("Up next holds up to {max} books. Remove one in My Library → Up next first.", { max: UP_NEXT_MAX }));
      return;
    }
    setBusy(true);
    try {
      await (queued ? upNext.remove(book.id) : upNext.add(book.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't change Up next. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="ghost-button" aria-pressed={queued} disabled={busy} onClick={toggle}>
        <Icon name={queued ? "check" : "list"} size={17} /> {queued ? t("In Up next") : t("Add to Up next")}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </>
  );
}
