/**
 * One part of a page's path, spelled the one way the site uses everywhere: links (personPath(),
 * seriesPath()), canonical links (seo.ts canonicalUrl()), the sitemap and vercel.json's Link headers.
 * Everything but letters, digits and "-._~" is percent-encoded, with capital hex digits, so
 * "Aunt Jane's Nieces" is `Aunt%20Jane%27s%20Nieces` (encodeURIComponent alone leaves the apostrophe,
 * and a link spelled that way is another address to a search engine, reported as an "Alternate page
 * with proper canonical tag").
 */
export function pathSegment(text: string): string {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
