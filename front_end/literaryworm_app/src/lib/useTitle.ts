import { useEffect } from "react";
import { documentTitle } from "./publicPages";
import { siteDescription } from "./seo";

/** Sets the tab title, so screen-reader users hear where they landed, and the page's description for search results. */
export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = documentTitle(title);
  }, [title]);
  useEffect(() => {
    if (!description) return;
    const tags = ['meta[name="description"]', 'meta[property="og:description"]'].map((s) => document.querySelector<HTMLMetaElement>(s));
    for (const tag of tags) tag?.setAttribute("content", description);
    return () => {
      for (const tag of tags) tag?.setAttribute("content", siteDescription());
    };
  }, [description]);
}
