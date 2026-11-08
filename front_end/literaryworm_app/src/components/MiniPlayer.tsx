import { type CSSProperties, useId, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayback } from "../lib/playback";
import { formatTime } from "../lib/reading";
import { usePlayerControls } from "../lib/usePlayerControls";
import { canRecap } from "../lib/recap";
import { RecapDialog } from "./RecapDialog";
import { ClipDialog } from "./ClipDialog";
import { useNaturalVoice } from "../lib/useNaturalVoice";
import { usePopover } from "../lib/usePopover";
import type { Book } from "../types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";
import { ContinueDialog } from "./ContinueOnPhone";
import { playerContinueUrl } from "../lib/continueLink";
import { CastButton, DevicesDialog, JumpDialog, type JumpSection, PlayerSettingsDialog, SleepMore, VolumeControl } from "./PlayerControls";

type Panel = "jump" | "settings" | "devices" | "recap" | "clip" | "continue" | null;

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
  const naturalSource = useNaturalVoice(book);
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu, wrapRef, triggerRef } = usePopover();
  const menuId = useId();
  const [panel, setPanel] = useState<Panel>(null);
  const [section, setSection] = useState<JumpSection>("contents");
  const t = useT();
  if (!live) return null;

  const chapter = book.chapters[places.chapterIndex];
  const chapterName = chapter.title === `Chapter ${places.chapterIndex + 1}` ? chapter.title : `${places.chapterIndex + 1}. ${chapter.title}`;
  const locked = live.limitReached || live.allowance !== null;
  const status = live.allowance ? (
    t("This month's listening is used up")
  ) : locked ? (
    t("Today's listening time is used up")
  ) : live.finished ? (
    t("Finished")
  ) : (
    <>
      {chapterName} · <span aria-hidden="true">−</span>
      {formatTime(places.chapterEnd - position)}
      <span className="visually-hidden"> {t("left in the chapter")}</span>
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
    <section className="mini-player" aria-label={t("Now playing")}>
      <span className="mini-progress" aria-hidden="true" style={{ "--fill": `${(position / total) * 100}%` } as CSSProperties} />
      <Link className="mini-info" to={`/listen/${book.id}`}>
        <Cover book={book} size="sm" className="mini-cover" />
        <span className="mini-text">
          <strong>{book.title}</strong>
          <small>{status}</small>
        </span>
        <span className="visually-hidden">. {t("Open the player")}</span>
      </Link>
      {live.finished && controls.upNext && (
        <button type="button" className="secondary-button small-button mini-next" onClick={controls.upNext.play}>
          <Icon name="play" size={14} filled /> {t("Play next")}<span className="mini-next-title">: {controls.upNext.book.title}</span>
        </button>
      )}
      <div className="mini-controls">
        <button type="button" className="icon-button mini-wide" disabled={locked || !controls.previousChapter} onClick={controls.previousChapter ?? undefined}>
          <Icon name="previousChapter" size={18} />
          <span className="visually-hidden">{t("Previous chapter")}</span>
        </button>
        <button type="button" className="icon-button" disabled={locked} onClick={controls.skipBack}>
          <Icon name="skipBack" size={20} />
          <span className="visually-hidden">{t("Back {n} seconds", { n: player.skipBack })}</span>
        </button>
        <button type="button" className="mini-play" disabled={locked} onClick={playback.toggle}>
          <Icon name={live.playing ? "pause" : "play"} size={20} filled />
          <span className="visually-hidden">{live.playing ? t("Pause") : t("Play")}</span>
        </button>
        <button type="button" className="icon-button" disabled={locked} onClick={controls.skipForward}>
          <Icon name="skipForward" size={20} />
          <span className="visually-hidden">{t("Forward {n} seconds", { n: player.skipForward })}</span>
        </button>
        <button type="button" className="icon-button mini-wide" disabled={locked || !controls.nextChapter} onClick={controls.nextChapter ?? undefined}>
          <Icon name="nextChapter" size={18} />
          <span className="visually-hidden">{t("Next chapter")}</span>
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
            <span className="visually-hidden">{t("More controls")}</span>
          </button>
          {menuOpen && (
            <div id={menuId} className="popover mini-menu">
              <p className="popover-label">
                {t("Chapter {n} of {total}", { n: places.chapterIndex + 1, total: book.chapters.length })}
                {chapter.title !== `Chapter ${places.chapterIndex + 1}` && <>: {chapter.title}</>}
              </p>
              <ul className="menu-list">
                <li className="mini-narrow">
                  <button type="button" className="menu-item" disabled={locked || !controls.previousChapter} onClick={choose(controls.previousChapter)}>
                    <Icon name="previousChapter" size={16} /> {t("Previous chapter")}
                  </button>
                </li>
                <li className="mini-narrow">
                  <button type="button" className="menu-item" disabled={locked || !controls.nextChapter} onClick={choose(controls.nextChapter)}>
                    <Icon name="nextChapter" size={16} /> {t("Next chapter")}
                  </button>
                </li>
                <li>
                  <Link className="menu-item" to={`/listen/${book.id}?view=car`} onClick={() => closeMenu()}>
                    <Icon name="headphones" size={16} /> {t("Car mode")}
                  </Link>
                </li>
                <li>
                  <Link className="menu-item" to={`/listen/${book.id}?view=bedtime`} onClick={() => closeMenu()}>
                    <Icon name="moon" size={16} /> {t("Bedtime listening")}
                  </Link>
                </li>
                <li>
                  <CastButton className="menu-item" recording />
                </li>
                {(book.recording || (book.upload && naturalSource !== null)) && (
                  <li>
                    <button type="button" className="menu-item" onClick={choose(() => setPanel("clip"))}>
                      <Icon name="share" size={16} /> {t("Share a clip")}
                    </button>
                  </li>
                )}
                {controls.upNext && (
                  <li>
                    <button type="button" className="menu-item" onClick={choose(controls.upNext.play)}>
                      <Icon name="list" size={16} /> {t("Play next in Up next: {title}", { title: controls.upNext.book.title })}
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.beginning} onClick={choose(controls.beginning)}>
                    <Icon name="startOfBook" size={16} /> {t("Beginning of the book")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.end} onClick={choose(controls.end)}>
                    <Icon name="endOfBook" size={16} /> {t("End of the book")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.skipIntro} onClick={choose(controls.skipIntro)}>
                    <Icon name="chevronRight" size={16} /> {t("Skip intro")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked || !controls.skipOutro} onClick={choose(controls.skipOutro)}>
                    <Icon name="chevronRight" size={16} /> {t("Skip outro")}
                  </button>
                </li>
              </ul>
              <hr className="menu-sep" />
              <ul className="menu-list">
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("contents")}>
                    <Icon name="list" size={16} /> {t("Table of contents")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("index")}>
                    <Icon name="search" size={16} /> {t("Index")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("references")}>
                    <Icon name="bookmark" size={16} /> {t("References and bookmarks")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" disabled={locked} onClick={jump("time")}>
                    <Icon name="clock" size={16} /> {t("Go to a time")}
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
                    <Icon name="settings" size={16} /> {t("Speed, sleep timer and skipping")}
                  </button>
                </li>
                {canRecap(book, places.chapterIndex) && (
                  <li>
                    <button type="button" className="menu-item" onClick={choose(() => setPanel("recap"))}>
                      <Icon name="bookOpen" size={16} /> {t("Previously…")}
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="menu-item" onClick={choose(() => setPanel("devices"))}>
                    <Icon name="devices" size={16} /> {t("Listen on another device")}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-item" onClick={choose(() => setPanel("continue"))}>
                    <Icon name="qr" size={16} /> {t("Continue on your phone")}
                  </button>
                </li>
                <li>
                  <Link className="menu-item" to={`/listen/${book.id}`} onClick={() => closeMenu(false)}>
                    <Icon name="headphones" size={16} /> {t("Open the full player")}
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
        <button type="button" className="icon-button" onClick={playback.close}>
          <Icon name="close" size={18} />
          <span className="visually-hidden">{t("Close the mini-player")}</span>
        </button>
      </div>
      <SleepMore className="mini-sleep-more" />
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
      {panel === "continue" && <ContinueDialog open onClose={() => setPanel(null)} url={playerContinueUrl(book.id, position)} title={book.title} />}
      <RecapDialog open={panel === "recap"} book={book} chapterIndex={places.chapterIndex} onClose={() => setPanel(null)} />
      {panel === "clip" && <ClipDialog open book={book} chapterIndex={places.chapterIndex} offset={position - places.chapterStart} chapterSeconds={places.chapterEnd - places.chapterStart} onClose={() => setPanel(null)} />}
    </section>
  );
}
