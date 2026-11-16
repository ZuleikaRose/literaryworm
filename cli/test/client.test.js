"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createClient, credentialsPath, mcpUrl, NotConnected, readCredentials, removeCredentials, writeCredentials } = require("../lib/client");
const { run } = require("../lib/main");

const URL_ = "https://www.literaryworm.com/mcp";
const META = { issuer: "https://www.literaryworm.com", token_endpoint: `${URL_}/token`, registration_endpoint: `${URL_}/register`, revocation_endpoint: `${URL_}/revoke` };

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
const toolAnswer = (value) => reply(200, { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(value) }], isError: false } });

/** A stand-in for the server: answers by address, and remembers what it was sent. */
function server(routes) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`unexpected call to ${url}`);
    return typeof route === "function" ? route(init, calls) : route;
  };
  return { fetcher, calls };
}

function memory(initial = null) {
  let value = initial;
  return { read: () => value, write: (v) => (value = v), remove: () => (value = null), get value() { return value; } };
}

describe("the client", () => {
  it("calls public tools without a token", async () => {
    const { fetcher, calls } = server({ [`${URL_}/public`]: toolAnswer({ books: [] }) });
    const client = createClient({ url: URL_, fetcher, store: memory() });
    expect(await client.publicTool("search_catalog", { query: "x" })).toEqual({ books: [] });
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ jsonrpc: "2.0", method: "tools/call", params: { name: "search_catalog", arguments: { query: "x" } } });
  });

  it("says to log in when this computer isn't connected", async () => {
    const client = createClient({ url: URL_, fetcher: server({}).fetcher, store: memory() });
    await expect(client.memberTool("get_library")).rejects.toBeInstanceOf(NotConnected);
    // A connection to another address isn't this one.
    const other = createClient({ url: URL_, fetcher: server({}).fetcher, store: memory({ url: "https://elsewhere.example/mcp", clientId: "c", accessToken: "a", refreshToken: "r", expiresAt: 9e15 }) });
    await expect(other.memberTool("get_library")).rejects.toBeInstanceOf(NotConnected);
  });

  it("sends the access token, and refreshes it first when it has run out", async () => {
    const store = memory({ url: URL_, clientId: "c1", accessToken: "old", refreshToken: "r1", expiresAt: 1000 });
    const { fetcher, calls } = server({
      [`${URL_}/.well-known/oauth-authorization-server`]: reply(200, META),
      [`${URL_}/token`]: reply(200, { access_token: "new", refresh_token: "r2", expires_in: 3600 }),
      [URL_]: toolAnswer({ count: 0, books: [] }),
    });
    const client = createClient({ url: URL_, fetcher, store, now: () => 5000 });
    expect(await client.memberTool("get_library")).toEqual({ count: 0, books: [] });
    expect(calls.map((c) => c.url)).toEqual([`${URL_}/.well-known/oauth-authorization-server`, `${URL_}/token`, URL_]);
    expect(calls[1].init.body).toBe("grant_type=refresh_token&refresh_token=r1&client_id=c1");
    expect(calls[2].init.headers.Authorization).toBe("Bearer new");
    expect(store.value).toMatchObject({ accessToken: "new", refreshToken: "r2", expiresAt: 5000 + 3600_000 });
  });

  it("refreshes once after a 401, then gives up", async () => {
    let asked = 0;
    const store = memory({ url: URL_, clientId: "c1", accessToken: "a", refreshToken: "r1", expiresAt: 9e15 });
    const { fetcher } = server({
      [`${URL_}/.well-known/oauth-authorization-server`]: reply(200, META),
      [`${URL_}/token`]: reply(200, { access_token: "b", refresh_token: "r2", expires_in: 3600 }),
      [URL_]: () => (++asked === 1 ? reply(401, { error: { code: "unauthorized" } }) : toolAnswer({ ok: true })),
    });
    expect(await createClient({ url: URL_, fetcher, store }).memberTool("get_library")).toEqual({ ok: true });
    expect(asked).toBe(2);
  });

  it("forgets the tokens when the connection has ended, keeping the registration", async () => {
    const store = memory({ url: URL_, clientId: "c1", accessToken: "a", refreshToken: "r1", expiresAt: 0 });
    const { fetcher } = server({
      [`${URL_}/.well-known/oauth-authorization-server`]: reply(200, META),
      [`${URL_}/token`]: reply(400, { error: "invalid_grant", error_description: "This connection has ended. Connect again." }),
    });
    await expect(createClient({ url: URL_, fetcher, store }).memberTool("get_library")).rejects.toBeInstanceOf(NotConnected);
    expect(store.value).toEqual({ url: URL_, clientId: "c1" });
  });

  it("passes on a tool's own error and a rate limit in plain words", async () => {
    const bad = server({ [`${URL_}/public`]: reply(200, { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "That id isn't a LiteraryWorm catalog book." }], isError: true } }) });
    await expect(createClient({ url: URL_, fetcher: bad.fetcher, store: memory() }).publicTool("get_book", { id: "x" })).rejects.toThrow("That id isn't a LiteraryWorm catalog book.");
    const busy = server({ [`${URL_}/public`]: reply(429, { error: { code: "rate_limited" } }) });
    await expect(createClient({ url: URL_, fetcher: busy.fetcher, store: memory() }).publicTool("get_pricing")).rejects.toThrow(/Too many requests/);
  });

  it("registers once, exchanges the code, and logging out revokes and forgets", async () => {
    const store = memory();
    const { fetcher, calls } = server({
      [`${URL_}/register`]: reply(201, { client_id: "c9" }),
      [`${URL_}/token`]: reply(200, { access_token: "a", refresh_token: "r", expires_in: 3600 }),
      [`${URL_}/.well-known/oauth-authorization-server`]: reply(200, META),
      [`${URL_}/revoke`]: reply(200, {}),
    });
    const client = createClient({ url: URL_, fetcher, store, now: () => 0 });
    expect(await client.register(META, "LiteraryWorm command line on laptop", "http://127.0.0.1:5000/callback")).toBe("c9");
    expect(await client.register(META, "again", "http://127.0.0.1:6000/callback")).toBe("c9");
    expect(calls.filter((c) => c.url.endsWith("/register"))).toHaveLength(1);
    await client.exchange(META, "c9", "lw_ac_1", "verifier", "http://127.0.0.1:5000/callback");
    expect(store.value).toEqual({ url: URL_, clientId: "c9", accessToken: "a", refreshToken: "r", expiresAt: 3600_000 });
    expect(client.saved()).not.toBeNull();
    expect(await client.logout()).toBe(true);
    expect(calls[calls.length - 1].init.body).toBe("token=r");
    expect(store.value).toBeNull();
    expect(await client.logout()).toBe(false);
  });
});

