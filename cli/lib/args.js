"use strict";
// Reads the command line: a command, its words, and a few options. No I/O.

const COMMANDS = ["search", "book", "pricing", "whats-new", "login", "logout", "status", "library", "highlights", "stats", "mcp", "help"];
const STATUSES = ["want_to_read", "reading", "finished", "did_not_finish"];
/** Options that take a whole number, with the most each allows. */
const NUMBERS = { limit: 200, days: 366 };

class UsageError extends Error {}

/**
 * parseArgs(["search", "jane", "austen", "--limit", "5"]) →
 * { command: "search", words: ["jane", "austen"], options: { limit: 5 }, json: false }
 */
function parseArgs(argv) {
  const words = [];
  const options = {};
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") return { command: "help", words: [], options: {}, json };
    else if (arg === "--version" || arg === "-v") return { command: "version", words: [], options: {}, json };
    else if (arg.startsWith("--")) {
      const [name, inline] = arg.slice(2).split("=", 2);
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined) throw new UsageError(`--${name} needs a value.`);
      if (name in NUMBERS) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > NUMBERS[name]) throw new UsageError(`--${name} must be a whole number from 1 to ${NUMBERS[name]}.`);
        options[name] = n;
      } else if (name === "status") {
        if (!STATUSES.includes(value)) throw new UsageError(`--status must be one of ${STATUSES.join(", ")}.`);
        options.status = value;
      } else throw new UsageError(`Unknown option --${name}.`);
    } else words.push(arg);
  }
  const command = words.shift() || "help";
  if (!COMMANDS.includes(command)) throw new UsageError(`Unknown command: ${command}. Try "literaryworm help".`);
  if (command === "search" && words.length === 0) throw new UsageError("Say what to search for: literaryworm search pride and prejudice");
  if (command === "book" && words.length !== 1) throw new UsageError("Give one book id: literaryworm book pride-and-prejudice");
  return { command, words, options, json };
}

const HELP = `LiteraryWorm from the command line. Everything here only reads.

Without logging in:
  literaryworm search <words> [--limit N]   Find books in LiteraryWorm's catalog
  literaryworm book <id>                    One catalog book's details
  literaryworm pricing                      Plans and prices
  literaryworm whats-new [--limit N]        The latest changes

Your own account (log in first):
  literaryworm login                        Opens LiteraryWorm in your browser to allow this computer
  literaryworm library [--status reading]   Your books (want_to_read, reading, finished, did_not_finish)
  literaryworm highlights [book-id] [--limit N]
  literaryworm stats [--days N]             Reading time for grown-up and teen profiles
  literaryworm status                       Whether this computer is connected
  literaryworm logout                       Disconnects this computer

  literaryworm mcp                          How to add LiteraryWorm to an AI assistant

Add --json to any command for the raw answer.
Remove a connection at any time in Account → Sign-in → Connected apps on literaryworm.com.`;

module.exports = { parseArgs, UsageError, HELP, COMMANDS, STATUSES };
