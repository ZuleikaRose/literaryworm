import { useState } from "react";
import { getBook } from "../data/books";
import { canFillShelf } from "../lib/familyShelf";
import { useFamilyShelf } from "../lib/useFamilyShelf";
import { useT } from "../lib/useT";
import { useActiveProfile } from "../store/context";
import { Icon } from "./Icon";

/**
 * Add to the family shelf / On the family shelf, on a catalog book's page, for grown-up and teen
 * profiles. The shelf shows on every profile's Home (Kids profiles only see what they may open).
 */
export function FamilyShelfButton({ bookId }: { bookId: string }) {
  const profile = useActiveProfile();
  const shelf = useFamilyShelf();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile || !canFillShelf(profile) || !getBook(bookId) || !shelf.loaded) return null;
  const on = shelf.has(bookId);

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      await (on ? shelf.remove(bookId) : shelf.add(profile!.id, bookId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't change the family shelf. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="ghost-button" aria-pressed={on} disabled={busy} onClick={toggle}>
        <Icon name={on ? "check" : "users"} size={17} /> {on ? t("On the family shelf") : t("Add to the family shelf")}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </>
  );
}
