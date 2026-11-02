import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { analyticsTags, applyAnalytics, sendPageView } from "../lib/analytics";
import { useActiveProfile } from "../store/context";

/**
 * Keeps Ahrefs Web Analytics (lib/analytics.ts) to what the policies say: a page view per page,
 * as its path only, never while a Kids profile is active or on pages with codes in their links.
 */
export function Analytics() {
  const { pathname } = useLocation();
  const kids = useActiveProfile()?.ageRating === "kids";
  const current = useRef({ pathname, kids });

  useEffect(() => {
    current.current = { pathname, kids };
    if (applyAnalytics(analyticsTags(), pathname, kids)) sendPageView();
  }, [pathname, kids]);

  useEffect(() => {
    // The script loads late (after the page, or once analytics is allowed): count the page then.
    const ready = () => {
      if (applyAnalytics(analyticsTags(), current.current.pathname, current.current.kids)) sendPageView();
    };
    // A tag added while paused (Termly swaps it in after consent) is paused at once.
    const observer = new MutationObserver(() => applyAnalytics(analyticsTags(), current.current.pathname, current.current.kids));
    observer.observe(document.head, { childList: true });
    document.addEventListener("AhrefsAnalytics-ready", ready);
    return () => {
      observer.disconnect();
      document.removeEventListener("AhrefsAnalytics-ready", ready);
    };
  }, []);

  return null;
}
