import { useEffect } from "react";

/**
 * Adds a page's own schema.org data (lib/seo.ts) to the head while the page is shown, and takes it
 * away when the page goes, so each address describes only what it shows. index.html keeps the
 * site-wide data (WebSite and Organization).
 */
export function StructuredData({ id, data }: { id: string; data: unknown }) {
  const json = JSON.stringify(data);
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.structured = id;
    script.textContent = json;
    document.head.appendChild(script);
    return () => script.remove();
  }, [id, json]);
  return null;
}
