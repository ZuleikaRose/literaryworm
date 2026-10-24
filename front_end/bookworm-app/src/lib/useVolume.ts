import { useCallback, useEffect, useState } from "react";
import { BooksApiError, fetchVolume, type VolumeDetail } from "./booksApi";

type VolumeState =
  | { id: string; status: "loading" }
  | { id: string; status: "ready"; volume: VolumeDetail }
  | { id: string; status: "error"; code: string; message: string };

/** A Google Books title for its details page. Pass null to skip (catalog titles). */
export function useVolume(id: string | null) {
  const [state, setState] = useState<VolumeState | null>(id ? { id, status: "loading" } : null);
  const [attempt, setAttempt] = useState(0);

  // A different book starts loading straight away (adjusting state during render).
  if ((state?.id ?? null) !== id) setState(id ? { id, status: "loading" } : null);

  useEffect(() => {
    if (!id) return;
    let current = true;
    fetchVolume(id)
      .then((volume) => current && setState({ id, status: "ready", volume }))
      .catch((err: unknown) => {
        if (!current) return;
        const { code, message } =
          err instanceof BooksApiError ? err : { code: "unknown", message: "Something went wrong loading this book. Try again." };
        setState({ id, status: "error", code, message });
      });
    return () => {
      current = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    if (!id) return;
    setState({ id, status: "loading" });
    setAttempt((a) => a + 1);
  }, [id]);

  return { state: state?.id === id ? state : null, retry };
}
