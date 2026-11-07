import { ReadingSprint } from "../components/ReadingSprint";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { getBook } from "../data/books";
import {
  type ClubMeeting,
  MEETING_LENGTHS,
  MEETING_NOTE_MAX,
  MEETING_TITLE_MAX,
  meetingError,
  meetingFileName,
  meetingIcs,
  meetingInput,
  meetingStart,
  RSVP_ANSWERS,
  RSVP_LABELS,
  type RsvpAnswer,
  rsvpCounts,
  rsvpSummary,
  upcomingMeetings,
} from "../lib/clubCalendar";
import { AccountError } from "../lib/accountApi";
import { calendarFeedUrl } from "../lib/clubsApi";
import { onClubPost } from "../lib/clubEvents";
import { ClubHighlights } from "../components/ClubHighlights";
import { ClubPlaces } from "../components/ClubPlaces";
import { ClubPolls } from "../components/ClubPolls";
import { DiscussionQuestions } from "../components/DiscussionQuestions";
import { DEMO_DISCUSSION } from "../data/demoDiscussion";
import { canDiscuss } from "../lib/discussion";
import { ClubCopyPicker } from "../components/ClubCopyPicker";
import { setListenAlong, useListenAlong } from "../lib/listenAlong";
import { endSession, isAbandoned, type ListenSession, livePosition, loadSession, startSession, watchSession } from "../lib/listenAlongApi";
import { usePlayback } from "../lib/playback";
import { BUDDY_READERS, buddyOpen, type Club, clubBook, CLUB_POST_MAX, clubChapterToday, clubDate, type ClubDetail, type ClubMember, type ClubPost, daysLeft, isUploadClub } from "../lib/clubs";
import { chapterAt, chapterLabel, chapterTimes, today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { useTitle } from "../lib/useTitle";
import { validateEmail } from "../lib/validation";
import { dateLocale, rich, type T } from "../lib/i18n";
import { useT } from "../lib/useT";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { Book } from "../types";
import { speedFor } from "../lib/bookSpeed";
import { ClubSchedule } from "../components/ClubSchedule";

type Load = { status: "loading" } | { status: "ready"; detail: ClubDetail; me: string } | { status: "missing" } | { status: "error"; message: string };

/** Dates in the reader's own style in English, else in the language chosen. */
const dates = (t: T, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(t.lang === "en" ? undefined : dateLocale(t.lang), options);
const postTime = (t: T) => dates(t, { dateStyle: "medium", timeStyle: "short" });
const meetingDay = (t: T) => dates(t, { weekday: "long", day: "numeric", month: "long" });
const meetingClock = (t: T) => dates(t, { hour: "numeric", minute: "2-digit" });
const lengthLabel = (t: T, minutes: number) => (minutes === 60 ? t("1 hour") : minutes === 120 ? t("2 hours") : t("{n} minutes", { n: minutes }));

/** Saves a meeting's calendar file, made here in the browser (never uploaded). */
function downloadIcs(meeting: ClubMeeting, club: Club, book: Book) {
  const url = `${window.location.origin}/clubs/${club.id}`;
  const blob = new Blob([meetingIcs(meeting, { clubName: club.name, bookTitle: book.title, url })], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = meetingFileName(club.name, meeting.startsAt);
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * Meetings: the club's upcoming meetings with who's coming, each member's answer (Going, Maybe,
 * Can't make it) and Add to calendar, and for its owner a form to schedule one and Cancel on
 * each. Members get an email reminder in the day before, unless they can't make it.
 */
function ClubMeetings({
  club,
  book,
  isOwner,
  initial,
  me,
  members,
}: {
  club: Club;
  book: Book;
  isOwner: boolean;
  initial: ClubMeeting[];
  me: string;
  members: ClubMember[];
}) {
  const t = useT();
  const clubs = useClubs();
  const [meetings, setMeetings] = useState(initial);
  const [now] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  // The meeting being changed (the form is shared with scheduling a new one).
  const [editing, setEditing] = useState<ClubMeeting | null>(null);
  const [form, setForm] = useState({ title: "", date: "", time: "19:00", minutes: 60, note: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const upcoming = upcomingMeetings(meetings, now);

  const schedule = async (e: FormEvent) => {
    e.preventDefault();
    const problem = meetingError(form);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const fields = {
      clubId: club.id,
      startsAt: meetingStart(form.date, form.time)!.toISOString(),
      minutes: form.minutes,
      title: form.title.trim(),
      note: form.note.trim() || null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    try {
      if (editing) {
        const saved = await clubs.updateMeeting({ ...editing, ...fields });
        setMeetings((list) => list.map((m) => (m.id === saved.id ? saved : m)));
        const moved = saved.startsAt !== editing.startsAt;
        const date = meetingDay(t).format(new Date(saved.startsAt));
        setDone(
          moved
            ? clubs.remote
              ? t("Moved to {date}. Members get an email about it.", { date })
              : t("Moved to {date}.", { date })
            : t("Meeting saved."),
        );
      } else {
        const added = await clubs.addMeeting(fields);
        setMeetings((list) => [...list, added]);
        setDone(t("Scheduled for {date}. Members get a reminder the day before.", { date: meetingDay(t).format(new Date(added.startsAt)) }));
      }
      setForm({ title: "", date: "", time: "19:00", minutes: 60, note: "" });
      setAdding(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save the meeting. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const memberIds = members.map((m) => m.userId);
  const going = (meeting: ClubMeeting) =>
    members
      .filter((m) => meeting.rsvps[m.userId] === "yes")
      .map((m) => (m.userId === me ? t("you") : m.name))
      .join(", ");

  // Saved first, then shown.
  const answer = async (meeting: ClubMeeting, value: RsvpAnswer) => {
    setError(null);
    setDone(null);
    try {
      await clubs.answerMeeting(club.id, meeting.id, value);
      setMeetings((list) => list.map((m) => (m.id === meeting.id ? { ...m, rsvps: { ...m.rsvps, [me]: value } } : m)));
      setDone(value === "no" ? t("Thanks for letting everyone know. We won't send you the reminder.") : t("Saved: {answer}.", { answer: t(RSVP_LABELS[value]).toLowerCase() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save your answer. Try again."));
    }
  };

  const cancel = async (meeting: ClubMeeting) => {
    setError(null);
    setDone(null);
    try {
      await clubs.deleteMeeting(club.id, meeting.id);
      setMeetings((list) => list.filter((m) => m.id !== meeting.id));
      if (editing?.id === meeting.id) setEditing(null);
      setDone(clubs.remote ? t("Meeting cancelled. Members get an email about it.") : t("Meeting cancelled."));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't cancel the meeting. Try again."));
    }
  };

  const change = (meeting: ClubMeeting) => {
    setEditing(meeting);
    setAdding(false);
    setForm(meetingInput(meeting));
    setError(null);
    setDone(null);
    // The form is below the list: take the keyboard there.
    requestAnimationFrame(() => document.getElementById(`${id}-title`)?.focus());
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
    setForm({ title: "", date: "", time: "19:00", minutes: 60, note: "" });
  };

  return (
    <section className="goal-card club-meetings" aria-labelledby="meetings-title">
      <h2 id="meetings-title">{t("Meetings")}</h2>
      {upcoming.length === 0 ? (
        <p className="goal-hint">{isOwner ? t("No meetings yet. Schedule one so everyone knows when to talk.") : t("No meetings scheduled yet.")}</p>
      ) : (
        <ul className="meeting-list" role="list">
          {upcoming.map((m) => {
            const start = new Date(m.startsAt);
            return (
              <li key={m.id}>
                <p className="meeting-when">
                  <Icon name="calendar" size={16} />
                  <time dateTime={m.startsAt}>
                    {meetingDay(t).format(start)}, {meetingClock(t).format(start)}
                  </time>
                </p>
                <p className="meeting-title">{m.title}</p>
                <p className="goal-hint">
                  {lengthLabel(t, m.minutes)}
                  {m.note && ` · ${m.note}`}
                </p>
                <p className="goal-hint meeting-rsvps">
                  {rsvpSummary(rsvpCounts(m, memberIds))}
                  {going(m) && t(" · Going: {names}", { names: going(m) })}
                </p>
                <fieldset className="segmented meeting-rsvp">
                  <legend>
                    <span aria-hidden="true">{t("Are you coming?")}</span>
                    <span className="visually-hidden">{t("Are you coming to {title}?", { title: m.title })}</span>
                  </legend>
                  <div>
                    {RSVP_ANSWERS.map((value) => (
                      <label key={value}>
                        <input type="radio" name={`${id}-rsvp-${m.id}`} value={value} checked={m.rsvps[me] === value} onChange={() => answer(m, value)} />
                        <span>{t(RSVP_LABELS[value])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="goal-actions">
                  <button type="button" className="ghost-button small-button" onClick={() => downloadIcs(m, club, book)}>
                    <Icon name="calendar" size={15} /> {t("Add to calendar")}<span className="visually-hidden">: {m.title}</span>
                  </button>
                  {isOwner && (
                    <>
                      <button type="button" className="text-button" onClick={() => change(m)}>
                        {t("Change")}<span className="visually-hidden"> {m.title}</span>
                      </button>
                      <button type="button" className="text-button" onClick={() => cancel(m)}>
                        {t("Cancel")}<span className="visually-hidden"> {m.title}</span>
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isOwner &&
        (adding || editing ? (
          <form className="meeting-form" noValidate onSubmit={schedule} aria-label={editing ? t("Change {title}", { title: editing.title }) : t("Schedule a meeting")}>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-title`}>
                {t("What you'll talk about")}
              </label>
              <input
                id={`${id}-title`}
                className="field-input"
                maxLength={MEETING_TITLE_MAX + 10}
                placeholder={t("For example, Chapters 1 to 10")}
                value={form.title}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="meeting-form-row">
              <div className="field">
                <label className="field-label" htmlFor={`${id}-date`}>
                  {t("Date")}
                </label>
                <input id={`${id}-date`} className="field-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${id}-time`}>
                  {t("Time")}
                </label>
                <input id={`${id}-time`} className="field-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-length`}>
                {t("How long")}
              </label>
              <select id={`${id}-length`} className="field-input" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}>
                {MEETING_LENGTHS.map((m) => (
                  <option key={m} value={m}>
                    {lengthLabel(t, m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-note`}>
                {t("Note (optional)")}
              </label>
              <textarea
                id={`${id}-note`}
                className="field-input"
                rows={2}
                maxLength={MEETING_NOTE_MAX + 20}
                placeholder={t("Where you'll meet, or a video call link")}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            {error && (
              <p className="field-error" id={`${id}-error`} role="alert">
                <Icon name="alert" size={15} /> {error}
              </p>
            )}
            <div className="goal-actions">
              <button type="submit" className="primary-button small-button" disabled={busy}>
                {busy ? t("Saving…") : editing ? t("Save changes") : t("Schedule meeting")}
              </button>
              <button type="button" className="ghost-button small-button" onClick={closeForm}>
                {editing ? t("Keep it as it was") : t("Not now")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="secondary-button small-button"
            onClick={() => {
              setAdding(true);
              setDone(null);
              setError(null);
            }}
          >
            <Icon name="plus" size={15} /> {t("Schedule a meeting")}
          </button>
        ))}
      {!adding && !editing && error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <p className="goal-hint" role="status">
        {done}
      </p>
      {upcoming.length > 0 && (
        <p className="goal-hint">
          {clubs.remote
            ? t("Everyone in the club gets an email reminder the day before, unless they can't make it, and an email if a meeting moves or is cancelled. Turn them off in Account → Preferences.")
            : t("Members get an email reminder the day before, unless they can't make it, and an email if a meeting moves or is cancelled. The demo doesn't send emails.")}
        </p>
      )}
      {clubs.remote ? (
        <CalendarFeed clubId={club.id} />
      ) : (
        <p className="goal-hint">{t("Members can also subscribe to a club's meetings in their calendar app, so it stays up to date by itself.")}</p>
      )}
    </section>
  );
}

/**
 * Subscribe in a calendar app: the member's own signed link to the club's meetings (the
 * club-calendar function), which calendar apps check on their own, so moved and cancelled
 * meetings update without opening an email.
 */
function CalendarFeed({ clubId }: { clubId: string }) {
  const t = useT();
  const id = useId();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function show() {
    setBusy(true);
    setError(null);
    try {
      setUrl(await calendarFeedUrl(clubId));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("We couldn't make the calendar link. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="calendar-feed">
      <h3 id={`${id}-title`}>{t("Subscribe in your calendar")}</h3>
      {url ? (
        <>
          <label className="field-label" htmlFor={`${id}-url`}>
            {t("Your calendar link")}
          </label>
          <input id={`${id}-url`} className="field-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-describedby={`${id}-hint`} />
          <div className="calendar-feed-actions">
            <a className="secondary-button" href={url.replace(/^https:/, "webcal:")}>
              <Icon name="calendar" size={15} /> {t("Open in calendar app")}
            </a>
            <button type="button" className="ghost-button" onClick={() => void copy()}>
              {copied ? t("Copied") : t("Copy link")}
            </button>
          </div>
          <p className="goal-hint" id={`${id}-hint`}>
            {t("In Google Calendar, add it under Other calendars → From URL. Calendars check it every few hours, so moved and cancelled meetings update by themselves. The link is yours: anyone with it sees this club's meetings, and it stops working if you leave the club.")}
          </p>
          <p aria-live="polite" className="visually-hidden">
            {copied ? t("Calendar link copied") : ""}
          </p>
        </>
      ) : (
        <>
          <p className="goal-hint">{t("Add every meeting to your calendar app once, and it stays up to date as meetings are added, moved or cancelled.")}</p>
          <button type="button" className="secondary-button" onClick={() => void show()} disabled={busy}>
            <Icon name="calendar" size={15} /> {busy ? t("Making your link…") : t("Get calendar link")}
          </button>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </div>
  );
}

/** Where an invitation link goes: /clubs/join/<code> joins the club after signing in. */
const joinPath = (code: string) => `literaryworm.com/clubs/join/${code}`;

/** Invite by email: the club-invite function sends the link; members only. */
function InviteByEmail({ clubId }: { clubId: string }) {
  const t = useT();
  const clubs = useClubs();
  const id = useId();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSent(null);
    const problem = validateEmail(email);
    if (problem) return setError(problem === t("Enter your email address.") ? t("Enter their email address.") : problem);
    setBusy(true);
    setError(null);
    try {
      await clubs.invite(clubId, email);
      setSent(t("Invitation sent to {email}.", { email: email.trim() }));
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't send the invitation. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="club-invite-form" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor={id}>
        {t("Invite by email")}
      </label>
      <div className="club-invite-row">
        <input
          id={id}
          type="email"
          className="field-input"
          autoComplete="off"
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
        <button type="submit" className="secondary-button small-button" disabled={busy}>
          {busy ? t("Sending…") : t("Send")}
        </button>
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      ) : (
        <p className="goal-hint" id={`${id}-hint`}>
          {t("We email them a link to join. We don't keep the address.")}
        </p>
      )}
      <p className="goal-hint" role="status">
        {sent}
      </p>
    </form>
  );
}

/** /clubs/:id: one book club, its pace, members and discussion (spoilers past your place stay hidden). */
export default function ClubPage() {
  const t = useT();
  const { id = "" } = useParams();
  const clubs = useClubs();
  const profile = useActiveProfile();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { uploads } = useProfileData();
  useTitle(load.status === "ready" ? load.detail.club.name : t("Book club"));

  useEffect(() => {
    let live = true;
    Promise.all([clubs.load(id), clubs.myId()]).then(
      ([detail, me]) => live && setLoad(detail ? { status: "ready", detail, me } : { status: "missing" }),
      (err: Error) => live && setLoad({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [clubs, id, attempt]);

  if (profile?.ageRating === "kids" || load.status === "missing") {
    return (
      <main className="page empty-state">
        <span className="empty-icon">
          <Icon name="users" size={28} />
        </span>
        <h1>{profile?.ageRating === "kids" ? t("Book clubs are for grown-ups and teens") : t("We couldn't find that club")}</h1>
        <p>{profile?.ageRating === "kids" ? t("Clubs aren't on Kids profiles.") : t("It may have been deleted, or you're not in it. Ask its owner for the code.")}</p>
        <Link className="primary-button" to="/library?view=clubs">
          {t("Your clubs")}
        </Link>
      </main>
    );
  }
  if (load.status !== "ready") {
    return (
      <main className="page page-content">
        {load.status === "loading" ? (
          <p role="status">{t("Loading the club…")}</p>
        ) : (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {load.message}{" "}
            <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
              {t("Try again")}
            </button>
          </p>
        )}
      </main>
    );
  }
  // A catalog title, or for a club on an uploaded book this member's own linked copy.
  const book = clubBook(load.detail.club, uploads, getBook);
  if (!book) {
    if (!isUploadClub(load.detail.club)) return null;
    return <ClubCopyPicker club={load.detail.club} uploads={uploads} onLinked={() => setAttempt((n) => n + 1)} />;
  }
  return <ClubView key={load.detail.club.id} detail={load.detail} me={load.me} book={book} />;
}

function ClubView({ detail, me, book }: { detail: ClubDetail; me: string; book: Book }) {
  const t = useT();
  const clubs = useClubs();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const { state } = useStore();
  const { club, members } = detail;
  const [posts, setPosts] = useState(detail.posts);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  // A discussion question chosen to start a post: the form starts again with it (a new key).
  const [seed, setSeed] = useState({ n: 0, chapter: -1, text: "" });
  const isOwner = club.ownerId === me;
  const now = today();
  const target = clubChapterToday(club, book, now);
  const left = daysLeft(club, now);
  const progress = activeReading(state).progress[book.id];
  const mine = progress ? (progress.finished ? book.chapters.length - 1 : progress.chapterIndex) : -1;

  // Opening the club reads it; posts that arrive while it's open are added as they come.
  useEffect(() => {
    clubs.markRead(club.id).catch((err: Error) => console.error("clubs: couldn't mark the club read:", err.message));
    return onClubPost(({ clubId, post }) => {
      if (clubId !== club.id) return;
      setPosts((list) => (list.some((p) => p.id === post.id) ? list : [...list, post]));
      clubs.markRead(club.id).catch((err: Error) => console.error("clubs: couldn't mark the club read:", err.message));
    });
  }, [clubs, club.id]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(club.inviteCode);
      setCopied(t("Code copied."));
    } catch {
      setCopied(t("Couldn't copy: select the code and copy it instead."));
    }
  };

  const leaveOrDelete = async () => {
    setError(null);
    try {
      if (isOwner) await clubs.remove(club.id);
      else await clubs.leave(club.id);
      navigate("/library?view=clubs");
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : t("That didn't work. Try again."));
    }
  };

  const removePost = async (post: ClubPost) => {
    setError(null);
    try {
      await clubs.deletePost(club.id, post.id);
      setPosts((list) => list.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't delete the post. Try again."));
    }
  };

  return (
    <div className="club-page page-content">
      <header className="club-header">
        <Cover book={book} size="md" />
        <div>
          <p className="eyebrow">{t("Book club")}</p>
          {club.buddy && <p className="eyebrow">{t("Buddy read · {n} readers", { n: BUDDY_READERS })}</p>}
          <h1>{club.name}</h1>
          <p>
            {rich(t("Reading {title} by {author}"), { title: <Link to={`/books/${book.id}`}>{book.title}</Link>, author: book.author })}
          </p>
          <p className="club-pace">
            <Icon name="clock" size={16} />{" "}
            {left > 0
              ? t.plural(
                  left,
                  { one: "Finishing {date} ({count} day left). Today the club is at {chapter}.", other: "Finishing {date} ({count} days left). Today the club is at {chapter}." },
                  { date: clubDate(club.finishesOn), chapter: chapterLabel(book, target) },
                )
              : t("The club's finish date, {date}, has passed.", { date: clubDate(club.finishesOn) })}
          </p>
          <p className="goal-hint">{mine >= 0 ? t("You're at {chapter}.", { chapter: chapterLabel(book, mine) }) : t("You haven't started this book yet.")}</p>
          <div className="goal-actions">
            <Link className="primary-button small-button" to={`/read/${book.id}`}>
              <Icon name="bookOpen" size={15} /> {t("Read")}
            </Link>
            <Link className="ghost-button small-button" to={`/listen/${book.id}`}>
              <Icon name="headphones" size={15} /> {t("Listen")}
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}

      <div className="club-grid">
        <section className="club-discussion" aria-labelledby="discussion-title">
          <h2 id="discussion-title">{t("Discussion")}</h2>
          <PostForm
            key={seed.n}
            book={book}
            initialChapter={seed.n ? seed.chapter : Math.max(0, mine)}
            initialBody={seed.text}
            focus={seed.n > 0}
            onPost={async (chapter, body) => {
              const post = await clubs.addPost(club.id, chapter, body);
              setPosts((list) => [...list, post]);
            }}
          />
          {posts.length === 0 ? (
            <p className="goal-hint">{t("No posts yet. Start the conversation.")}</p>
          ) : (
            <ol className="club-posts" reversed>
              {[...posts].reverse().map((post) => {
                // Chapter 1 is open to everyone, so a newcomer can see what the club is talking about.
                const spoiler = post.chapterIndex > Math.max(0, mine) && post.userId !== me && !shown.has(post.id);
                return (
                  <li key={post.id} className="club-post">
                    <p className="club-post-meta">
                      {rich(t("{name} on {chapter} · {time}"), {
                        name: <strong>{post.userId === me ? t("You") : post.author}</strong>,
                        chapter: chapterLabel(book, post.chapterIndex),
                        time: <time dateTime={new Date(post.createdAt).toISOString()}>{postTime(t).format(post.createdAt)}</time>,
                      })}
                    </p>
                    {spoiler ? (
                      <p className="club-spoiler">
                        {t("Hidden: this is about a chapter you haven't reached.")}{" "}
                        <button type="button" className="text-button" onClick={() => setShown((s) => new Set(s).add(post.id))}>
                          {t("Show it anyway")}
                        </button>
                      </p>
                    ) : (
                      post.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)
                    )}
                    {(post.userId === me || isOwner) && (
                      <button type="button" className="text-button" onClick={() => removePost(post)}>
                        {t("Delete")}<span className="visually-hidden"> {t("this post")}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {canDiscuss(book) && (
            <DiscussionQuestions
              book={book}
              upTo={mine}
              sample={club.id === "demo-club" ? DEMO_DISCUSSION : undefined}
              onUse={(chapter, text) => setSeed((s) => ({ n: s.n + 1, chapter, text }))}
            />
          )}
          <ClubHighlights clubId={club.id} book={book} me={me} myName={profile?.name ?? t("You")} upTo={Math.max(0, mine)} />
        </section>

        <aside className="club-side">
          <ClubSchedule club={club} book={book} isOwner={isOwner} mine={mine} me={me} />
          <ClubMeetings club={club} book={book} isOwner={isOwner} initial={detail.meetings} me={me} members={members} />
          <ClubPolls clubId={club.id} isOwner={isOwner} me={me} members={members} ageRating={profile?.ageRating ?? "all"} />
          <ReadingSprint scope={{ kind: "club", clubId: club.id }} readPath={`/read/${book.id}`} />
          {/* Each member listens to their own copy of an upload, so there's no shared place to keep in step. */}
          {!isUploadClub(club) && <ListenTogether club={club} book={book} members={members} me={me} mine={mine} />}
          <ClubPlaces clubId={club.id} members={members} me={me} />
          {(!club.buddy || buddyOpen(club)) && (
          <section className="goal-card" aria-labelledby="invite-title">
            <h2 id="invite-title">{club.buddy ? t("Invite your reading buddy") : t("Invite")}</h2>
            <InviteByEmail clubId={club.id} />
            <p className="goal-hint">{t("Or share the code. Members join from My Library → Clubs, or at {path}.", { path: joinPath(club.inviteCode) })}</p>
            <p className="club-code">
              <code>{club.inviteCode}</code>
              <button type="button" className="ghost-button small-button" onClick={copyCode}>
                {t("Copy")}
              </button>
            </p>
            <p className="goal-hint" role="status">
              {copied}
            </p>
          </section>
          )}
          <ClubNotifications clubId={club.id} />
          <section className="goal-card" aria-labelledby="members-title">
            <h2 id="members-title">
              {t.plural(members.length, { one: "{count} member", other: "{count} members" })}
            </h2>
            <ul className="club-members" role="list">
              {members.map((m) => (
                <li key={m.userId}>
                  {m.userId === me ? t("You") : m.name}
                  {m.userId === club.ownerId && <span className="shared-tag">{t("Started it")}</span>}
                </li>
              ))}
            </ul>
          </section>
          <button type="button" className="ghost-button small-button" onClick={() => setConfirming(true)}>
            <Icon name={isOwner ? "trash" : "logOut"} size={15} /> {isOwner ? t("Delete club") : t("Leave club")}
          </button>
        </aside>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={isOwner ? t("Delete this club?") : t("Leave this club?")}
        description={
          <p>
            {isOwner
              ? t("Every member loses the club and its discussion. This can't be undone.")
              : t("Your posts in it are deleted. You can join again with the code.")}
          </p>
        }
      >
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={leaveOrDelete}>
            {isOwner ? t("Delete club") : t("Leave club")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            {t("Stay")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function PostForm({
  book,
  initialChapter,
  initialBody = "",
  focus = false,
  onPost,
}: {
  book: Book;
  initialChapter: number;
  initialBody?: string;
  /** Moves focus to the post box (after a discussion question starts the post). */
  focus?: boolean;
  onPost: (chapter: number, body: string) => Promise<void>;
}) {
  const t = useT();
  const [chapter, setChapter] = useState(initialChapter);
  const [body, setBody] = useState(initialBody);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focus) bodyRef.current?.focus();
  }, [focus]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyId = useId();
  const errorId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return setError(t("Write something first."));
    if (trimmed.length > CLUB_POST_MAX) return setError(t("Posts are up to {max} characters.", { max: CLUB_POST_MAX }));
    setBusy(true);
    setError(null);
    try {
      await onPost(chapter, trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't post that. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="club-post-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${bodyId}-chapter`}>
          {t("About")}
        </label>
        <select id={`${bodyId}-chapter`} className="field-input" value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
          {book.chapters.map((_, i) => (
            <option key={i} value={i}>
              {chapterLabel(book, i)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={bodyId}>
          {t("Your post")}
        </label>
        <textarea
          id={bodyId}
          className="field-input log-textarea"
          rows={3}
          maxLength={CLUB_POST_MAX}
          ref={bodyRef}
          value={body}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && (
          <p className="field-error" id={errorId}>
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
      </div>
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? t("Posting…") : t("Post")}
        </button>
      </div>
    </form>
  );
}

/** Whether new posts in this club alert this account, and (members) the browser's permission to alert in the background. */
function ClubNotifications({ clubId }: { clubId: string }) {
  const t = useT();
  const clubs = useClubs();
  const [notify, setNotify] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const hintId = useId();

  useEffect(() => {
    let live = true;
    clubs.memberships().then(
      (all) => live && setNotify(all[clubId]?.notify ?? true),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [clubs, clubId]);

  const change = async (on: boolean) => {
    setError(null);
    setNotify(on);
    try {
      await clubs.setNotify(clubId, on);
    } catch (err) {
      setNotify(!on);
      setError(err instanceof Error ? err.message : t("We couldn't change that setting. Try again."));
    }
  };

  return (
    <section className="goal-card" aria-labelledby="club-alerts-title">
      <h2 id="club-alerts-title">{t("Notifications")}</h2>
      <label className="switch-row">
        <span>
          <strong>{t("Tell me about new posts")}</strong>
          <small id={hintId}>{t("Only posts about chapters you've reached, so nothing is spoiled.")}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={hintId}
          checked={notify ?? true}
          disabled={notify === null}
          onChange={(e) => change(e.target.checked)}
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {clubs.remote && notify && permission === "default" && (
        <button
          type="button"
          className="ghost-button small-button"
          onClick={async () => {
            try {
              setPermission(await Notification.requestPermission());
            } catch (err) {
              console.error("clubs: couldn't ask for notification permission:", err);
              setError(t("Your browser couldn't ask about notifications. You can allow them in the site's settings."));
            }
          }}
        >
          <Icon name="bell" size={15} /> {t("Also notify me when LiteraryWorm is in the background")}
        </button>
      )}
      {clubs.remote && notify && permission === "granted" && <p className="goal-hint">{t("You'll get a notification when LiteraryWorm is in the background.")}</p>}
      {clubs.remote && notify && permission === "denied" && (
        <p className="goal-hint">{t("This browser blocks notifications from LiteraryWorm. You can allow them in the site's settings.")}</p>
      )}
      {!clubs.remote && <p className="goal-hint">{t("In the demo, nobody else posts. Members hear about new posts while LiteraryWorm is open.")}</p>}
    </section>
  );
}

/**
 * Listen together: one member leads, playing the club's book; others join and hear the same
 * place (components/ListenAlong.tsx keeps them in step). Members only.
 */
function ListenTogether({ club, book, members, me, mine }: { club: Club; book: Book; members: ClubMember[]; me: string; mine: number }) {
  const t = useT();
  const clubs = useClubs();
  const playback = usePlayback();
  const { state } = useStore();
  const playbackSpeed = speedFor(useProfileData().player, book.id);
  const joined = useListenAlong();
  const [session, setSession] = useState<ListenSession | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inThis = joined?.clubId === club.id ? joined : null;

  useEffect(() => {
    if (!clubs.remote) return;
    let live = true;
    loadSession(club.id).then(
      (s) => live && setSession(s),
      (err: Error) => live && setError(err.message),
    );
    const stop = watchSession(club.id, (s) => live && setSession(s));
    // The host's place moves while it plays, and a left session needs noticing.
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => {
      live = false;
      stop();
      window.clearInterval(id);
    };
  }, [clubs.remote, club.id]);

  if (!clubs.remote) {
    return (
      <section className="goal-card" aria-labelledby="listen-together-title">
        <h2 id="listen-together-title">{t("Listen together")}</h2>
        <p className="goal-hint">{t("Members can lead a listening session that everyone in the club hears at the same place. In the demo, nobody else can join.")}</p>
      </section>
    );
  }

  const going = session && !isAbandoned(session, now) ? session : null;
  const hostName = going ? (going.hostId === me ? t("You") : (members.find((m) => m.userId === going.hostId)?.name ?? t("A member"))) : null;
  const { starts, total } = chapterTimes(book);
  const hostChapter = going ? chapterAt(starts, Math.min(total, livePosition(going, now))) : 0;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const progress = activeReading(state).progress[book.id];
      const at = progress && !progress.finished ? progress.fraction * total : 0;
      // Inside the click, so the browser lets it play.
      playback.open(book, { at, autoplay: true });
      await startSession(club.id, { position: at, playing: true, rate: playbackSpeed });
      setListenAlong({ clubId: club.id, clubName: club.name, bookId: book.id, role: "host" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't start the session. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    if (!going) return;
    // Open it here, inside the click, so the browser lets it play; ListenAlong keeps it in step.
    playback.open(book, { at: livePosition(going), autoplay: going.playing });
    setListenAlong({ clubId: club.id, clubName: club.name, bookId: book.id, role: "follower" });
  };

  return (
    <section className="goal-card" aria-labelledby="listen-together-title">
      <h2 id="listen-together-title">{t("Listen together")}</h2>
      {session === undefined && !error ? (
        <p className="goal-hint" role="status">
          {t("Checking for a session…")}
        </p>
      ) : going ? (
        <>
          <p className="goal-hint">
            {rich(
              going.hostId === me
                ? going.playing
                  ? t("{name} are playing {chapter}.")
                  : t("{name} are paused at {chapter}.")
                : going.playing
                  ? t("{name} is playing {chapter}.")
                  : t("{name} is paused at {chapter}."),
              { name: <strong>{hostName}</strong>, chapter: chapterLabel(book, hostChapter) },
            )}
          </p>
          {inThis ? (
            <button
              type="button"
              className="ghost-button small-button"
              onClick={() => {
                setListenAlong(null);
                if (inThis.role === "host") endSession(club.id).catch((err: Error) => setError(err.message));
              }}
            >
              {inThis.role === "host" ? t("Stop leading") : t("Leave")}
            </button>
          ) : going.hostId === me ? (
            // Led from another tab or before a refresh: pick it up here.
            <button
              type="button"
              className="ghost-button small-button"
              onClick={() => {
                playback.open(book, { at: livePosition(going), autoplay: going.playing });
                setListenAlong({ clubId: club.id, clubName: club.name, bookId: book.id, role: "host" });
              }}
            >
              {t("Carry on leading here")}
            </button>
          ) : (
            <>
              {hostChapter > Math.max(0, mine) && <p className="goal-hint">{t("Joining takes you to a chapter you haven't reached yet.")}</p>}
              <button type="button" className="primary-button small-button" onClick={join}>
                <Icon name="headphones" size={15} /> {t("Join")}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p className="goal-hint">{t("Lead a session and everyone who joins hears {title} at your place, as you play, pause and skip.", { title: book.title })}</p>
          <button type="button" className="primary-button small-button" disabled={busy || !book.recording} onClick={start}>
            <Icon name="headphones" size={15} /> {t("Start listening together")}
          </button>
          {!book.recording && <p className="goal-hint">{t("This book has no recording to listen to together.")}</p>}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}
