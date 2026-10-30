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

  it("switches Plans to yearly prices, two months free", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/plans`);
    await page.getByText("$7.99").first().waitFor();
    await page.getByRole("radio", { name: /Yearly/ }).check({ force: true });
    await page.getByText("$79.90").first().waitFor();
    await page.getByText(/\$6\.66 a month, instead of \$7\.99/).waitFor();
    // ?billing=yearly opens on yearly prices.
    await page.goto(`${BASE_URL}/plans?billing=yearly`);
    expect(await page.getByRole("radio", { name: /Yearly/ }).isChecked()).toBe(true);
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

    const all = ["Technology", "Adventure", "Sci-Fi", "Fiction", "Non-Fiction", "Horror", "Fantasy", "Mystery", "Thriller", "Romance", "Classics", "Historical Fiction", "Young Adult", "Children's", "Biography & Memoir", "History", "Science", "Self-Help", "Poetry"];
    await expect(genres.getByRole("link").allInnerTexts()).resolves.toEqual(all);

    await page.goto(`${BASE_URL}/search`);
    const browse = page.locator("section", { has: page.getByRole("heading", { name: "Or browse a genre" }) });
    await expect(browse.getByRole("link").allInnerTexts()).resolves.toEqual(all);
    await browse.getByRole("link", { name: "Historical Fiction" }).click();
    await page.waitForURL(/genre=historical-fiction/);

    await page.goto(`${BASE_URL}/search?q=wonder&source=literaryworm&genre=fantasy`);
    await page.getByRole("radio", { name: "Fantasy" }).waitFor();
    await expect(page.getByRole("radio", { name: "Fantasy" }).isChecked()).resolves.toBe(true);
    await page.getByRole("link", { name: /Alice's Adventures in Wonderland/ }).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("reads What's new from the footer, and filters it to the major and the minor changes", async () => {
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
    await page.getByText("Minor", { exact: true }).first().click();
    const minors = await page.locator(".release-entry").count();
    expect(minors).toBeGreaterThan(0);
    expect(majors + minors).toBe(all);
    await expect(page.locator(".release-entry .release-major").count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("links to What's new from Home and Plans, not only the footer", async () => {
    const { page, errors } = await newPage();
    for (const path of ["/", "/plans"]) {
      await page.goto(`${BASE_URL}${path}`);
      const link = page.locator("main .whats-new-link").getByRole("link", { name: "See everything that's new" });
      await expect(link.getAttribute("href")).resolves.toBe("/whats-new");
    }
    await page.locator("main .whats-new-link").getByRole("link").click();
    await page.getByRole("heading", { level: 1, name: "What's new" }).waitFor();
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

  it("nudges the demo's streak in the bell in the evening, and links to Goals", async () => {
    const { page, errors } = await newPage();
    // 8 pm today: the demo has read every day up to yesterday, and nothing yet today.
    const evening = new Date();
    evening.setHours(20, 0, 0, 0);
    await page.clock.setFixedTime(evening);
    await signInDemo(page);
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const panel = page.getByRole("region", { name: "Notifications" });
    await panel.getByText("Your reading").waitFor();
    await panel.getByRole("link", { name: /-day streak ends tonight/ }).click();
    await page.waitForURL(/view=goals/);
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

  it("links to What's new from members' Home and from Account's Help", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await page.locator("main .whats-new-link").getByRole("link", { name: "See everything that's new" }).waitFor();
    await goInApp(page, "/account#help");
    await page.locator("#help").getByRole("link", { name: "What's new" }).click();
    await page.getByRole("heading", { level: 1, name: "What's new" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("keeps Member lookup for customer service staff", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/support");
    await page.getByRole("heading", { level: 1, name: "Member lookup" }).waitFor();
    await page.getByText("The demo household has no staff access.").waitFor();
    await expect(page.getByLabel("Member's email").count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("shows this month's listening against the plan in Account", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#plan");
    const usage = page.locator(".plan-usage");
    await usage.getByRole("heading", { name: "This month" }).waitFor();
    // The demo household is on Premium.
    await usage.getByText(/listened\. Unlimited on this plan\./).waitFor();
    expect(errors()).toEqual([]);
  });

  it("offers the new genres as favourites, and gives a favourite beyond the six its own Home row", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles");
    // Sam's favourites (Young adult, Fantasy) were chosen from the old list; both are now rows on Home.
    await page.getByRole("button", { name: /^Sam/ }).click();
    const shelf = (name: string) => page.locator("section.shelf", { has: page.getByRole("heading", { level: 2, name, exact: true }) });
    await shelf("Fantasy").getByText("One of your favourite genres").waitFor();
    await shelf("Young Adult").getByText("One of your favourite genres").waitFor();
    await expect(shelf("Romance").count()).resolves.toBe(0);
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
