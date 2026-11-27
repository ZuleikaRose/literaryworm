import { describe, expect, it } from "@jest/globals";
import { TURNSTILE_SCRIPT, turnstileLanguage } from "./turnstile";

describe("turnstile", () => {
  it("renders explicitly, from Cloudflare", () => {
    expect(TURNSTILE_SCRIPT).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  });

  it("names the app's language the way Turnstile does", () => {
    expect(turnstileLanguage("fr")).toBe("fr");
    expect(turnstileLanguage("zh")).toBe("zh-cn");
    expect(turnstileLanguage("pt")).toBe("pt-br");
  });
});
