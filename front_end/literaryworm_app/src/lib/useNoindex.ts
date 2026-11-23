import { useEffect } from "react";

/**
 * Asks search engines not to index the page while it's shown (`<meta name="robots" content="noindex">`):
 * the not-found page and a search's results. vercel.json sends the same as an X-Robots-Tag header for
 * the addresses it knows ahead (members' pages, logging in, searches with a query).
 */
export function useNoindex(active = true) {
  useEffect(() => {
    if (!active) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [active]);
}
