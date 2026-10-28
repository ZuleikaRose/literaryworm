import { type CSSProperties, useId, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayback } from "../lib/playback";
import { formatTime } from "../lib/reading";
import { usePlayerControls } from "../lib/usePlayerControls";
import { usePopover } from "../lib/usePopover";
import type { Book } from "../types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { DevicesDialog, JumpDialog, type JumpSection, PlayerSettingsDialog, VolumeControl } from "./PlayerControls";

type Panel = "jump" | "settings" | "devices" | null;

/**
 * The audiobook that's playing, at the bottom of every page (above the tab bar on phones), so
 * it keeps playing while the member browses. It shows the title and the chapter, has the main
 * controls, and the rest (chapters, Go to, volume, settings, another device) in More. The title
 * opens the full player, which has the same controls.
 */
export function MiniPlayer() {
  const { book, snapshot } = usePlayback();
  if (!book || !snapshot) return null;
  return <MiniPlayerView key={book.id} book={book} />;
}

function MiniPlayerView({ book }: { book: Book }) {
  const playback = usePlayback();
  const controls = usePlayerControls(book);
  const { live, places, player, total, position } = controls;
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu, wrapRef, triggerRef } = usePopover();
  const menuId = useId();
  const [panel, setPanel] = useState<Panel>(null);
  const [section, setSection] = useState<JumpSection>("contents");
  if (!live) return null;

  const chapter = book.chapters[places.chapterIndex];
  const chapterName = chapter.title === `Chapter ${places.chapterIndex + 1}` ? chapter.title : `${places.chapterIndex + 1}. ${chapter.title}`;
  const locked = live.limitReached;
  const status = locked ? (
    "Today's listening time is used up"
  ) : live.finished ? (
    "Finished"
  ) : (
    <>
      {chapterName} · <span aria-hidden="true">−</span>
      {formatTime(places.chapterEnd - position)}
      <span className="visually-hidden"> left in the chapter</span>
    </>
  );

  /** Runs a menu choice: the menu closes first, handing focus back to More (where dialogs return it). */
  const choose = (action: (() => void) | null) => () => {
    closeMenu();
    action?.();
  };
  const jump = (to: JumpSection) =>
    choose(() => {
      setSection(to);
      setPanel("jump");
    });

  return (
    <section className="mini-player" aria-label="Now playing">
      <span className="mini-progress" aria-hidden="true" style={{ "--fill": `${(position / total) * 100}%` } as CSSProperties} />
      <Link className="mini-info" to={`/listen/${book.id}`}>
        <Cover book={book} size="sm" className="mini-cover" />
        <span className="mini-text">
          <strong>{book.title}</strong>
          <small>{status}</small>
        </span>
        <span className="visually-hidden">. Open the player</span>
      </Link>
      <div className="mini-controls">
        <button type="button" className="icon-button mini-wide" disabled={locked || !controls.previousChapter} onClick={controls.previousChapter ?? undefined}>
          <Icon name="previousChapter" size={18} />
          <span className="visually-hidden">Previous chapter</span>
        </button>
        <button type="button" className="icon-button" disabled={locked} onClick={controls.skipBack}>
          <Icon name="skipBack" size={20} />
          <span className="visually-hidden">Back {player.skipBack} seconds</span>
        </button>
        <button type="button" className="mini-play" disabled={locked} onClick={playback.toggle}>
          <Icon name={live.playing ? "pause" : "play"} size={20} filled />
          <span className="visually-hidden">{live.playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className="icon-button" disabled={locked} onClick={controls.skipForward}>
          <Icon name="skipForward" size={20} />
          <span className="visually-hidden">Forward {player.skipForward} seconds</span>
        </button>
        <button type="button" className="icon-button mini-wide" disabled={locked || !controls.nextChapter} onClick={controls.nextChapter ?? undefined}>
          <Icon name="nextChapter" size={18} />
          <span className="visually-hidden">Next chapter</span>
        </button>
        <VolumeControl className="mini-volume" />
        <div className="popover-wrap" ref={wrapRef}>
          <button
            type="button"
            className="icon-button"
            ref={triggerRef}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={toggleMenu}
          >
            <Icon name="more" size={20} />
            <span className="visually-hidden">More controls</span>
          </button>
          {menuOpen && (
            <div id={menuId} className="popover mini-menu">
              <p className="popover-label">
                Chapter {places.chapterIndex + 1} of {book.chapters.length}
                {chapter.title !== `Chapter ${places.chapterIndex + 1}` && <>: {chapter.title}</>}
              </p>
              <ul className="menu-list">
                <li className="mini-narrow">
                  <button type="button" className="menu-item" disabled={locked || !controls.previousChapter} onClick={choose(controls.previousChapter)}>
                    <Icon name="previousChapter" size={16} /> Previous chapter
                  </button>
                </li>
                <li className="mini-narrow">
                  <button type="button" className="menu-item" disabled={locked || !controls.nextChapter} onClick={choose(controls.nextChapter)}>
                    <Icon name="nextChapter" size={16} /> Next chapter
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.beginning} onClick={choose(controls.beginning)}>
                    <Icon name="startOfBook" size={16} /> Beginning of the book
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.end} onClick={choose(controls.end)}>
                    <Icon name="endOfBook" size={16} /> End of the book
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.skipIntro} onClick={choose(controls.skipIntro)}>
                    <Icon name="chevronRight" size={16} /> Skip intro
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.skipOutro} onClick={choose(controls.skipOutro)}>
                    <Icon name="chevronRight" size={16} /> Skip outro
                  </button>
                </li>
              </ul>
              <hr className="menu-sep" />
              <ul className="menu-list">
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("contents")}>
                    <Icon name="list" size={16} /> Table of contents
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("index")}>
                    <Icon name="search" size={16} /> Index
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("references")}>
                    <Icon name="bookmark" size={16} /> References and bookmarks
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("time")}>
                    <Icon name="clock" size={16} /> Go to a time
                  </button>
                </li>
              </ul>
              <hr className="menu-sep" />
              <div className="mini-narrow mini-menu-volume">
                <VolumeControl />
              </div>
              <ul className="menu-list">
                <li>
                  <button type="button" className="menu-item" onClick={choose(() => setPanel("settings"))}>
                    <Icon name="settings" size={16} /> Speed, sleep timer and skipping
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" onClick={choose(() => setPanel("devices"))}>
                    <Icon name="devices" size={16} /> Listen on another device
                  </button>
                </li>
                <li>
                  <Link className="menu-item" to={`/listen/${book.id}`} onClick={() => closeMenu(false)}>
                    <Icon name="headphones" size={16} /> Open the full player
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
        <button type="button" className="icon-button" onClick={playback.close}>
          <Icon name="close" size={18} />
          <span className="visually-hidden">Close the mini-player</span>
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {live.notice ?? ""}
      </p>

      <JumpDialog
        open={panel === "jump"}
        onClose={() => setPanel(null)}
        book={book}
        controls={controls}
        section={section}
        onSection={setSection}
      />
      <PlayerSettingsDialog open={panel === "settings"} onClose={() => setPanel(null)} withPlayback />
      <DevicesDialog open={panel === "devices"} onClose={() => setPanel(null)} />
    </section>
  );
}
