import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyCanonical } from "../lib/canonical";

/**
 * Keeps `<link rel="canonical">` and og:url on the page you're on (lib/seo.ts canonicalUrl()). The
 * pages in the sitemap are built with theirs (lib/publicPages.ts); every other address is served
 * shell.html, which has none, so main.tsx sets them before the app first draws and this follows
 * each move. vercel.json also sends public pages' canonical as an HTTP `Link` header.
 */
export function Canonical() {
  const { pathname } = useLocation();
  useEffect(() => applyCanonical(pathname), [pathname]);
  return null;
}
