import { afterAll, describe, expect, it } from "@jest/globals";
import { closeBrowser, goInApp, newPage, scrollsSideways, signInDemo } from "./browser";
import { BASE_URL } from "./config";

afterAll(closeBrowser);

describe("a visitor", () => {
  it("sees the landing page and the plans", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await expect(page.title()).resolves.toMatch(/LiteraryWorm/);
    await page.getByRole("link", { name: "Plans" }).first().click();
    await page.waitForURL(/\/plans/);
    await page.getByText(/Cancel online any time/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("searches by title and opens a book's page", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search?q=frankenstein`);
    await page.getByRole("link", { name: /Frankenstein/ }).first().click();
    await page.waitForURL(/\/books\/frankenstein/);
    await page.getByRole("heading", { level: 1, name: /Frankenstein/ }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("browses a new genre from Home, and narrows a search by it", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    const genres = page.locator("#discover").getByRole("navigation", { name: "Genres" });
    await genres.getByRole("link", { name: "Fantasy" }).click();
    await page.waitForURL(/genre=fantasy/);
    await page.getByRole("heading", { name: "Fantasy books" }).waitFor();
    await expect(genres.getByRole("link", { name: "Fantasy" }).getAttribute("aria-current")).resolves.toBe("page");

    await page.goto(`${BASE_URL}/search?q=wonder&source=literaryworm&genre=fantasy`);
    await page.getByRole("radio", { name: "Fantasy" }).waitFor();
    await expect(page.getByRole("radio", { name: "Fantasy" }).isChecked()).resolves.toBe(true);
    await page.getByRole("link", { name: /Alice's Adventures in Wonderland/ }).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("reads What's new from the footer, and filters it to the major changes", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await page.getByRole("contentinfo").getByRole("link", { name: "What's new" }).click();
    await page.waitForURL(/\/whats-new/);
    await page.getByRole("heading", { level: 1, name: "What's new" }).waitFor();
    await page.getByRole("heading", { level: 2, name: /October 2026/ }).waitFor();
    const all = await page.locator(".release-entry").count();
    await page.getByText("Major", { exact: true }).first().click();
    const majors = await page.locator(".release-entry").count();
    expect(majors).toBeGreaterThan(0);
    expect(majors).toBeLessThan(all);
    await expect(page.locator(".release-entry .release-major").count()).resolves.toBe(majors);
    expect(errors()).toEqual([]);
  });

  it("asks before unsubscribing from the monthly email, and explains a link without its code", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/unsubscribe?t=abc`);
    await page.getByRole("button", { name: "Unsubscribe" }).waitFor();
    await page.goto(`${BASE_URL}/unsubscribe`);
    await page.getByText(/missing its code/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("reads a policy page", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/legal/terms`);
    await page.getByText(/at least 48 hours before your next billing date/).first().waitFor();
    expect(errors()).toEqual([]);
  });
});

describe("the demo household", () => {
  it("signs in and lands on Discover with the bell", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await page.getByRole("button", { name: /^Notifications/ }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("opens the bell, which lists the sample club's new post, and closes it with Escape", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.click();
    const panel = page.getByRole("region", { name: "Notifications" });
    await panel.getByText("Sunday Classics").waitFor();
    await page.keyboard.press("Escape");
    await expect(panel.count()).resolves.toBe(0);
    await expect(bell.evaluate((b) => b === document.activeElement)).resolves.toBe(true);
    expect(errors()).toEqual([]);
  });

  it("reads a public-domain book and turns the page", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByText(/^Page 2 of \d+/).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("opens Who's who in the reader, which says plainly when the backend isn't there", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.getByRole("button", { name: "Who's who" }).click();
    const dialog = page.getByRole("dialog", { name: "Who's who" });
    await dialog.getByText(/Written by AI from the book up to chapter 1/).waitFor();
    // The e2e server runs without Supabase, so the function can't be reached.
    await dialog.getByRole("alert").getByText(/needs the LiteraryWorm backend/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("opens the audiobook player with its controls", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/frankenstein");
    await page.getByRole("button", { name: /^(Play|Pause)$/ }).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("is told about the 48-hour rule before cancelling, and sees the charge still to come after", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#plan");
    const plan = page.locator("#plan");
    await plan.getByText(/Cancel at least 48 hours before your next billing date/).waitFor();
    await plan.getByRole("button", { name: "Cancel membership" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel your membership?" });
    await dialog.getByText(/No refunds/).waitFor();
    await dialog.getByRole("button", { name: "Cancel membership" }).click();
    await plan.getByText(/^Cancelled: ends /).waitFor();
    await plan.getByRole("button", { name: "Keep my membership" }).click();
    await plan.getByText("Active", { exact: true }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("shares the Year in Review as a picture, in either look", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=stats");
    await page.getByRole("button", { name: "Share as a picture" }).click();
    const dialog = page.getByRole("dialog", { name: "Share your year" });
    const picture = dialog.getByRole("img", { name: /in books: \d+ books? finished/ });
    await picture.waitFor();
    await expect(picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).resolves.toBe(1080);
    await dialog.getByText("Light", { exact: true }).click();
    await picture.waitFor();
    await dialog.getByRole("button", { name: "Download picture" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("starts a household challenge, sees the standings, and deletes it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=goals");
    const section = page.locator(".challenges");
    await section.getByRole("list", { name: /Progress in/ }).first().waitFor();
    await section.getByRole("button", { name: "Start a challenge" }).click();
    await section.getByLabel("Count").selectOption("days");
    await section.getByLabel("Target").fill("10");
    await section.getByText("Next month").click();
    await section.getByRole("button", { name: "Start the challenge" }).click();
    const card = section.locator(".challenge-card", { hasText: /^10 days in / });
    await card.waitFor();
    await card.getByRole("list", { name: /Progress in 10 days in/ }).waitFor();
    await card.getByRole("button", { name: /^Delete/ }).click();
    await expect(card.count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("imports a Goodreads export without counting old reads towards this year", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=goals");
    const goal = page.locator(".goal-count");
    const before = await goal.innerText();

    await goInApp(page, "/library");
    await page.getByRole("button", { name: "Import from Goodreads or StoryGraph" }).click();
    const dialog = page.getByRole("dialog", { name: "Import your reading" });
    const csv =
      "Book Id,Title,Author,My Rating,Exclusive Shelf\n" +
      '1,"The Call of the Wild",Jack London,5,read\n' +
      "2,Peter Pan,J. M. Barrie,0,to-read\n" +
      "3,Not In The Catalog At All,Nobody,4,read\n";
    await dialog.getByLabel("Your export (CSV)").setInputFiles({ name: "goodreads_library_export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await dialog.getByText(/Goodreads export: 3 books/).waitFor();
    await dialog.getByRole("button", { name: "Find these books" }).click();
    await dialog.getByText(/^Found 2 of 3 books/).waitFor();
    await dialog.getByRole("button", { name: /^Add \d+ books?$/ }).click();
    await dialog.getByText(/Added \d+ books? to your library/).waitFor();
    await dialog.getByRole("button", { name: "Done" }).click();

    await goInApp(page, "/library?status=finished");
    await page.getByRole("link", { name: /The Call of the Wild/ }).first().waitFor();
    await goInApp(page, "/library?view=goals");
    await expect(goal.innerText()).resolves.toBe(before);
    expect(errors()).toEqual([]);
  });

  it("starts with the monthly What's new email off, and turns it on", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#preferences");
    const toggle = page.getByRole("switch", { name: /monthly round-up of what's new/ });
    await expect(toggle.isChecked()).resolves.toBe(false);
    await toggle.click();
    await page.getByText("We'll email you the biggest changes once a month.").waitFor();
    await expect(toggle.isChecked()).resolves.toBe(true);
    expect(errors()).toEqual([]);
  });

  it("turns the weekly author email off in Preferences", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#preferences");
    const toggle = page.getByRole("switch", { name: /new books from authors I follow/ });
    await expect(toggle.isChecked()).resolves.toBe(true);
    await toggle.click();
    await page.getByText("No more emails about authors you follow.").waitFor();
    await expect(toggle.isChecked()).resolves.toBe(false);
    expect(errors()).toEqual([]);
  });
});

describe("on a phone", () => {
  it.each(["/", "/plans", "/search?q=dune", "/legal/privacy"])("%s doesn't scroll sideways", async (path) => {
    const { page, errors } = await newPage(390, 844);
    await page.goto(`${BASE_URL}${path}`);
    await page.locator("main").waitFor();
    await expect(scrollsSideways(page)).resolves.toBe(false);
    expect(errors()).toEqual([]);
  });

  it("Discover and Account don't scroll sideways for the demo", async () => {
    const { page, errors } = await newPage(390, 844);
    await signInDemo(page);
    await expect(scrollsSideways(page)).resolves.toBe(false);
    await goInApp(page, "/account");
    await page.locator("#plan").waitFor();
    await expect(scrollsSideways(page)).resolves.toBe(false);
    expect(errors()).toEqual([]);
  });
});
