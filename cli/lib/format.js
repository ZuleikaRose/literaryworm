"use strict";
// Turns the answers into lines for a terminal. No I/O.

const STATUS = { want_to_read: "Want to read", reading: "Reading", finished: "Finished", did_not_finish: "Didn't finish" };
const SOURCE = { upload: "your upload", google_books: "Google Books", open_library: "Open Library" };

/** Minutes as "1 h 5 min", "45 min" or "2 h". */
function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const day = (iso) => String(iso).slice(0, 10);

/** One line, however long the text was. */
function oneLine(text, max = 96) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Text from the server is shown as it is, but never allowed to drive the terminal: control
 * characters (escape sequences among them) are dropped from everything printed.
 */
function safe(text) {
  // eslint-disable-next-line no-control-regex
  return String(text).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

function search(result) {
  if (!result.books.length) return "No catalog books match. Try other words.";
  return result.books.map((b) => `${b.title} — ${b.author} (${b.year})\n  ${b.id}  ${b.url}`).join("\n");
}

function book(b) {
  return [`${b.title} — ${b.author} (${b.year})`, "", b.description, "", `Included: ${b.included}`, b.url].join("\n");
}

function pricing(result) {
  const lines = result.plans.map((p) => {
    const hours = p.audiobookHoursAMonth === "unlimited" ? "unlimited audiobook hours" : `${p.audiobookHoursAMonth} audiobook hours a month`;
    return `${p.name}: ${p.monthly} a month${p.yearly ? ` or ${p.yearly} a year` : ""}\n  ${p.profiles} ${p.profiles === 1 ? "profile" : "profiles"}, ${hours}, ${p.offlineDevices} offline ${p.offlineDevices === 1 ? "device" : "devices"}\n  ${p.summary}`;
  });
  return [...lines, "", result.note, result.url].join("\n");
}

function whatsNew(result) {
  if (!result.entries.length) return "Nothing new yet.";
  return [...result.entries.map((e) => `${e.releasedOn}  ${e.major ? "Major" : "Minor"} ${e.kind}: ${e.title}\n  ${oneLine(e.body, 200)}`), "", result.url].join("\n");
}

function library(result) {
  if (!result.books.length) return "No books here yet.";
  return result.books
    .map((b) => {
      const name = b.title ? `${b.title}${b.author ? ` — ${b.author}` : ""}` : `A ${SOURCE[b.source] || "book"} title (${b.id})`;
      const from = b.title && SOURCE[b.source] ? ` [${SOURCE[b.source]}]` : "";
      const place = b.progress ? (b.progress.finished ? ", finished" : `, ${b.progress.percent}% through the ${b.progress.format}`) : "";
      return `${name}${from}\n  ${STATUS[b.status] || b.status}${place} · added ${day(b.addedAt)}`;
    })
    .join("\n");
}

function highlights(result) {
  if (!result.highlights.length) return "No highlights here yet.";
  return result.highlights
    .map((h) => `${h.bookTitle || h.bookId}, chapter ${h.chapter} (${day(h.createdAt)})\n  “${oneLine(h.quote, 300)}”${h.note ? `\n  Note: ${oneLine(h.note, 300)}` : ""}`)
    .join("\n\n");
}

function stats(result) {
  const head = `Since ${result.since} (${result.days} ${result.days === 1 ? "day" : "days"}):`;
  if (!result.profiles.length) return `${head}\n  No grown-up or teen profiles yet.`;
  const lines = result.profiles.map(
    (p) => `  ${p.profile}: ${duration(p.minutes)} (${duration(p.listeningMinutes)} listening), ${p.daysRead} ${p.daysRead === 1 ? "day" : "days"} read, ${p.booksFinished} ${p.booksFinished === 1 ? "book" : "books"} finished`,
  );
  return [head, ...lines, `  ${result.note}`].join("\n");
}

function mcp(url) {
  return [
    "Add LiteraryWorm to an AI assistant that supports MCP (remote, Streamable HTTP):",
    "",
    `  ${url}`,
    "",
    "The assistant opens LiteraryWorm in your browser so you can allow it. It can only read.",
    "",
    "Claude Code:",
    `  claude mcp add --transport http literaryworm ${url}`,
    "",
    "Without logging in (the catalog, pricing and What's new only):",
    `  ${url}/public`,
  ].join("\n");
}

module.exports = { duration, oneLine, safe, search, book, pricing, whatsNew, library, highlights, stats, mcp };
