"use strict";
const { authorizeUrl, challengeFor, checkMetadata, newAttempt, readCallback } = require("../lib/oauth");

const META = {
  issuer: "https://www.literaryworm.com",
  authorization_endpoint: "https://www.literaryworm.com/mcp/authorize",
  token_endpoint: "https://www.literaryworm.com/mcp/token",
  registration_endpoint: "https://www.literaryworm.com/mcp/register",
  code_challenge_methods_supported: ["S256"],
};
const MCP = "https://www.literaryworm.com/mcp";

describe("logging in", () => {
  it("makes the challenge RFC 7636 gives for its example verifier", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes a new verifier and state each time", () => {
    const a = newAttempt();
    const b = newAttempt();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(a.challenge).toBe(challengeFor(a.verifier));
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
  });

  it("asks with PKCE and the state", () => {
    const attempt = { verifier: "v", challenge: "c", state: "s" };
    const url = new URL(authorizeUrl(META, "client-1", "http://127.0.0.1:5000/callback", attempt));
    expect(url.origin + url.pathname).toBe(META.authorization_endpoint);
    expect(Object.fromEntries(url.searchParams)).toEqual({ response_type: "code", client_id: "client-1", redirect_uri: "http://127.0.0.1:5000/callback", code_challenge: "c", code_challenge_method: "S256", state: "s", scope: "read" });
  });

  it("stops when the server points at another site, or has no PKCE", () => {
    expect(checkMetadata(META, MCP)).toBe(META);
    expect(() => checkMetadata({ ...META, token_endpoint: "https://evil.example/token" }, MCP)).toThrow(/another site/);
    expect(() => checkMetadata({ ...META, registration_endpoint: undefined }, MCP)).toThrow(/registration_endpoint/);
    expect(() => checkMetadata({ ...META, code_challenge_methods_supported: ["plain"] }, MCP)).toThrow(/PKCE/);
    expect(() => checkMetadata(META, "http://www.literaryworm.com/mcp")).toThrow(/https/);
    expect(() => checkMetadata(null, MCP)).toThrow();
  });

  it("takes the code only with our state, from the server we asked", () => {
    const attempt = { state: "s1" };
    expect(readCallback("/callback?code=lw_ac_1&state=s1&iss=https%3A%2F%2Fwww.literaryworm.com", attempt, META.issuer)).toEqual({ code: "lw_ac_1" });
    expect(readCallback("/callback?code=lw_ac_1&state=s1", attempt, META.issuer)).toEqual({ code: "lw_ac_1" });
    expect(() => readCallback("/callback?code=x&state=other", attempt, META.issuer)).toThrow(/wasn't for this log-in/);
    expect(() => readCallback("/callback?code=x&state=s1&iss=https%3A%2F%2Fevil.example", attempt, META.issuer)).toThrow(/another server/);
    expect(() => readCallback("/callback?error=access_denied&state=s1", attempt, META.issuer)).toThrow(/chose not to allow/);
    expect(() => readCallback("/callback?state=s1", attempt, META.issuer)).toThrow(/no code/);
  });
});
