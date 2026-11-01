// deno test --allow-env supabase/functions/release-emails — the push service and database are stubbed.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import type { PushMessage, PushResult } from "../_shared/webpush.ts";
import { type Device, type DuePush, pushReleases, releasePush } from "./push.ts";

const book = (overrides: Partial<DuePush> = {}): DuePush => ({
  userId: "user-a",
  profileName: "Ada",
  volumeId: "vol1",
  title: "The Long Way Home",
  author: "J. Writer",
  ...overrides,
});
const device = (id: string, userId = "user-a"): Device => ({ id, userId, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" });

Deno.test("one book: its title, author and page", () => {
  const m = releasePush([book()]);
  assertEquals(m.title, "Out today: The Long Way Home");
  assertStringIncludes(m.body, "By J. Writer.");
  assertStringIncludes(m.body, "Ada's profile");
  assertEquals(m.url, "/books/vol1");
});

Deno.test("several books: a count, the first titles, and Home", () => {
  const m = releasePush(["A", "B", "C", "D", "E"].map((t, i) => book({ title: t, volumeId: `v${i}` })));
  assertEquals(m.title, "5 books you were waiting for are out");
  assertEquals(m.body, "A, B, C and 2 more");
  assertEquals(m.url, "/");
  assertEquals(releasePush([book({ title: "A" }), book({ title: "B" })]).body, "A and B");
});

Deno.test("sends each account's devices one notification, forgets the unsubscribed, notes the sent", async () => {
  const sent: [string, PushMessage][] = [];
  const results: Record<string, PushResult> = { d1: "sent", d2: "gone", d3: "failed", d4: "sent" };
  const state = { forgot: [] as string[], touched: [] as string[] };
  const result = await pushReleases({
    claim: () => Promise.resolve([book(), book({ volumeId: "vol2", title: "Second" }), book({ userId: "user-b", title: "Theirs" })]),
    devices: () => Promise.resolve([device("d1"), device("d2"), device("d3"), device("d4", "user-b"), device("d5", "user-c")]),
    send: (d, m) => {
      sent.push([d.id, m]);
      return Promise.resolve(results[d.id]);
    },
    forget: (ids) => Promise.resolve(void (state.forgot = ids)),
    touch: (ids) => Promise.resolve(void (state.touched = ids)),
  });
  assertEquals(result, { accounts: 2, sent: 2, gone: 1, failed: 1 });
  // user-c has no due book, so nothing goes to its device.
  assertEquals(sent.map(([id]) => id), ["d1", "d2", "d3", "d4"]);
  assertEquals(sent[0][1].title, "2 books you were waiting for are out");
  assertEquals(sent[3][1].title, "Out today: Theirs");
  assertEquals(state.forgot, ["d2"]);
  assertEquals(state.touched, ["d1", "d4"]);
});

Deno.test("nothing due: no devices are looked up", async () => {
  let looked = false;
  const result = await pushReleases({
    claim: () => Promise.resolve([]),
    devices: () => {
      looked = true;
      return Promise.resolve([]);
    },
    send: () => Promise.resolve("sent"),
    forget: () => Promise.resolve(),
    touch: () => Promise.resolve(),
  });
  assertEquals(result, { accounts: 0, sent: 0, gone: 0, failed: 0 });
  assertEquals(looked, false);
});
