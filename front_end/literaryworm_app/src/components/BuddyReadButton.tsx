import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { buddyFinish, buddyName, newInviteCode } from "../lib/clubs";
import { today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { useActiveProfile } from "../store/context";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * *Read with a friend* on a catalog book's page: starts a buddy read (a club for two, lib/clubs.ts)
 * in one tap and opens it, where the invite code waits. Not on Kids profiles, like every club.
 */
export function BuddyReadButton({ book }: { book: Book }) {
  const profile = useActiveProfile();
  const clubs = useClubs();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile || profile.ageRating === "kids") return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const now = today();
      const id = await clubs.create({ name: buddyName(book.title), bookId: book.id, bookTitle: null, bookAuthor: null, startsOn: now, finishesOn: buddyFinish(now), inviteCode: newInviteCode(), buddy: true });
      navigate(`/clubs/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the buddy read. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary-button" disabled={busy} onClick={start}>
        <Icon name="users" size={17} /> {busy ? "Starting…" : "Read with a friend"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </>
  );
}
