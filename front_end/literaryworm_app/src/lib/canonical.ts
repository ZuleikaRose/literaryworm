import { canonicalUrl } from "./seo";

/**
 * Points `<link rel="canonical">` and og:url at a path's one address (canonicalUrl()), adding them if
 * the page has none: shell.html, served for every address not built ahead, has neither.
 */
export function applyCanonical(pathname: string) {
  const href = canonicalUrl(pathname);
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
  let og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!og) {
    og = document.createElement("meta");
    og.setAttribute("property", "og:url");
    document.head.appendChild(og);
  }
  og.content = href;
}
