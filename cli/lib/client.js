"use strict";
// Talks to LiteraryWorm's MCP endpoint, and keeps this computer's connection in one small file.
// The file holds the tokens LiteraryWorm gave this computer: they can only read what the commands
// show, and Account → Sign-in → Connected apps on the site removes them at any time.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_URL = "https://www.literaryworm.com/mcp";

/** The address to talk to: LITERARYWORM_URL (for testing against another copy) or the site. */
function mcpUrl(env = process.env) {
  return (env.LITERARYWORM_URL || DEFAULT_URL).replace(/\/+$/, "");
}

/** Where the connection is kept: the platform's own place for a program's settings. */
function credentialsPath(env = process.env, platform = process.platform, home = os.homedir()) {
  const base = platform === "win32" ? env.APPDATA || path.join(home, "AppData", "Roaming") : env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(base, "literaryworm", "credentials.json");
}

function readCredentials(file = credentialsPath()) {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/** Written for this user only (0600; the folder 0700). */
function writeCredentials(value, file = credentialsPath()) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function removeCredentials(file = credentialsPath()) {
  fs.rmSync(file, { force: true });
}

class NotConnected extends Error {
  constructor(message = 'This computer isn\'t connected. Run "literaryworm login".') {
    super(message);
  }
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function postForm(fetcher, url, fields) {
  const res = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
  return { res, body: await readJson(res) };
}

/** The tokens from a token endpoint answer, with the time the access token runs out. */
function tokensFrom(body, now = Date.now()) {
  if (!body || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") throw new Error("LiteraryWorm's answer had no tokens. Try again.");
  const seconds = Number.isFinite(body.expires_in) ? body.expires_in : 3600;
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + seconds * 1000 };
}

/**
 * Makes the calls. `store` reads and writes the connection (the file, or a stand-in in tests), and
 * `fetcher` is fetch.
 */
function createClient({ url = mcpUrl(), fetcher = fetch, store = { read: readCredentials, write: writeCredentials, remove: removeCredentials }, now = Date.now } = {}) {
  let id = 0;

  async function metadata() {
    const res = await fetcher(`${url}/.well-known/oauth-authorization-server`);
    if (!res.ok) throw new Error(`Couldn't reach LiteraryWorm (${res.status}). Try again later.`);
    return readJson(res);
  }

  async function rpc(endpoint, name, args, token) {
    const res = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    });
    if (res.status === 401) return { unauthorized: true };
    if (res.status === 429) throw new Error("Too many requests. Wait a minute, then try again.");
    const body = await readJson(res);
    if (!res.ok || !body) throw new Error((body && body.error && body.error.message) || `LiteraryWorm couldn't answer (${res.status}). Try again later.`);
    if (body.error) throw new Error(body.error.message || "LiteraryWorm couldn't answer.");
    const text = body.result && body.result.content && body.result.content[0] && body.result.content[0].text;
    if (body.result && body.result.isError) throw new Error(text || "LiteraryWorm couldn't answer.");
    try {
      return { value: JSON.parse(text) };
    } catch {
      throw new Error("LiteraryWorm's answer couldn't be read. Try again.");
    }
  }

  /** The saved connection for this address, or null. */
  function saved() {
    const all = store.read();
    return all && all.url === url && typeof all.refreshToken === "string" ? all : null;
  }

  async function refresh(current) {
    const meta = await metadata();
    const { res, body } = await postForm(fetcher, meta.token_endpoint, { grant_type: "refresh_token", refresh_token: current.refreshToken, client_id: current.clientId });
    if (!res.ok) {
      // The connection was removed (in Account, or it went unused for 90 days).
      if (body && body.error === "invalid_grant") {
        store.write({ url, clientId: current.clientId });
        throw new NotConnected('This computer\'s connection has ended. Run "literaryworm login" to connect again.');
      }
      throw new Error((body && body.error_description) || `Couldn't refresh the connection (${res.status}). Try again later.`);
    }
    const next = { ...current, ...tokensFrom(body, now()) };
    store.write(next);
    return next;
  }

  return {
    url,
    metadata,
    saved,

    /** A tool that needs no log-in. */
    async publicTool(name, args = {}) {
      const answer = await rpc(`${url}/public`, name, args);
      if (answer.unauthorized) throw new Error("LiteraryWorm refused that. Try again later.");
      return answer.value;
    },

    /** A tool about the connected member. Refreshes the access token when it's run out, once. */
    async memberTool(name, args = {}) {
      let current = saved();
      if (!current) throw new NotConnected();
      if (!current.accessToken || current.expiresAt - 60_000 < now()) current = await refresh(current);
      let answer = await rpc(url, name, args, current.accessToken);
      if (answer.unauthorized) {
        current = await refresh(current);
        answer = await rpc(url, name, args, current.accessToken);
        if (answer.unauthorized) throw new NotConnected();
      }
      return answer.value;
    },

    /** Registers this computer as an app, once; later log-ins reuse it. */
    async register(meta, name, redirectUri) {
      const all = store.read();
      if (all && all.url === url && typeof all.clientId === "string") return all.clientId;
      const res = await fetcher(meta.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: name, redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
      });
      const body = await readJson(res);
      if (!res.ok || !body || typeof body.client_id !== "string") throw new Error((body && body.error_description) || `Couldn't register this computer (${res.status}). Try again later.`);
      store.write({ url, clientId: body.client_id });
      return body.client_id;
    },

    /** Swaps the code from the browser for this computer's tokens and keeps them. */
    async exchange(meta, clientId, code, verifier, redirectUri) {
      const { res, body } = await postForm(fetcher, meta.token_endpoint, { grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: redirectUri });
      if (!res.ok) throw new Error((body && body.error_description) || `Couldn't finish connecting (${res.status}). Run login again.`);
      store.write({ url, clientId, ...tokensFrom(body, now()) });
    },

    /** Ends the connection on LiteraryWorm's side too, then forgets it here. */
    async logout() {
      const current = saved();
      if (!current) return false;
      try {
        const meta = await metadata();
        if (meta && typeof meta.revocation_endpoint === "string") await postForm(fetcher, meta.revocation_endpoint, { token: current.refreshToken });
      } finally {
        store.remove();
      }
      return true;
    },
  };
}

module.exports = { createClient, credentialsPath, mcpUrl, readCredentials, writeCredentials, removeCredentials, tokensFrom, NotConnected, DEFAULT_URL };
