import { type FormEvent, useEffect, useId, useState } from "react";
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
import { setListenAlong, useListenAlong } from "../lib/listenAlong";
import { endSession, isAbandoned, type ListenSession, livePosition, loadSession, startSession, watchSession } from "../lib/listenAlongApi";
import { usePlayback } from "../lib/playback";
import { type Club, CLUB_POST_MAX, clubChapterToday, clubDate, type ClubDetail, type ClubMember, type ClubPost, daysLeft } from "../lib/clubs";
import { chapterAt, chapterLabel, chapterTimes, today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { useTitle } from "../lib/useTitle";
import { validateEmail } from "../lib/validation";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { Book } from "../types";

type Load = { status: "loading" } | { status: "ready"; detail: ClubDetail; me: string } | { status: "missing" } | { status: "error"; message: string };

const postTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const meetingDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const meetingClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const lengthLabel = (minutes: number) => (minutes === 60 ? "1 hour" : minutes === 120 ? "2 hours" : `${minutes} minutes`);

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
        setDone(
          moved
            ? `Moved to ${meetingDay.format(new Date(saved.startsAt))}.${clubs.remote ? " Members get an email about it." : ""}`
            : "Meeting saved.",
        );
      } else {
        const added = await clubs.addMeeting(fields);
        setMeetings((list) => [...list, added]);
        setDone(`Scheduled for ${meetingDay.format(new Date(added.startsAt))}. Members get a reminder the day before.`);
      }
      setForm({ title: "", date: "", time: "19:00", minutes: 60, note: "" });
      setAdding(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save the meeting. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const memberIds = members.map((m) => m.userId);
  const going = (meeting: ClubMeeting) =>
    members
      .filter((m) => meeting.rsvps[m.userId] === "yes")
      .map((m) => (m.userId === me ? "you" : m.name))
      .join(", ");

  // Saved first, then shown.
  const answer = async (meeting: ClubMeeting, value: RsvpAnswer) => {
    setError(null);
    setDone(null);
    try {
      await clubs.answerMeeting(club.id, meeting.id, value);
      setMeetings((list) => list.map((m) => (m.id === meeting.id ? { ...m, rsvps: { ...m.rsvps, [me]: value } } : m)));
      setDone(value === "no" ? "Thanks for letting everyone know. We won't send you the reminder." : `Saved: ${RSVP_LABELS[value].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your answer. Try again.");
    }
  };

  const cancel = async (meeting: ClubMeeting) => {
    setError(null);
    setDone(null);
    try {
      await clubs.deleteMeeting(club.id, meeting.id);
      setMeetings((list) => list.filter((m) => m.id !== meeting.id));
      if (editing?.id === meeting.id) setEditing(null);
      setDone(`Meeting cancelled.${clubs.remote ? " Members get an email about it." : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't cancel the meeting. Try again.");
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
      <h2 id="meetings-title">Meetings</h2>
      {upcoming.length === 0 ? (
        <p className="goal-hint">{isOwner ? "No meetings yet. Schedule one so everyone knows when to talk." : "No meetings scheduled yet."}</p>
      ) : (
        <ul className="meeting-list" role="list">
          {upcoming.map((m) => {
            const start = new Date(m.startsAt);
            return (
              <li key={m.id}>
                <p className="meeting-when">
                  <Icon name="calendar" size={16} />
                  <time dateTime={m.startsAt}>
                    {meetingDay.format(start)}, {meetingClock.format(start)}
                  </time>
                </p>
                <p className="meeting-title">{m.title}</p>
                <p className="goal-hint">
                  {lengthLabel(m.minutes)}
                  {m.note && ` · ${m.note}`}
                </p>
                <p className="goal-hint meeting-rsvps">
                  {rsvpSummary(rsvpCounts(m, memberIds))}
                  {going(m) && ` · Going: ${going(m)}`}
                </p>
                <fieldset className="segmented meeting-rsvp">
                  <legend>
                    <span aria-hidden="true">Are you coming?</span>
                    <span className="visually-hidden">Are you coming to {m.title}?</span>
                  </legend>
                  <div>
                    {RSVP_ANSWERS.map((value) => (
                      <label key={value}>
                        <input type="radio" name={`${id}-rsvp-${m.id}`} value={value} checked={m.rsvps[me] === value} onChange={() => answer(m, value)} />
                        <span>{RSVP_LABELS[value]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="goal-actions">
                  <button type="button" className="ghost-button small-button" onClick={() => downloadIcs(m, club, book)}>
                    <Icon name="calendar" size={15} /> Add to calendar<span className="visually-hidden">: {m.title}</span>
                  </button>
                  {isOwner && (
                    <>
                      <button type="button" className="text-button" onClick={() => change(m)}>
                        Change<span className="visually-hidden"> {m.title}</span>
                      </button>
                      <button type="button" className="text-button" onClick={() => cancel(m)}>
                        Cancel<span className="visually-hidden"> {m.title}</span>
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
          <form className="meeting-form" noValidate onSubmit={schedule} aria-label={editing ? `Change ${editing.title}` : "Schedule a meeting"}>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-title`}>
                What you'll talk about
              </label>
              <input
                id={`${id}-title`}
                className="field-input"
                maxLength={MEETING_TITLE_MAX + 10}
                placeholder="For example, Chapters 1 to 10"
                value={form.title}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="meeting-form-row">
              <div className="field">
                <label className="field-label" htmlFor={`${id}-date`}>
                  Date
                </label>
                <input id={`${id}-date`} className="field-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${id}-time`}>
                  Time
                </label>
                <input id={`${id}-time`} className="field-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-length`}>
                How long
              </label>
              <select id={`${id}-length`} className="field-input" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}>
                {MEETING_LENGTHS.map((m) => (
                  <option key={m} value={m}>
                    {lengthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-note`}>
                Note (optional)
              </label>
              <textarea
                id={`${id}-note`}
                className="field-input"
                rows={2}
                maxLength={MEETING_NOTE_MAX + 20}
                placeholder="Where you'll meet, or a video call link"
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
                {busy ? "Saving…" : editing ? "Save changes" : "Schedule meeting"}
              </button>
              <button type="button" className="ghost-button small-button" onClick={closeForm}>
                {editing ? "Keep it as it was" : "Not now"}
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
            <Icon name="plus" size={15} /> Schedule a meeting
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
            ? "Everyone in the club gets an email reminder the day before, unless they can't make it, and an email if a meeting moves or is cancelled. Turn them off in Account → Preferences."
            : "Members get an email reminder the day before, unless they can't make it, and an email if a meeting moves or is cancelled. The demo doesn't send emails."}
        </p>
      )}
      {clubs.remote ? (
        <CalendarFeed clubId={club.id} />
      ) : (
        <p className="goal-hint">Members can also subscribe to a club's meetings in their calendar app, so it stays up to date by itself.</p>
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
      setError(err instanceof AccountError ? err.message : "We couldn't make the calendar link. Try again.");
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
      <h3 id={`${id}-title`}>Subscribe in your calendar</h3>
      {url ? (
        <>
          <label className="field-label" htmlFor={`${id}-url`}>
            Your calendar link
          </label>
          <input id={`${id}-url`} className="field-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-describedby={`${id}-hint`} />
          <div className="calendar-feed-actions">
            <a className="secondary-button" href={url.replace(/^https:/, "webcal:")}>
              <Icon name="calendar" size={15} /> Open in calendar app
            </a>
            <button type="button" className="ghost-button" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="goal-hint" id={`${id}-hint`}>
            In Google Calendar, add it under Other calendars → From URL. Calendars check it every few hours, so moved and cancelled
            meetings update by themselves. The link is yours: anyone with it sees this club's meetings, and it stops working if you
            leave the club.
          </p>
          <p aria-live="polite" className="visually-hidden">
            {copied ? "Calendar link copied" : ""}
          </p>
        </>
      ) : (
        <>
          <p className="goal-hint">Add every meeting to your calendar app once, and it stays up to date as meetings are added, moved or cancelled.</p>
          <button type="button" className="secondary-button" onClick={() => void show()} disabled={busy}>
            <Icon name="calendar" size={15} /> {busy ? "Making your link…" : "Get calendar link"}
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
    if (problem) return setError(problem === "Enter your email address." ? "Enter their email address." : problem);
    setBusy(true);
    setError(null);
    try {
      await clubs.invite(clubId, email);
      setSent(`Invitation sent to ${email.trim()}.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send the invitation. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="club-invite-form" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor={id}>
        Invite by email
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
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      ) : (
        <p className="goal-hint" id={`${id}-hint`}>
          We email them a link to join. We don't keep the address.
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
  const { id = "" } = useParams();
  const clubs = useClubs();
  const profile = useActiveProfile();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useTitle(load.status === "ready" ? load.detail.club.name : "Book club");

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
        <h1>{profile?.ageRating === "kids" ? "Book clubs are for grown-ups and teens" : "We couldn't find that club"}</h1>
        <p>{profile?.ageRating === "kids" ? "Clubs aren't on Kids profiles." : "It may have been deleted, or you're not in it. Ask its owner for the code."}</p>
        <Link className="primary-button" to="/library?view=clubs">
          Your clubs
        </Link>
      </main>
    );
  }
  if (load.status !== "ready") {
    return (
      <main className="page page-content">
        {load.status === "loading" ? (
          <p role="status">Loading the club…</p>
        ) : (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {load.message}{" "}
            <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </p>
        )}
      </main>
    );
  }
  const book = getBook(load.detail.club.bookId);
  if (!book) return null;
  return <ClubView key={load.detail.club.id} detail={load.detail} me={load.me} book={book} />;
}

function ClubView({ detail, me, book }: { detail: ClubDetail; me: string; book: Book }) {
  const clubs = useClubs();
  const navigate = useNavigate();
  const { state } = useStore();
  const { club, members } = detail;
  const [posts, setPosts] = useState(detail.posts);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
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
      setCopied("Code copied.");
    } catch {
      setCopied("Couldn't copy: select the code and copy it instead.");
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
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  };

  const removePost = async (post: ClubPost) => {
    setError(null);
    try {
      await clubs.deletePost(club.id, post.id);
      setPosts((list) => list.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't delete the post. Try again.");
    }
  };

  return (
    <div className="club-page page-content">
      <header className="club-header">
        <Cover book={book} size="md" />
        <div>
          <p className="eyebrow">Book club</p>
          <h1>{club.name}</h1>
          <p>
            Reading <Link to={`/books/${book.id}`}>{book.title}</Link> by {book.author}
          </p>
          <p className="club-pace">
            <Icon name="clock" size={16} />{" "}
            {left > 0
              ? `Finishing ${clubDate(club.finishesOn)} (${left} ${left === 1 ? "day" : "days"} left). Today the club is at ${chapterLabel(book, target)}.`
              : `The club's finish date, ${clubDate(club.finishesOn)}, has passed.`}
          </p>
          <p className="goal-hint">{mine >= 0 ? `You're at ${chapterLabel(book, mine)}.` : "You haven't started this book yet."}</p>
          <div className="goal-actions">
            <Link className="primary-button small-button" to={`/read/${book.id}`}>
              <Icon name="bookOpen" size={15} /> Read
            </Link>
            <Link className="ghost-button small-button" to={`/listen/${book.id}`}>
              <Icon name="headphones" size={15} /> Listen
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
          <h2 id="discussion-title">Discussion</h2>
          <PostForm
            book={book}
            initialChapter={Math.max(0, mine)}
            onPost={async (chapter, body) => {
              const post = await clubs.addPost(club.id, chapter, body);
              setPosts((list) => [...list, post]);
            }}
          />
          {posts.length === 0 ? (
            <p className="goal-hint">No posts yet. Start the conversation.</p>
          ) : (
            <ol className="club-posts" reversed>
              {[...posts].reverse().map((post) => {
                // Chapter 1 is open to everyone, so a newcomer can see what the club is talking about.
                const spoiler = post.chapterIndex > Math.max(0, mine) && post.userId !== me && !shown.has(post.id);
                return (
                  <li key={post.id} className="club-post">
                    <p className="club-post-meta">
                      <strong>{post.userId === me ? "You" : post.author}</strong> on {chapterLabel(book, post.chapterIndex)} ·{" "}
                      <time dateTime={new Date(post.createdAt).toISOString()}>{postTime.format(post.createdAt)}</time>
                    </p>
                    {spoiler ? (
                      <p className="club-spoiler">
                        Hidden: this is about a chapter you haven't reached.{" "}
                        <button type="button" className="text-button" onClick={() => setShown((s) => new Set(s).add(post.id))}>
                          Show it anyway
                        </button>
                      </p>
                    ) : (
                      post.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)
                    )}
                    {(post.userId === me || isOwner) && (
                      <button type="button" className="text-button" onClick={() => removePost(post)}>
                        Delete<span className="visually-hidden"> this post</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="club-side">
          <ClubMeetings club={club} book={book} isOwner={isOwner} initial={detail.meetings} me={me} members={members} />
          <ListenTogether club={club} book={book} members={members} me={me} mine={mine} />
          <section className="goal-card" aria-labelledby="invite-title">
            <h2 id="invite-title">Invite</h2>
            <InviteByEmail clubId={club.id} />
            <p className="goal-hint">Or share the code. Members join from My Library → Clubs, or at {joinPath(club.inviteCode)}.</p>
            <p className="club-code">
              <code>{club.inviteCode}</code>
              <button type="button" className="ghost-button small-button" onClick={copyCode}>
                Copy
              </button>
            </p>
            <p className="goal-hint" role="status">
              {copied}
            </p>
          </section>
          <ClubNotifications clubId={club.id} />
          <section className="goal-card" aria-labelledby="members-title">
            <h2 id="members-title">
              {members.length} {members.length === 1 ? "member" : "members"}
            </h2>
            <ul className="club-members" role="list">
              {members.map((m) => (
                <li key={m.userId}>
                  {m.userId === me ? "You" : m.name}
                  {m.userId === club.ownerId && <span className="shared-tag">Started it</span>}
                </li>
              ))}
            </ul>
          </section>
          <button type="button" className="ghost-button small-button" onClick={() => setConfirming(true)}>
            <Icon name={isOwner ? "trash" : "logOut"} size={15} /> {isOwner ? "Delete club" : "Leave club"}
          </button>
        </aside>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={isOwner ? "Delete this club?" : "Leave this club?"}
        description={
          <p>
            {isOwner
              ? "Every member loses the club and its discussion. This can't be undone."
              : "Your posts in it are deleted. You can join again with the code."}
          </p>
        }
      >
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={leaveOrDelete}>
            {isOwner ? "Delete club" : "Leave club"}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            Stay
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function PostForm({ book, initialChapter, onPost }: { book: Book; initialChapter: number; onPost: (chapter: number, body: string) => Promise<void> }) {
  const [chapter, setChapter] = useState(initialChapter);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyId = useId();
  const errorId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return setError("Write something first.");
    if (trimmed.length > CLUB_POST_MAX) return setError(`Posts are up to ${CLUB_POST_MAX} characters.`);
    setBusy(true);
    setError(null);
    try {
      await onPost(chapter, trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't post that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="club-post-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${bodyId}-chapter`}>
          About
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
          Your post
        </label>
        <textarea
          id={bodyId}
          className="field-input log-textarea"
          rows={3}
          maxLength={CLUB_POST_MAX}
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
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

/** Whether new posts in this club alert this account, and (members) the browser's permission to alert in the background. */
function ClubNotifications({ clubId }: { clubId: string }) {
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
      setError(err instanceof Error ? err.message : "We couldn't change that setting. Try again.");
    }
  };

  return (
    <section className="goal-card" aria-labelledby="club-alerts-title">
      <h2 id="club-alerts-title">Notifications</h2>
      <label className="switch-row">
        <span>
          <strong>Tell me about new posts</strong>
          <small id={hintId}>Only posts about chapters you've reached, so nothing is spoiled.</small>
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
              setError("Your browser couldn't ask about notifications. You can allow them in the site's settings.");
            }
          }}
        >
          <Icon name="bell" size={15} /> Also notify me when LiteraryWorm is in the background
        </button>
      )}
      {clubs.remote && notify && permission === "granted" && <p className="goal-hint">You'll get a notification when LiteraryWorm is in the background.</p>}
      {clubs.remote && notify && permission === "denied" && (
        <p className="goal-hint">This browser blocks notifications from LiteraryWorm. You can allow them in the site's settings.</p>
      )}
      {!clubs.remote && <p className="goal-hint">In the demo, nobody else posts. Members hear about new posts while LiteraryWorm is open.</p>}
    </section>
  );
}

/**
 * Listen together: one member leads, playing the club's book; others join and hear the same
 * place (components/ListenAlong.tsx keeps them in step). Members only.
 */
function ListenTogether({ club, book, members, me, mine }: { club: Club; book: Book; members: ClubMember[]; me: string; mine: number }) {
  const clubs = useClubs();
  const playback = usePlayback();
  const { state } = useStore();
  const playbackSpeed = useProfileData().player.speed;
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
        <h2 id="listen-together-title">Listen together</h2>
        <p className="goal-hint">Members can lead a listening session that everyone in the club hears at the same place. In the demo, nobody else can join.</p>
      </section>
    );
  }

  const going = session && !isAbandoned(session, now) ? session : null;
  const hostName = going ? (going.hostId === me ? "You" : (members.find((m) => m.userId === going.hostId)?.name ?? "A member")) : null;
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
      setError(err instanceof Error ? err.message : "We couldn't start the session. Try again.");
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
      <h2 id="listen-together-title">Listen together</h2>
      {session === undefined && !error ? (
        <p className="goal-hint" role="status">
          Checking for a session…
        </p>
      ) : going ? (
        <>
          <p className="goal-hint">
            <strong>{hostName}</strong> {going.hostId === me ? "are" : "is"} {going.playing ? "playing" : "paused at"} {chapterLabel(book, hostChapter)}.
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
              {inThis.role === "host" ? "Stop leading" : "Leave"}
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
              Carry on leading here
            </button>
          ) : (
            <>
              {hostChapter > Math.max(0, mine) && <p className="goal-hint">Joining takes you to a chapter you haven't reached yet.</p>}
              <button type="button" className="primary-button small-button" onClick={join}>
                <Icon name="headphones" size={15} /> Join
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p className="goal-hint">Lead a session and everyone who joins hears {book.title} at your place, as you play, pause and skip.</p>
          <button type="button" className="primary-button small-button" disabled={busy || !book.recording} onClick={start}>
            <Icon name="headphones" size={15} /> Start listening together
          </button>
          {!book.recording && <p className="goal-hint">This book has no recording to listen to together.</p>}
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
