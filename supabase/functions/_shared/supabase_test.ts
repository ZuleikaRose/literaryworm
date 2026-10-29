import { assertEquals } from "jsr:@std/assert@1.0.13";
import { needsSecondStep, sessionAal } from "./supabase.ts";

// Unsigned test tokens: only the payload matters here (Auth verifies the signature first).
const token = (claims: Record<string, unknown>) =>
  `x.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.y`;
const verified = { factors: [{ id: "f", status: "verified", factor_type: "totp", created_at: "", updated_at: "" }] };

Deno.test("sessionAal reads the assurance level", () => {
  assertEquals(sessionAal(token({ aal: "aal2" })), "aal2");
  assertEquals(sessionAal(token({ sub: "u" })), undefined);
  assertEquals(sessionAal("not-a-jwt"), undefined);
});

Deno.test("members with two-step sign-in need the code in this session", () => {
  assertEquals(needsSecondStep(verified as never, token({ aal: "aal1" })), true);
  assertEquals(needsSecondStep(verified as never, token({})), true);
  assertEquals(needsSecondStep(verified as never, token({ aal: "aal2" })), false);
});

Deno.test("members without it, or with an unfinished set-up, are unaffected", () => {
  assertEquals(needsSecondStep({ factors: [] }, token({ aal: "aal1" })), false);
  assertEquals(needsSecondStep({}, token({ aal: "aal1" })), false);
  const unverified = { factors: [{ ...verified.factors[0], status: "unverified" }] };
  assertEquals(needsSecondStep(unverified as never, token({ aal: "aal1" })), false);
});
