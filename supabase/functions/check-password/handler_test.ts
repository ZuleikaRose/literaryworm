// deno test supabase/functions/check-password — runs offline.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type Deps, handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const post = (body: unknown, method = "POST") =>
  new Request("http://local/check-password", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json", Authorization: "Bearer token" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

function deps(opts: { right?: string; mayTry?: boolean; signedIn?: boolean } = {}) {
  const checked: string[] = [];
  const d: Deps = {
    member: () =>
      opts.signedIn === false
        ? Promise.reject(new HttpError("unauthorized", "Log in to do that."))
        : Promise.resolve({ id: "u1", email: "reader@example.com" }),
    mayTry: () => Promise.resolve(opts.mayTry ?? true),
    confirm: (email, password) => {
      checked.push(`${email}:${password}`);
      return password === (opts.right ?? "right password") ? Promise.resolve() : Promise.reject(new HttpError("forbidden", "That password isn't right."));
    },
  };
  return { d, checked };
}

Deno.test("checks the session's own email and says whether the password is right", async () => {
  const t = deps();
  const right = await handle(post({ password: "right password" }), t.d);
  assertEquals([right.status, await right.json()], [200, { ok: true }]);
  const wrong = await handle(post({ password: "nope" }), t.d);
  assertEquals([wrong.status, await wrong.json()], [200, { ok: false }]);
  assertEquals(t.checked, ["reader@example.com:right password", "reader@example.com:nope"]);
});

Deno.test("too many tries are refused before any check", async () => {
  const t = deps({ mayTry: false });
  const res = await handle(post({ password: "right password" }), t.d);
  assertEquals(res.status, 429);
  assertEquals(t.checked, []);
});

Deno.test("needs a full log-in", async () => {
  const t = deps({ signedIn: false });
  assertEquals((await handle(post({ password: "right password" }), t.d)).status, 401);
  assertEquals(t.checked, []);
});

Deno.test("anything but one password is refused", async () => {
  for (const body of [{}, { password: "" }, { password: 12 }, { password: "x".repeat(257) }, { password: "a", email: "other@example.com" }]) {
    const t = deps();
    assertEquals((await handle(post(body), t.d)).status, 400, JSON.stringify(body));
    assertEquals(t.checked, []);
  }
  assertEquals((await handle(post(null, "GET"), deps().d)).status, 405);
});
