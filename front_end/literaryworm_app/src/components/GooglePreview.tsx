import { useRef, useState } from "react";
import { ESSENTIAL } from "../lib/consent";
import { Icon } from "./Icon";

/**
 * Google Books' embedded viewer for titles Google lets other sites show. It loads from
 * google.com only when the reader asks for it (Google may set its own cookies then), so it's
 * marked essential: the consent banner would otherwise hold back something the reader chose.
 */
export function GooglePreview({ id, title, kind }: { id: string; title: string; kind: "full" | "partial" }) {
  const [open, setOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const src = `https://books.google.com/books?${new URLSearchParams({ id, lpg: "PP1", pg: "PP1", output: "embed" })}`;

  return (
    <section className="book-preview" aria-labelledby="preview-title">
      <p className="eyebrow">From Google Books</p>
      <h2 id="preview-title">{kind === "full" ? "Read it on Google Books" : "Preview"}</h2>
      {open ? (
        <>
          <iframe
            ref={frameRef}
            className="book-preview-frame"
            {...ESSENTIAL}
            src={src}
            title={`Google Books ${kind === "full" ? "viewer" : "preview"}: ${title}`}
            loading="lazy"
            allowFullScreen
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setOpen(false);
              requestAnimationFrame(() => openRef.current?.focus());
            }}
          >
            Close the preview
          </button>
        </>
      ) : (
        <>
          <p className="book-preview-intro">
            {kind === "full"
              ? "Google Books shows every page of this edition. It opens in Google's viewer here on the page."
              : "Google Books shows some pages of this edition. They open in Google's viewer here on the page."}{" "}
            Google may set its own cookies when it loads.
          </p>
          <button
            ref={openRef}
            type="button"
            className="secondary-button"
            onClick={() => {
              setOpen(true);
              // Into the viewer, so keyboard and screen reader users land in it.
              requestAnimationFrame(() => frameRef.current?.focus());
            }}
          >
            <Icon name="bookOpen" size={17} /> {kind === "full" ? "Open Google's viewer" : "Open the preview"}
          </button>
        </>
      )}
    </section>
  );
}
