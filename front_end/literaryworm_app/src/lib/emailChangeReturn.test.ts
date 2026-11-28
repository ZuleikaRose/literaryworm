import { describe, expect, it } from "@jest/globals";
import { readEmailReturn } from "./emailChangeReturn";

describe("coming back from an email-change link", () => {
  it("is nothing on other addresses", () => {
    expect(readEmailReturn("", "")).toBeNull();
    expect(readEmailReturn("?tab=plan", "#message=x")).toBeNull();
  });

  it("knows the first of the two links", () => {
    const hash = "#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email";
    expect(readEmailReturn("?email=changed", hash)).toEqual({ kind: "partial" });
  });

  it("knows the second, which brings a session", () => {
    expect(readEmailReturn("?email=changed", "#access_token=abc&type=email_change")).toEqual({ kind: "back" });
    expect(readEmailReturn("?email=changed", "")).toEqual({ kind: "back" });
  });

  it("knows an expired or used link", () => {
    expect(readEmailReturn("?email=changed", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toEqual({
      kind: "error",
      expired: true,
    });
    expect(readEmailReturn("?email=changed&error=server_error", "")).toEqual({ kind: "error", expired: false });
  });
});
