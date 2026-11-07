import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { Book } from "../types";
import { bookText } from "./narration";
import { usePlayback } from "./playback";
import { nthWord, pageWordCount, placeOfWord, shareOfWord, spokenWordIndex } from "./readAlong";
import { chapterAt, chapterTimes, type ReaderPage } from "./reading";
import { useNaturalVoice } from "./useNaturalVoice";

/** The CSS highlight the spoken word is drawn with (`::highlight(lw-spoken)` in styles/reader.css). */
const HIGHLIGHT = "lw-spoken";

const textOf = (page: ReaderPage | undefined) => (page?.paragraphs ?? []).join("\n");

/** A DOM range over word `n` of the page drawn in `article` (its <p data-offset> paragraphs), or null. */
export function rangeForWord(article: HTMLElement, pageText: string, n: number): Range | null {
  const word = nthWord(pageText, n);
  if (!word) return null;
  const paragraphs = [...article.querySelectorAll<HTMLElement>("p[data-offset]")];
  const p = paragraphs.filter((el) => Number(el.dataset.offset) <= word.start).at(-1);
  if (!p) return null;
  let start = word.start - Number(p.dataset.offset);
  let end = word.end - Number(p.dataset.offset);
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= length) {
      range.setStart(node, start);
      started = true;
    }
    if (started && end <= length) {
      range.setEnd(node, end);
      return range;
    }
    start -= length;
    end -= length;
  }
  return null;
}

/**
 * *Read aloud* in the reader (lib/readAlong.ts), for an upload a natural voice reads: starts the
 * player from the page on screen, turns the pages as the voice moves on, and marks the word being
 * spoken with the CSS Custom Highlight API (where the browser has it), so the page itself and its
 * highlights and selections are untouched.
 */
export function useReaderReadAloud(book: Book, pages: ReaderPage[], index: number, turnTo: (page: number) => void, articleRef: RefObject<HTMLElement | null>) {
  const playback = usePlayback();
  const source = useNaturalVoice(book);
  const offered = Boolean(book.upload) && source !== null;
  const [on, setOn] = useState(false);
  const [texts, setTexts] = useState<string[] | null>(null);
  useEffect(() => {
    if (!offered) return;
    let live = true;
    bookText(book).then(
      (chapters) => live && setTexts(chapters),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [book, offered]);

  const { starts } = useMemo(() => chapterTimes(book), [book]);
  const counts = useMemo(() => pages.map((p) => pageWordCount(textOf(p))), [pages]);
  const snapshot = playback.book?.id === book.id ? playback.snapshot : null;
  const playing = on && Boolean(snapshot?.playing);

  // Where the voice is: the page and the word on it.
  let spoken: { pageIndex: number; word: number } | null = null;
  if (on && snapshot && texts) {
    const c = chapterAt(starts, snapshot.position);
    const length = (book.chapters[c]?.minutes ?? 0) * 60;
    const k = spokenWordIndex(texts[c] ?? "", length ? (snapshot.position - starts[c]) / length : 0);
    const inChapter = pages.flatMap((p, i) => (p.chapterIndex === c ? [i] : []));
    const place = placeOfWord(
      inChapter.map((i) => counts[i]),
      k,
    );
    if (place) spoken = { pageIndex: inChapter[place.page], word: place.word };
  }

  // The pages turn with the voice.
  const turnRef = useRef(turnTo);
  useEffect(() => {
    turnRef.current = turnTo;
  });
  const target = spoken?.pageIndex;
  useEffect(() => {
    if (playing && target !== undefined && target !== index) turnRef.current(target);
  }, [playing, target, index]);

  // The word on this page, marked.
  const word = spoken && spoken.pageIndex === index ? spoken.word : null;
  useEffect(() => {
    const registry = typeof CSS !== "undefined" ? CSS.highlights : undefined;
    if (!registry || typeof Highlight === "undefined") return;
    const range = word !== null && articleRef.current ? rangeForWord(articleRef.current, textOf(pages[index]), word) : null;
    if (range) registry.set(HIGHLIGHT, new Highlight(range));
    else registry.delete(HIGHLIGHT);
  }, [word, index, pages, articleRef]);
  useEffect(
    () => () => {
      if (typeof CSS !== "undefined") CSS.highlights?.delete(HIGHLIGHT);
    },
    [],
  );

  /** Starts the voice at the page on screen (inside the click, so the browser lets it play). */
  const start = () => {
    const page = pages[index];
    if (!page || !texts) return;
    const c = page.chapterIndex;
    const before = pages.reduce((n, p, i) => (i < index && p.chapterIndex === c ? n + counts[i] : n), 0);
    const at = starts[c] + shareOfWord(texts[c] ?? "", before) * (book.chapters[c]?.minutes ?? 0) * 60;
    if (playback.book?.id === book.id) {
      playback.seek(at);
      playback.play();
    } else playback.open(book, { at, autoplay: true });
    setOn(true);
  };
  const stop = () => {
    playback.pause();
    setOn(false);
  };

  return { offered: offered && texts !== null, on: playing, start, stop, word };
}
