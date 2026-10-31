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

  it("offers the demo but not passkeys on the log-in page when there's no backend", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/signin`);
    await page.getByRole("button", { name: "Try the demo" }).waitFor();
    // Passkeys need Supabase Auth; this copy of the app runs without it.
    await expect(page.getByRole("button", { name: /Log in with a passkey/ }).count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("switches Plans to yearly prices, two months free", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/plans`);
    await page.getByText("$9.99").first().waitFor();
    await page.getByRole("radio", { name: /Yearly/ }).check({ force: true });
    await page.getByText("$99.90").first().waitFor();
    await page.getByText(/\$8\.33 a month, instead of \$9\.99/).waitFor();
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

  it("searches by author, keeping the choice in the address", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search`);
    await page.getByRole("radio", { name: "Author" }).check({ force: true });
    await page.getByLabel("Author's name").fill("shelley");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/by=author/);
    await page.getByText(/Results for books by “shelley”/).waitFor();
    await page.getByRole("link", { name: /Frankenstein/ }).first().waitFor();
    // Author searches have no genre filter.
    expect(await page.locator(".search-sidebar").getByText("Any genre").count()).toBe(0);
    expect(errors()).toEqual([]);
  });

  it("checks an ISBN search, which needs Google Books", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search?q=978-0-14-143951-8&by=isbn`);
    await page.getByText(/Results for ISBN 9780141439518/).waitFor();
    // This copy has no backend, so it says so instead of searching; there's nothing to filter.
    await page.getByText(/Searching by ISBN needs Google Books/).waitFor();
    expect(await page.locator(".search-sidebar").count()).toBe(0);
    expect(await page.getByRole("radio", { name: "ISBN" }).isChecked()).toBe(true);
    await page.getByRole("searchbox", { name: "ISBN" }).fill("9780141439519");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByText(/That ISBN doesn't add up/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("lists the authors an author search finds, and follows one from there", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/search?q=shelley&by=author");
    const authors = page.getByRole("region", { name: "Authors" });
    await authors.getByRole("link", { name: "Mary Shelley" }).waitFor();
    await authors.getByRole("button", { name: /Follow Mary Shelley/ }).click();
    await authors.getByRole("button", { name: /Following Mary Shelley/ }).waitFor();
    expect(await authors.getByRole("button", { name: /Following/ }).getAttribute("aria-pressed")).toBe("true");
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

  it("groups the footer's links under Explore, Help, Your privacy and Legal", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    const footer = page.getByRole("contentinfo");
    const group = (name: string) => footer.getByRole("list", { name });
    await expect(group("Explore").getByRole("link").first().textContent()).resolves.toBe("What's new");
    await group("Help").getByRole("link", { name: "Help" }).waitFor();
    await group("Your privacy").getByRole("link", { name: "Privacy Policy" }).waitFor();
    await group("Your privacy").getByRole("link", { name: "Consent Preferences" }).waitFor();
    await group("Legal").getByRole("link", { name: "Terms of Service" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("reads What's new from the footer, and filters it to the major and the minor changes", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await page.getByRole("contentinfo").getByRole("link", { name: "What's new" }).click();
    await page.waitForURL(/\/whats-new/);
    await page.getByRole("heading", { level: 1, name: "What's new" }).waitFor();
    await page.getByRole("heading", { level: 2, name: /October 2026/ }).waitFor();
    expect(await page.locator(".whats-new-filter .chip span").allInnerTexts()).toEqual([
      "Everything",
      "What's new",
      "Major",
      "Minor",
      "New features",
      "Updates",
      "Fixes",
    ]);
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

  it("opens a series from a book's page, in reading order", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/books/anne-of-avonlea`);
    await page.getByText(/Book 2 of \d+ in/).waitFor();
    await page.getByRole("link", { name: "Anne of Green Gables", exact: true }).first().click();
    await page.waitForURL(/\/series\/Anne%20of%20Green%20Gables/);
    await page.getByRole("heading", { level: 1, name: "Anne of Green Gables" }).waitFor();
    const titles = await page.locator(".series-item h2").allTextContents();
    expect(titles.slice(0, 2)).toEqual(["Anne of Green Gables", "Anne of Avonlea"]);
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

  it("can't move down to a plan the household doesn't fit, and is told what to remove", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/plans?plan=basic");
    const checkout = page.getByRole("region", { name: /Confirm Basic/ });
    await checkout.getByText("Basic has room for 1 profile and your household uses 3. Set aside or remove 2 in Who's reading? first.").waitFor();
    expect(await checkout.getByRole("button", { name: /Switch to|Continue to payment/ }).count()).toBe(0);
    await checkout.getByRole("link", { name: "Who's reading?" }).waitFor();
    await checkout.getByRole("button", { name: "Keep my plan" }).click();
    await page.getByRole("region", { name: /Confirm Basic/ }).waitFor({ state: "detached" });
    expect(errors()).toEqual([]);
  });

  it("sets a profile aside to fit a smaller plan, then brings it back", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles?manage=1");
    await page.getByRole("heading", { name: "Manage profiles" }).waitFor();
    const password = async (dialog: ReturnType<typeof page.getByRole>) => {
      const hint = await dialog.getByText(/Demo account password:/).textContent();
      await dialog.getByLabel("Account password").fill(hint!.replace("Demo account password:", "").trim());
    };

    await page.getByRole("button", { name: /^Sam/ }).click();
    let dialog = page.getByRole("dialog", { name: "Edit Sam" });
    await dialog.getByRole("button", { name: "Set aside" }).click();
    await password(dialog);
    await dialog.getByRole("group", { name: "Set profile aside" }).getByRole("button", { name: "Set aside" }).click();
    await dialog.waitFor({ state: "detached" });

    // Out of the grid, into "Set aside", and out of the plan's count.
    const aside = page.getByRole("region", { name: "Set aside" });
    await aside.getByRole("button", { name: /^Sam/ }).waitFor();
    await page.getByRole("button", { name: "Done" }).click();
    expect(await page.getByRole("list").first().getByRole("button", { name: /^Sam/ }).count()).toBe(0);
    await goInApp(page, "/plans?plan=basic");
    await page.getByRole("region", { name: /Confirm Basic/ }).getByText("your household uses 2. Set aside or remove 1").waitFor();

    await goInApp(page, "/profiles");
    await page.getByRole("region", { name: "Set aside" }).getByRole("button", { name: /^Sam/ }).click();
    dialog = page.getByRole("dialog", { name: "Edit Sam" });
    await dialog.getByRole("button", { name: "Bring back" }).click();
    await password(dialog);
    await dialog.getByRole("group", { name: "Bring profile back" }).getByRole("button", { name: "Bring back" }).click();
    await dialog.waitFor({ state: "detached" });
    expect(await page.getByRole("region", { name: "Set aside" }).count()).toBe(0);
    expect(errors()).toEqual([]);
  });

  it("lists the sample club's meeting with Add to calendar, which saves a calendar file", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const meetings = page.getByRole("region", { name: "Meetings" });
    await meetings.getByText("Volume 1: the Netherfield ball", { exact: true }).waitFor();
    const download = page.waitForEvent("download");
    await meetings.getByRole("button", { name: /Add to calendar/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^sunday-classics-\d{4}-\d{2}-\d{2}\.ics$/);
    // The demo member didn't start this club, so only its owner's tools are missing.
    expect(await meetings.getByRole("button", { name: /Schedule a meeting/ }).count()).toBe(0);
    expect(errors()).toEqual([]);
  });

  it("answers the sample club's meeting and shows who's coming", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const meetings = page.getByRole("region", { name: "Meetings" });
    await meetings.getByText("1 going, 1 maybe · Going: Jordan").waitFor();
    await meetings.getByRole("radio", { name: "Going" }).check();
    await meetings.getByText("2 going, 1 maybe · Going: Jordan, you").waitFor();
    await meetings.getByRole("radio", { name: "Can't make it" }).check();
    await page.getByText("We won't send you the reminder.", { exact: false }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("starts a club, schedules a meeting in it, moves it, and cancels it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=clubs");
    await page.getByRole("button", { name: "Start a club" }).click();
    await page.getByLabel("Club name").fill("Tuesday Readers");
    await page.getByRole("button", { name: "Start club" }).click();
    await page.waitForURL(/\/clubs\/[0-9a-f-]{36}$/);
    const meetings = page.getByRole("region", { name: "Meetings" });
    await meetings.getByRole("button", { name: /Schedule a meeting/ }).click();
    // A name is needed first.
    await meetings.getByRole("button", { name: "Schedule meeting" }).click();
    await meetings.getByText(/Give the meeting a name/).waitFor();
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const date = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    await meetings.getByLabel("What you'll talk about").fill("The first five chapters");
    await meetings.getByLabel("Date").fill(date);
    await meetings.getByLabel("Time").fill("18:30");
    await meetings.getByRole("button", { name: "Schedule meeting" }).click();
    await meetings.getByText(/^Scheduled for/).waitFor();
    await meetings.locator(".meeting-title", { hasText: "The first five chapters" }).waitFor();
    // The owner moves it a day later; the form opens filled in.
    await meetings.getByRole("button", { name: /Change The first five chapters/ }).click();
    const name = meetings.getByLabel("What you'll talk about");
    await expect(name.inputValue()).resolves.toBe("The first five chapters");
    await page.waitForFunction(() => document.activeElement?.id.endsWith("-title"));
    const later = new Date(soon.getTime() + 86_400_000);
    await meetings.getByLabel("Date").fill(`${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, "0")}-${String(later.getDate()).padStart(2, "0")}`);
    await meetings.getByRole("button", { name: "Save changes" }).click();
    await meetings.getByText(/^Moved to/).waitFor();
    await meetings.getByRole("button", { name: /Cancel The first five chapters/ }).click();
    await meetings.getByText("Meeting cancelled.").waitFor();
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

  it("sorts My library A–Z, Z–A and by published year, keeping the status filter", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library");
    const titles = () => page.locator(".library-row-title").allInnerTexts();
    await page.locator(".library-row-title").first().waitFor();
    const sortBy = page.getByLabel("Sort by");
    const options = await sortBy.locator("option").allInnerTexts();
    expect(options).toEqual(expect.arrayContaining(["Recently added", "Title A–Z", "Title Z–A", "Numbers first (0–9)", "Recently changed", "Published, newest", "Author A–Z", "Author Z–A"]));

    const fold = (t: string) => t.replace(/^(the|an?)\s+/i, "").toLowerCase();
    const sorted = (list: string[]) => [...list].sort((a, b) => fold(a).localeCompare(fold(b), "en", { numeric: true }));
    // The list re-sorts on the next render, so wait for the order rather than reading it at once.
    const settles = async (want: (now: string[]) => boolean) => {
      for (let i = 0; i < 40; i++) {
        if (want(await titles())) return;
        await page.waitForTimeout(50);
      }
      throw new Error(`Not sorted: ${(await titles()).join(", ")}`);
    };
    const before = await titles();
    expect(before.length).toBeGreaterThan(1);
    const az = sorted(before);
    await sortBy.selectOption("title");
    await page.waitForURL(/sort=title/);
    await settles((now) => now.join("|") === az.join("|"));
    await sortBy.selectOption("title-desc");
    await settles((now) => now.join("|") === [...az].reverse().join("|"));

    // Filtering by status keeps the sort, and the sort keeps the filter.
    await page.locator(".library-filter").getByText(/^Reading \(/).click();
    await page.waitForURL(/status=reading/);
    expect(page.url()).toContain("sort=title-desc");
    await page.locator(".library-filter input:checked + span").getByText(/^Reading \(/).waitFor();
    await sortBy.selectOption("published");
    await page.waitForURL(/sort=published/);
    expect(page.url()).toContain("status=reading");
    expect(errors()).toEqual([]);
  });

  it("searches by author from the header's search box", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const by = page.getByLabel("Search by", { exact: true });
    // Without the backend there's no ISBN choice (Google Books only).
    expect(await by.locator("option").allInnerTexts()).toEqual(["Title", "Author"]);
    await by.selectOption("author");
    await page.getByPlaceholder("Search by author").fill("shelley");
    await page.keyboard.press("Enter");
    await page.waitForURL(/by=author/);
    expect(page.url()).toContain("q=shelley");
    await page.getByText(/Results for books by “shelley”/).waitFor();
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

  it("keeps maintenance notices to developers and admins, and shows no banner without the backend", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/maintenance");
    await page.getByRole("heading", { level: 1, name: "Maintenance notices" }).waitFor();
    await page.getByText("The demo household has no staff access.").waitFor();
    await expect(page.locator(".maintenance-form").count()).resolves.toBe(0);
    await expect(page.getByRole("region", { name: "Planned updates" }).count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("lists passkeys with two-step sign-in in Account, and says the demo can't add them", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#sign-in");
    const passkeys = page.locator(".account-form", { has: page.getByRole("heading", { name: "Passkeys" }) });
    await passkeys.getByText("The demo household can't add passkeys.").waitFor();
    await expect(passkeys.getByRole("button", { name: /Add a passkey/ }).count()).resolves.toBe(0);
    await page.getByRole("heading", { name: "Two-step sign-in" }).waitFor();
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

  it("shows the Kids profiles' week in Family, with the weekly email off until turned on", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#family");
    const report = page.locator(".kids-report");
    await report.getByRole("heading", { name: "Kids reading this week" }).waitFor();
    await report.getByText("1 h 15 min on 3 days (45 min of it listening)").waitFor();
    await report.getByText("Finished 1 book: Peter Pan").waitFor();
    await report.getByText("Weekly goal 2 h: 45 min to go").waitFor();
    const toggle = report.getByRole("switch", { name: /Email me this every week/ });
    await expect(toggle.isChecked()).resolves.toBe(false);
    await toggle.click();
    await page.getByText("We'll email you the Kids reading report every Monday.").waitFor();
    expect(errors()).toEqual([]);
  });

  it("shows a Kids profile the weekly goal a grown-up set, in Goals", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /Mia/ }).first().click();
    await page.waitForURL(/\/browse/);
    await goInApp(page, "/library?view=goals");
    const card = page.getByRole("region", { name: "Weekly goal" });
    await card.getByText("of 2 h this week").waitFor();
    await card.getByText("45 min to go.", { exact: false }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("sets a grown-up profile's own weekly goal in Goals", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=goals");
    const card = page.getByRole("region", { name: "Weekly goal" });
    await card.getByLabel("Weekly reading goal").selectOption({ label: "3 hours a week" });
    await card.getByRole("button", { name: "Save weekly goal" }).click();
    await card.getByText("of 3 h this week").waitFor();
    await card.getByRole("button", { name: /Remove goal/ }).click();
    await card.getByRole("button", { name: "Save weekly goal" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("lists the people a profile follows in My Library, and unfollows one there", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/authors/Mary%20Shelley");
    await page.getByRole("heading", { name: "Mary Shelley", level: 1 }).waitFor();
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await page.getByRole("button", { name: "Following", exact: true }).waitFor();
    await goInApp(page, "/library?view=following");
    const authors = page.getByRole("region", { name: "Authors" });
    await authors.getByRole("link", { name: "Mary Shelley" }).waitFor();
    await authors.getByRole("button", { name: /Following Mary Shelley/ }).click();
    // Still listed, so a slip is easy to undo.
    await authors.getByRole("button", { name: /^Follow Mary Shelley/ }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("highlights in one of eight colours", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.locator(".reader-text p").first().click({ clickCount: 3 });
    const toolbar = page.getByRole("toolbar", { name: "Selected text" });
    await toolbar.waitFor();
    expect(await toolbar.locator(".swatch").count()).toBe(8);
    await toolbar.getByRole("button", { name: "Highlight in teal" }).click();
    await page.locator(".reader-text mark.hl-teal").first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("shows the time left, and the reader's keyboard shortcuts", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/left in this chapter · .* in the book/).waitFor();
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await help.getByText("Bookmark this page, or remove its bookmark").waitFor();
    await page.keyboard.press("Escape");
    await help.waitFor({ state: "hidden" });
    await page.keyboard.press("n");
    await page.getByRole("dialog", { name: "Notes and highlights" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("opens the chapter quiz, which says plainly when the backend isn't there", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.getByRole("button", { name: "Chapter quiz" }).click();
    const dialog = page.getByRole("dialog", { name: "Chapter 1 quiz" });
    await dialog.getByText(/Questions written by AI from chapter 1 only/).waitFor();
    await dialog.getByRole("alert").getByText(/need the LiteraryWorm backend/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("queues an audiobook in Up next, moves it and removes it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/frankenstein");
    await page.getByRole("button", { name: "Add to Up next" }).click();
    await page.getByRole("button", { name: "In Up next" }).waitFor();
    await goInApp(page, "/books/pride-and-prejudice");
    await page.getByRole("button", { name: "Add to Up next" }).click();
    await page.getByRole("button", { name: "In Up next" }).waitFor();
    await goInApp(page, "/library?view=upnext");
    const titles = () => page.locator(".up-next-text a").allTextContents();
    await page.getByRole("heading", { name: "Up next" }).waitFor();
    expect(await titles()).toEqual(["Frankenstein", "Pride and Prejudice"]);
    await page.getByRole("button", { name: "Move Pride and Prejudice up" }).click();
    await page.getByText("Pride and Prejudice moved up.").waitFor();
    expect(await titles()).toEqual(["Pride and Prejudice", "Frankenstein"]);
    await page.getByRole("button", { name: "Remove Frankenstein from Up next" }).click();
    await page.getByText("Frankenstein removed from Up next.").waitFor();
    expect(await titles()).toEqual(["Pride and Prejudice"]);
    expect(errors()).toEqual([]);
  });

  it("opens car mode from the player, and goes back", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/frankenstein");
    await page.getByRole("link", { name: "Car mode" }).click();
    await page.waitForURL(/view=car/);
    await page.locator(".car-play").waitFor();
    await page.getByText(/left in this chapter/).first().waitFor();
    await page.getByRole("link", { name: "Exit car mode" }).click();
    await page.getByRole("link", { name: "Car mode" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("lists badges, words, notes and readers in My Library", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=badges");
    await page.getByRole("heading", { name: "Badges", level: 2 }).waitFor();
    // The demo has finished books, so the first one is earned.
    await page.locator(".badge-card.is-earned").filter({ hasText: "First finish" }).waitFor();
    await goInApp(page, "/library?view=words");
    await page.getByText(/choose Keep in My words/).waitFor();
    await goInApp(page, "/library?view=notes");
    await page.getByRole("heading", { name: /No highlights yet|Notes and highlights/ }).waitFor();
    await goInApp(page, "/library?view=readers");
    await page.getByRole("heading", { name: "Following readers is for members" }).waitFor();
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
  it.each(["/", "/plans", "/search?q=dune", "/legal/privacy", "/series/Oz"])("%s doesn't scroll sideways", async (path) => {
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

  it("the reader, car mode and the new Library tabs don't scroll sideways", async () => {
    const { page, errors } = await newPage(390, 844);
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await expect(scrollsSideways(page)).resolves.toBe(false);
    await goInApp(page, "/listen/frankenstein?view=car");
    await page.locator(".car-play").waitFor();
    await expect(scrollsSideways(page)).resolves.toBe(false);
    for (const view of ["badges", "upnext", "words"]) {
      await goInApp(page, `/library?view=${view}`);
      await page.locator(".library-tabs").waitFor();
      await expect(scrollsSideways(page)).resolves.toBe(false);
    }
    expect(errors()).toEqual([]);
  });
});
