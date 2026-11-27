// deno test supabase/functions/recovery-code — runs offline.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { type CheckResult, type Deps, handle, type Member } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const post = (body: unknown, opts: { token?: string | null; method?: string } = {}) => {
  const headers: Record<string, string> = { Origin: ORIGIN, "Content-Type": "application/json" };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? "token"}`;
  const method = opts.method ?? "POST";
  return new Request("http://local/recovery-code", { method, headers, body: method === "POST" ? JSON.stringify(body) : undefined });
};

function deps(member: Member | null = { id: "u1", twoStep: true }, result: CheckResult = "ok") {
  const checked: string[] = [];
  const turnedOff: string[] = [];
  const d: Deps = {
    member: () => Promise.resolve(member),
    check: (_user, code) => Promise.resolve(void checked.push(code)).then(() => result),
    turnOffTwoStep: (user) => Promise.resolve(void turnedOff.push(user)),
  };
  return { d, checked, turnedOff };
}

Deno.test("a right code turns two-step sign-in off for that member", async () => {
  const t = deps();
  const res = await handle(post({ code: " abcde-12345 " }), t.d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, twoStep: false });
  assertEquals(t.checked, ["abcde-12345"]);
  assertEquals(t.turnedOff, ["u1"]);
});

Deno.test("a wrong code changes nothing", async () => {
  const t = deps(undefined, "wrong");
  const res = await handle(post({ code: "abcde-12345" }), t.d);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error.code, "bad_request");
  assertEquals(t.turnedOff, []);
});

Deno.test("too many tries are refused with a wait", async () => {
  const t = deps(undefined, "rate_limited");
  const res = await handle(post({ code: "abcde-12345" }), t.d);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "3600");
  assertEquals(t.turnedOff, []);
});

Deno.test("an account without two-step sign-in has nothing to recover", async () => {
  const t = deps({ id: "u1", twoStep: false });
  assertEquals((await handle(post({ code: "abcde-12345" }), t.d)).status, 400);
  assertEquals(t.checked, []);
});

Deno.test("no session or an ended one is refused before any check", async () => {
  const none = deps();
  assertEquals((await handle(post({ code: "abcde-12345" }, { token: null }), none.d)).status, 401);
  const ended = deps(null);
  assertEquals((await handle(post({ code: "abcde-12345" }), ended.d)).status, 401);
  assertEquals([...none.checked, ...ended.checked], []);
});

Deno.test("anything but one code of a sensible length is refused", async () => {
  for (const body of [{}, { code: "" }, { code: 12 }, { code: "x".repeat(41) }, { code: "abcde-12345", extra: 1 }]) {
    const t = deps();
    assertEquals((await handle(post(body), t.d)).status, 400, JSON.stringify(body));
    assertEquals(t.checked, []);
  }
  assertEquals((await handle(post(null, { method: "GET" }), deps().d)).status, 405);
});
