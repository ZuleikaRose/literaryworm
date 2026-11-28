"use strict";
// The commands. Everything reads; nothing here can change a LiteraryWorm account.

const http = require("node:http");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { HELP, parseArgs, UsageError } = require("./args");
const { createClient, credentialsPath, NotConnected } = require("./client");
const format = require("./format");
const oauth = require("./oauth");
const { version } = require("../package.json");

const LOGIN_MINUTES = 5;

const page = (title, text) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · LiteraryWorm</title>` +
  `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px"><h1>${title}</h1><p>${text}</p></body></html>`;

/** Opens the member's browser. If it can't, the address is on screen to open by hand. */
function openBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The address is printed too.
  }
}

/**
 * Waits on this computer (127.0.0.1 only, a port the system picks) for the browser to come back
 * with the answer. `started(redirectUri)` is called once it's listening.
 */
function waitForAnswer(attempt, issuer, started) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url || !req.url.startsWith("/callback")) {
        res.writeHead(404).end();
        return;
      }
      let outcome;
      try {
        outcome = { ok: oauth.readCallback(req.url, attempt, issuer) };
      } catch (err) {
        outcome = { error: err };
      }
      res.writeHead(outcome.ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      res.end(outcome.ok ? page("Nearly there", "Go back to your terminal. You can close this tab.") : page("Not connected", "Go back to your terminal to see why. You can close this tab."));
      clearTimeout(timer);
      server.close();
      if (outcome.ok) resolve({ ...outcome.ok, redirectUri });
      else reject(outcome.error);
    });
    let redirectUri = "";
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`No answer after ${LOGIN_MINUTES} minutes. Run login again.`));
    }, LOGIN_MINUTES * 60_000);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      Promise.resolve(started(redirectUri)).catch((err) => {
        clearTimeout(timer);
        server.close();
        reject(err);
      });
    });
  });
}

async function login(client, out, library = false) {
  const meta = oauth.checkMetadata(await client.metadata(), client.url);
  const attempt = oauth.newAttempt();
  let clientId = "";
  const answer = await waitForAnswer(attempt, meta.issuer, async (redirectUri) => {
    const name = `LiteraryWorm command line on ${os.hostname()}`.slice(0, 80);
    clientId = await client.register(meta, name, redirectUri);
    const url = oauth.authorizeUrl(meta, clientId, redirectUri, attempt, library);
    out("Opening LiteraryWorm in your browser. Allow this computer there, then come back.");
    out("If nothing opens, go to:\n");
    out(`  ${url}\n`);
    openBrowser(url);
  });
  await client.exchange(meta, clientId, answer.code, attempt.verifier, answer.redirectUri);
  out(
    library
      ? "Connected. This computer can now read your LiteraryWorm library, highlights and reading time, and, if you left that on, add books and change their status."
      : "Connected. This computer can now read your LiteraryWorm library, highlights and reading time.",
  );
  out("Remove it at any time: literaryworm logout, or Account → Sign-in → Connected apps on the site.");
}

/** Runs one command line. Returns the exit code. */
async function run(argv, { out = (line) => console.log(line), err = (line) => console.error(line), client } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    err(e.message);
    return 2;
  }
  const { command, words, options, json } = parsed;
  if (command === "help") {
    out(HELP);
    return 0;
  }
  if (command === "version") {
    out(version);
    return 0;
  }
  const api = client || createClient();
  const show = (value, pretty) => out(format.safe(json ? JSON.stringify(value, null, 2) : pretty(value)));
  try {
    switch (command) {
      case "search":
        show(await api.publicTool("search_catalog", { query: words.join(" "), ...(options.limit ? { limit: Math.min(options.limit, 25) } : {}) }), format.search);
        break;
      case "book":
        show(await api.publicTool("get_book", { id: words[0] }), format.book);
        break;
      case "pricing":
        show(await api.publicTool("get_pricing"), format.pricing);
        break;
      case "whats-new":
        show(await api.publicTool("whats_new", options.limit ? { limit: Math.min(options.limit, 20) } : {}), format.whatsNew);
        break;
      case "library":
        show(await api.memberTool("get_library", options.status ? { status: options.status } : {}), format.library);
        break;
      case "highlights":
        show(await api.memberTool("get_highlights", { ...(words[0] ? { book_id: words[0] } : {}), ...(options.limit ? { limit: options.limit } : {}) }), format.highlights);
        break;
      case "stats":
        show(await api.memberTool("get_reading_stats", options.days ? { days: options.days } : {}), format.stats);
        break;
      case "add":
        show(await api.memberTool("add_to_library", { book_id: words[0], ...(options.status ? { status: options.status } : {}) }), format.libraryChange);
        break;
      case "mark":
        show(await api.memberTool("set_book_status", { book_id: words[0], status: options.status }), format.libraryChange);
        break;
      case "login":
        await login(api, out, Boolean(options.library));
        break;
      case "logout":
        out((await api.logout()) ? "Disconnected. This computer can't read your account any more." : "This computer wasn't connected.");
        break;
      case "status":
        out(api.saved() ? `Connected to ${api.url}. The connection is kept in ${credentialsPath()}.` : 'Not connected. Run "literaryworm login".');
        break;
      case "mcp":
        out(format.mcp(api.url));
        break;
    }
    return 0;
  } catch (e) {
    err(format.safe(e instanceof Error ? e.message : String(e)));
    return e instanceof NotConnected ? 3 : 1;
  }
}

module.exports = { run };
