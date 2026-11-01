import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import type { YearStats } from "../lib/stats";
import { YEAR_CARD_THEMES, type YearCardTheme } from "../lib/yearCard";
import { slideBlob, slideFileName, slideText, storySlides } from "../lib/yearStory";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { ShareImage } from "./ShareImage";

/**
 * My Library → Stats → Play as a story: the year one screen at a time (lib/yearStory.ts), each
 * shared, downloaded or copied like the year card. Previous and Next (or the arrow keys) move
 * between screens; each fades in unless motion is reduced.
 */
export function YearStoryDialog({ open, onClose, name, stats, goal }: { open: boolean; onClose: () => void; name: string; stats: YearStats; goal: number | null }) {
  return (
    <Dialog open={open} onClose={onClose} title="Your year as a story" eyebrow={`${stats.year} in books`}>
      {open && <YearStory name={name} stats={stats} goal={goal} />}
    </Dialog>
  );
}

function YearStory({ name, stats, goal }: { name: string; stats: YearStats; goal: number | null }) {
  const slides = useMemo(() => storySlides(name, stats, goal), [name, stats, goal]);
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const draw = useCallback((theme: YearCardTheme) => slideBlob(slide, theme, index, slides.length), [slide, index, slides.length]);
  const go = (to: number) => setIndex(Math.max(0, Math.min(slides.length - 1, to)));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="year-story" onKeyDown={onKey}>
      <p className="year-story-count" role="status">
        Screen {index + 1} of {slides.length}
      </p>
      <div className="year-story-slide" key={slide.id}>
        <ShareImage
          themes={YEAR_CARD_THEMES}
          draw={draw}
          fileName={slideFileName(stats.year, slide)}
          shareTitle={`${name}'s ${stats.year} in books`}
          text={slideText(slide)}
          copyLabel="Copy as text"
          copiedMessage="Copied."
          height={1920}
        />
      </div>
      <div className="year-story-nav">
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => go(index - 1)}>
          <Icon name="chevronLeft" size={17} /> Previous
        </button>
        <button type="button" className="primary-button" disabled={index === slides.length - 1} onClick={() => go(index + 1)}>
          Next <Icon name="chevronRight" size={17} />
        </button>
      </div>
    </div>
  );
}
