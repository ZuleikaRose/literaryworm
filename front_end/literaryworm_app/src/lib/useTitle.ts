import { useEffect } from "react";

/** Sets the tab title, so screen-reader users hear where they landed. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · LiteraryWorm` : "LiteraryWorm";
  }, [title]);
}
