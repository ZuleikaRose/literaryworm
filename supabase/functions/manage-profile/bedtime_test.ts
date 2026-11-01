import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { parseBedtime } from "./bedtime.ts";

Deno.test("parseBedtime takes a listed bedtime and wake-up time, or neither", () => {
  assertEquals(parseBedtime("20:30", "07:00"), { bedtime: "20:30", wakeTime: "07:00" });
  assertEquals(parseBedtime(null, null), { bedtime: null, wakeTime: null });
});

Deno.test("parseBedtime refuses times off the lists, and one without the other", () => {
  assertThrows(() => parseBedtime("23:00", "07:00"));
  assertThrows(() => parseBedtime("20:00", "09:00"));
  assertThrows(() => parseBedtime("20:00", null));
  assertThrows(() => parseBedtime(null, "07:00"));
  assertThrows(() => parseBedtime(2000, "07:00"));
});