describe("the connection file", () => {
  it("lives in the platform's settings folder", () => {
    expect(credentialsPath({ XDG_CONFIG_HOME: "/x" }, "linux", "/home/a")).toBe(path.join("/x", "literaryworm", "credentials.json"));
    expect(credentialsPath({}, "darwin", "/Users/a")).toBe(path.join("/Users/a", ".config", "literaryworm", "credentials.json"));
    expect(credentialsPath({ APPDATA: "C:\\Roaming" }, "win32", "C:\\Users\\a")).toBe(path.join("C:\\Roaming", "literaryworm", "credentials.json"));
    expect(mcpUrl({})).toBe("https://www.literaryworm.com/mcp");
    expect(mcpUrl({ LITERARYWORM_URL: "http://localhost:54321/functions/v1/mcp/" })).toBe("http://localhost:54321/functions/v1/mcp");
  });

  it("is written for this user only, and removed on logout", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lw-cli-"));
    const file = path.join(dir, "literaryworm", "credentials.json");
    try {
      expect(readCredentials(file)).toBeNull();
      writeCredentials({ url: URL_, clientId: "c" }, file);
      expect(readCredentials(file)).toEqual({ url: URL_, clientId: "c" });
      if (process.platform !== "win32") expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      removeCredentials(file);
      expect(readCredentials(file)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("run", () => {
  const collect = () => {
    const lines = { out: [], err: [] };
    return { lines, out: (l) => lines.out.push(l), err: (l) => lines.err.push(l) };
  };

  it("prints a search, and the raw answer with --json", async () => {
    const client = { publicTool: async () => ({ count: 1, books: [{ id: "emma", title: "Emma", author: "Jane Austen", year: 1815, url: "u" }] }) };
    const a = collect();
    expect(await run(["search", "emma"], { ...a, client })).toBe(0);
    expect(a.lines.out[0]).toBe("Emma — Jane Austen (1815)\n  emma  u");
    const b = collect();
    expect(await run(["search", "emma", "--json"], { ...b, client })).toBe(0);
    expect(JSON.parse(b.lines.out[0]).books[0].id).toBe("emma");
  });

  it("exits 2 for a bad command line, 3 when not connected, 1 for other failures", async () => {
    const a = collect();
    expect(await run(["nonsense"], a)).toBe(2);
    expect(a.lines.err[0]).toMatch(/Unknown command/);
    const b = collect();
    expect(await run(["library"], { ...b, client: { memberTool: async () => { throw new NotConnected(); } } })).toBe(3);
    expect(b.lines.err[0]).toMatch(/literaryworm login/);
    const c = collect();
    expect(await run(["pricing"], { ...c, client: { publicTool: async () => { throw new Error("down\u001b[31m"); } } })).toBe(1);
    expect(c.lines.err[0]).toBe("down[31m");
  });

  it("shows help and the version without calling anything", async () => {
    const a = collect();
    expect(await run([], a)).toBe(0);
    expect(a.lines.out[0]).toMatch(/Everything here only reads/);
    const b = collect();
    expect(await run(["--version"], b)).toBe(0);
    expect(b.lines.out[0]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
