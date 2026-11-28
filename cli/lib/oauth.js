"use strict";
// The command line's side of logging in: OAuth 2.1 with PKCE, answered on this computer. No I/O.

const crypto = require("node:crypto");

const base64url = (buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A fresh PKCE pair and state for one log-in. */
function newAttempt(random = crypto.randomBytes) {
  const verifier = base64url(random(48));
  return { verifier, challenge: challengeFor(verifier), state: base64url(random(24)) };
}

/** RFC 7636's S256. */
function challengeFor(verifier) {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

/** Where the browser is sent to ask the member: to read, or with `library`, to change the library too. */
function authorizeUrl(metadata, clientId, redirectUri, attempt, library = false) {
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", attempt.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", attempt.state);
  url.searchParams.set("scope", library ? "read library" : "read");
  return url.toString();
}

/**
 * Checks the server's own description of itself before anything is sent to it: every endpoint must
 * be on the same site as the address we were given, over https (or this computer, for development).
 */
function checkMetadata(metadata, mcpUrl) {
  const home = new URL(mcpUrl);
  const local = home.hostname === "localhost" || home.hostname === "127.0.0.1";
  if (home.protocol !== "https:" && !local) throw new Error("LiteraryWorm's address must use https.");
  for (const key of ["authorization_endpoint", "token_endpoint", "registration_endpoint"]) {
    const value = metadata && metadata[key];
    if (typeof value !== "string") throw new Error(`The server didn't say where its ${key} is.`);
    if (new URL(value).origin !== home.origin) throw new Error(`The server's ${key} is on another site (${new URL(value).origin}); stopping.`);
  }
  if (typeof metadata.issuer !== "string") throw new Error("The server didn't name itself.");
  if (!Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes("S256")) {
    throw new Error("The server doesn't support PKCE (S256); stopping.");
  }
  return metadata;
}

/**
 * Reads the address the browser came back to. Returns { code }, or throws with the reason. The
 * state must be ours and, when the server names itself (RFC 9207), it must be the one we asked.
 */
function readCallback(requestUrl, attempt, issuer) {
  const q = new URL(requestUrl, "http://127.0.0.1").searchParams;
  if (q.get("state") !== attempt.state) throw new Error("That answer wasn't for this log-in. Run login again.");
  const iss = q.get("iss");
  if (iss !== null && iss !== issuer) throw new Error("That answer came from another server. Run login again.");
  const error = q.get("error");
  if (error === "access_denied") throw new Error("You chose not to allow it. Nothing was connected.");
  if (error) throw new Error(q.get("error_description") || `LiteraryWorm answered: ${error}`);
  const code = q.get("code");
  if (!code) throw new Error("The answer had no code. Run login again.");
  return { code };
}

module.exports = { newAttempt, challengeFor, authorizeUrl, checkMetadata, readCallback };
