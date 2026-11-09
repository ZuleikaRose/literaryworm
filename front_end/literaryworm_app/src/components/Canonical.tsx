import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalUrl } from "../lib/seo";

/**
 * Keeps `<link rel="canonical">` and og:url on the page you're on (lib/seo.ts canonicalUrl()). Set here
 * rather than in index.html, which every route is served: a fixed tag there would point every page
 * at the home page for crawlers that don't run the app. For those, vercel.json sends the same address
 * as an HTTP `Link: <…>; rel="canonical"` header on every public page (canonicalHeaders.test.ts).
 */
export function Canonical() {
  const { pathname } = useLocation();
  useEffect(() => {
    const href = canonicalUrl(pathname);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", href);
  }, [pathname]);
  return null;
}
