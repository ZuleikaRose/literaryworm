// deno test supabase/functions/affiliate-click — runs offline.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const post = (body: unknown, method = "POST") =>
  new Request("http://local/affiliate-click", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

function deps(first = true) {
  const counted: string[] = [];
  return { counted, deps: { firstToday: () => Promise.resolve(first), record: (c: string) => Promise.resolve(void counted.push(c)) } };
}

Deno.test("a first visit today is counted, by code", async () => {
  const d = deps();
  const res = await handle(post({ code: "abcdefgh23" }), d.deps);
  assertEquals(res.status, 200);
  assertEquals(d.counted, ["ABCDEFGH23"]);
});

Deno.test("a repeat visit gets the same answer and isn't counted", async () => {
  const d = deps(false);
  const res = await handle(post({ code: "ABCDEFGH23" }), d.deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(d.counted, []);
});

Deno.test("anything but one valid code is refused", async () => {
  for (const body of [{}, { code: "ABC" }, { code: "ABCDEFGHI1" }, { code: "ABCDEFGH23", extra: 1 }, { code: 12 }]) {
    const d = deps();
    assertEquals((await handle(post(body), d.deps)).status, 400, JSON.stringify(body));
    assertEquals(d.counted, []);
  }
  assertEquals((await handle(post(null, "GET"), deps().deps)).status, 405);
});
