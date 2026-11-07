import { afterAll, afterEach, describe, expect, it } from "@jest/globals";
import { closeBrowser, closePages, goInApp, newPage, scrollsSideways, signInDemo } from "./browser";
import { readFileSync } from "node:fs";
import { BASE_URL } from "./config";
import { tinyMobi, tinyPdf } from "./bookFixtures";
import { tinyEpub } from "./epubFixture";

/** The newest What's new entry's title (the top of src/data/changelog.json; tests run in the app folder). */
const NEWEST_CHANGE = (JSON.parse(readFileSync("src/data/changelog.json", "utf8")) as { title: string }[])[0].title;

// Each test opens its own pages; close them when it ends, so a hundred don't run at once.
afterEach(closePages);
afterAll(closeBrowser);

describe("a visitor", () => {
  it("sees the landing page and the plans", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await expect(page.title()).resolves.toMatch(/LiteraryWorm/);
    // More than a reader: a card for each kind of tool.
    await page.getByRole("heading", { name: "Everything that happens around a good book" }).waitFor();
    await page.getByRole("heading", { name: "A private journal" }).waitFor();
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

  it("tells a friend who follows an invitation link about their free month", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/signup?ref=abcd2345`);
    await page.getByText("A friend invited you: after your first payment, a month of your plan is free.").waitFor();
    // A link without a real code says nothing about it.
    await page.goto(`${BASE_URL}/signup?ref=nope`);
    await page.getByRole("heading", { name: "Create your account" }).waitFor();
    await expect(page.getByText(/A friend invited you/).count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("switches Plans to yearly prices, two months free", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/plans`);
    await page.getByText("$30.00").first().waitFor();
    await page.getByRole("radio", { name: /Yearly/ }).check({ force: true });
    await page.getByText("$300.00").first().waitFor();
    await page.getByText(/\$25\.00 a month, instead of \$30\.00/).waitFor();
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

  it("finds the classics in another language with Search's language filter", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search?q=candide&lang=fr`);
    await page.getByRole("link", { name: /Candide ou l'optimisme/ }).first().waitFor();
    await page.goto(`${BASE_URL}/search?q=effi&lang=de`);
    await page.getByRole("link", { name: /Effi Briest/ }).first().waitFor();
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

  it("searches by keywords, which look through descriptions too, keeping the filters", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search`);
    await page.getByRole("radio", { name: "Keywords" }).check({ force: true });
    await page.getByRole("searchbox", { name: "Keywords" }).fill("arctic ice");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/by=keywords/);
    await page.getByText(/Results for the keywords “arctic ice”/).waitFor();
    // Frankenstein's description has both words; its title has neither.
    await page.getByRole("link", { name: /Frankenstein/ }).first().waitFor();
    // Keyword searches have a title search's filters.
    await page.locator(".search-sidebar").getByText("Any genre").waitFor();
    expect(errors()).toEqual([]);
  });

  it("suggests keyword searches on Search's start and on Discover", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/search`);
    await page.getByRole("navigation", { name: "Keyword searches" }).getByRole("link", { name: "Detective" }).click();
    await page.waitForURL(/q=detective&by=keywords/);
    await page.getByText(/Results for the keywords “detective”/).waitFor();
    await signInDemo(page);
    await goInApp(page, "/browse");
    await page.getByRole("heading", { name: "Search by keywords" }).waitFor();
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

  it("shows a visitor a sample of books on the home page, then asks them to log in to keep scrolling", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/?genre=fantasy`);
    const feed = page.locator("section.book-feed");
    await feed.getByRole("heading", { name: "Want to keep scrolling?" }).waitFor();
    expect(await feed.locator(".catalog-grid > li").count()).toBeLessThanOrEqual(20);
    expect(await feed.getByRole("button", { name: "Load more books" }).count()).toBe(0);
    await feed.getByRole("link", { name: "Log in" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("turns on OpenDyslexic from the accessibility menu, which turns Lexend off, and the menu scrolls on a short window", async () => {
    const { page, errors } = await newPage();
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: "Accessibility menu" }).click();
    const panel = page.getByRole("region", { name: "Accessibility settings" });
    await panel.getByRole("switch", { name: /Dyslexia-friendly font/ }).check();
    await panel.getByRole("switch", { name: /OpenDyslexic font/ }).check();
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-dyslexic-font"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-readable-font"))).toBe(false);
    expect(await panel.getByRole("switch", { name: /Dyslexia-friendly font/ }).isChecked()).toBe(false);
    // The panel fits the window and scrolls to its last control.
    const box = await panel.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(420);
    expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await panel.getByRole("button", { name: "Reset to defaults" }).scrollIntoViewIfNeeded();
    await panel.getByRole("button", { name: "Reset to defaults" }).click();
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-dyslexic-font"))).toBe(false);
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

    // Without the backend (as here, and for Kids profiles) only the genres with sample titles are offered:
    // of the 44 Google Books subjects added after the first twenty, Family & Relationships is the one.
    const all = ["Technology", "Adventure", "Sci-Fi", "Fiction", "Non-Fiction", "Horror", "Fantasy", "Mystery", "Thriller", "Romance", "Classics", "Historical Fiction", "Young Adult", "Children's", "Biography & Memoir", "History", "Science", "Self-Help", "Poetry", "LGBTQIA+", "Family & Relationships"];
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

  it("shows the affiliate program from the footer, and asks a visitor to log in to apply", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await page.getByRole("contentinfo").getByRole("link", { name: "Affiliate program" }).click();
    await page.waitForURL(/\/affiliates$/);
    await page.getByRole("heading", { level: 1, name: "Recommend LiteraryWorm, earn account credit" }).waitFor();
    await page.getByText(/Never market LiteraryWorm to children/).waitFor();
    await page.getByRole("main").getByRole("link", { name: "Log in" }).waitFor();
    expect(await page.getByRole("button", { name: "Send application" }).count()).toBe(0);
    expect(errors()).toEqual([]);
  });

  it("notes an affiliate's link on sign-up without saying who", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/signup?aff=abcdefgh23`);
    await page.getByText("You came through a LiteraryWorm affiliate's link: they'll see that someone signed up, never who.").waitFor();
    // A code that isn't an affiliate code says nothing.
    await page.goto(`${BASE_URL}/signup?aff=AVERY234`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    expect(await page.getByText(/affiliate's link/).count()).toBe(0);
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
    // The most recent change first (the top of src/data/changelog.json), even when it's minor.
    await expect(page.locator(".release-entry").first().textContent()).resolves.toContain(NEWEST_CHANGE);
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

  it("links to What's new from Home, Plans and Search, not only the footer", async () => {
    const { page, errors } = await newPage();
    for (const path of ["/", "/search", "/plans"]) {
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

describe("languages", () => {
  it("switches the app's language from the accessibility menu, keeping policies in English with a note", async () => {
    const { page, errors } = await newPage();
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: "Accessibility menu" }).click();
    await page.getByLabel("Language").selectOption("fr");
    await page.getByRole("link", { name: "Formules" }).first().waitFor();
    await expect(page.evaluate(() => document.documentElement.lang)).resolves.toBe("fr");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Politique de confidentialité" }).click();
    await page.getByText("Cette page n’existe qu’en anglais. C’est la version anglaise qui fait foi.").waitFor();
    await expect(page.locator("article").getAttribute("lang")).resolves.toBe("en");
    await page.getByRole("heading", { level: 1, name: "Privacy Policy" }).waitFor();
    expect(errors()).toEqual([]);
  });
});

describe("search engines", () => {
  it("gives each page its own canonical address, without the query", async () => {
    const { page, errors } = await newPage();
    await page.goto(`${BASE_URL}/plans?ref=ABCD1234&utm_source=x`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const canonical = () => page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href);
    await expect(canonical()).resolves.toBe("https://www.literaryworm.com/plans");
    await page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: "Search" }).click();
    await page.waitForURL(/\/search/);
    await page.waitForFunction(() => document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.endsWith("/search"));
    expect(errors()).toEqual([]);
  });
});

describe("the demo household", () => {
  it("offers the Search page in a member's header menu, and the header fits from computer to tablet", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const menu = page.getByRole("navigation", { name: "Primary" }).first();
    await expect(menu.getByRole("link").allInnerTexts()).resolves.toEqual(["Discover", "Search", "My Library"]);
    await menu.getByRole("link", { name: "Search" }).click();
    await page.waitForURL(/\/search$/);
    // React Router marks the new page's link a moment after the address changes: wait for it.
    await page.locator('.desktop-nav a[aria-current="page"]', { hasText: "Search" }).waitFor({ timeout: 5000 });
    for (const width of [1280, 1024, 920]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await scrollsSideways(page)).toBe(false);
    }
    expect(errors()).toEqual([]);
  });

  it("keeps scrolling on Home from one genre into the next", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/browse?genre=poetry");
    const feed = page.locator("section.book-feed");
    await feed.getByRole("heading", { name: "Poetry books" }).waitFor();
    await feed.getByText("Now showing: Poetry").waitFor();
    const tiles = feed.locator(".catalog-grid > li");
    await tiles.first().waitFor();
    const first = await tiles.count();
    // Poetry alone runs out quickly; the feed doesn't stop there but runs on into the next genre.
    const more = feed.getByRole("button", { name: "Load more books" });
    await more.click();
    await page.waitForFunction((n) => document.querySelectorAll("section.book-feed .catalog-grid > li").length > n, first);
    expect(await feed.getByText(/That's everything in/).count()).toBe(0);
    expect(await feed.getByRole("heading", { name: "Want to keep scrolling?" }).count()).toBe(0);
    // It says which genre it has reached: no longer Poetry once the next genre's books arrive.
    await page.waitForFunction(() => {
      const line = document.querySelector("section.book-feed .feed-showing")?.textContent ?? "";
      return line.startsWith("Now showing:") && line !== "Now showing: Poetry";
    });
    // A long feed offers Back to top, which returns to the feed's heading.
    const back = feed.getByRole("button", { name: "Back to top of the feed" });
    for (let i = 0; i < 10 && !(await back.first().isVisible()); i++) {
      if (await more.isVisible()) await more.click();
      await page.waitForTimeout(150);
    }
    await back.first().click();
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Poetry books");
    expect(errors()).toEqual([]);
  });

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

  it("sets a Kids profile's bedtime with the account password, and keeps it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles?manage=1");
    await page.getByRole("heading", { name: "Manage profiles" }).waitFor();
    await page.getByRole("button", { name: /^Mia/ }).click();
    let dialog = page.getByRole("dialog", { name: "Edit Mia" });
    await dialog.getByLabel("Bedtime").selectOption({ label: "7:30pm" });
    await dialog.getByLabel("Reading again from").selectOption({ label: "6:30am" });
    const hint = await dialog.getByText(/Demo account password:/).textContent();
    await dialog.getByLabel("Account password").fill(hint!.replace("Demo account password:", "").trim());
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.getByRole("button", { name: /^Mia/ }).click();
    dialog = page.getByRole("dialog", { name: "Edit Mia" });
    await expect(dialog.getByLabel("Bedtime").inputValue()).resolves.toBe("19:30");
    await expect(dialog.getByLabel("Reading again from").inputValue()).resolves.toBe("06:30");
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

  it("shows where the club's members are, and lets this member show their own place", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const places = page.getByRole("region", { name: "Where everyone is" });
    await places.getByText(/^Chapter \d+ · \d+%$/).first().waitFor();
    const share = places.getByRole("switch", { name: /Show my place to this club/ });
    await expect(share.isChecked()).resolves.toBe(false);
    await share.check({ force: true });
    await expect(share.isChecked()).resolves.toBe(true);
    expect(errors()).toEqual([]);
  });

  it("shows the club's reading schedule and where this member stands against it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const schedule = page.getByRole("region", { name: "Reading schedule" });
    // Started two weeks ago at six chapters a week: week 3.
    await schedule.getByText(/^Week 3 of 11/).waitFor();
    await schedule.getByText(/^This week: /).waitFor();
    await schedule.getByText(/^You're (on track|\d+ chapters? (ahead|behind))\.$/).waitFor();
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

  it("finds a club's book by searching, and offers your uploads as the book", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=clubs");
    await page.getByRole("button", { name: "Start a club" }).click();
    // Uploads: the demo's sample uploads are offered as the book.
    await page.getByText(/^My uploads/).click();
    await expect(page.getByLabel(/^Book/).locator("option").allTextContents()).resolves.toEqual(
      expect.arrayContaining([expect.stringContaining("The Tide Clock (The Lantern Coast, #1)")]),
    );
    // Find one of your uploads takes an ISBN too (looked up on Google Books, so not in this test copy).
    await page.getByLabel("Find one of your uploads").fill("9780141439518");
    await page.getByText(/Finding a book by ISBN needs LiteraryWorm's servers/).first().waitFor();
    await page.getByLabel("Find one of your uploads").fill("");
    // My uploads has the same Sort by as LiteraryWorm books, even before the first upload.
    const sortOptions = () => page.locator(".club-form").getByLabel("Sort by").locator("option").allTextContents();
    const uploadSorts = await sortOptions();
    expect(uploadSorts).toEqual([
      "Recently added",
      "Oldest added",
      "Recently changed",
      "Title A–Z",
      "Title Z–A",
      "Numbers first (0–9)",
      "Author A–Z",
      "Author Z–A",
      "Published, newest",
      "Published, oldest",
      "Series, in reading order",
    ]);
    // LiteraryWorm books, narrowed by title or author.
    await page.getByText("LiteraryWorm books").click();
    await expect(sortOptions()).resolves.toEqual(uploadSorts);
    await page.getByLabel("Find a book").fill("pride prejudice");
    await page.getByLabel(/^Book \(1 match\)/).waitFor();
    await expect(page.getByLabel(/^Book/).locator("option").first().textContent()).resolves.toContain("Pride and Prejudice");
    const form = page.locator(".club-form");
    // Sorted by series in reading order, filtered to one series, then back to every book.
    await form.getByLabel("Find a book").fill("");
    await form.getByLabel("Sort by").selectOption("series");
    await form.getByLabel("Series", { exact: true }).selectOption("Anne of Green Gables");
    await expect(form.getByLabel(/^Book/).locator("option").first().textContent()).resolves.toContain("Anne of Green Gables");
    await expect(form.getByLabel(/^Book/).locator("option").nth(1).textContent()).resolves.toContain("Anne of Avonlea");
    await form.getByLabel("Series", { exact: true }).selectOption("");
    // The date sorts say what they go by: books in the library first.
    await form.getByLabel("Sort by").selectOption("added");
    await form.getByText("Books in your library come first, by when you added them.").waitFor();
    await form.getByLabel("Sort by").selectOption("published");
    await expect(form.getByText(/in your library come first/).count()).resolves.toBe(0);
    await form.getByLabel("Sort by").selectOption("title");
    // An ISBN is looked up on Google Books, which needs the servers this test copy doesn't use.
    await form.getByLabel("Find a book").fill("978-0-14-143951-8");
    await form.getByText(/Finding a book by ISBN needs LiteraryWorm's servers/).first().waitFor();
    // The same box takes keywords, which look through descriptions too: Frankenstein's has "arctic ice", its title doesn't.
    expect(await form.getByLabel("Find a book").getAttribute("placeholder")).toBe("Title, Author, Keywords or ISBN");
    expect(await form.getByLabel("Search by", { exact: true }).count()).toBe(0);
    await form.getByLabel("Find a book").fill("arctic ice");
    await expect(form.getByLabel(/^Book/).locator("option").allTextContents()).resolves.toContainEqual(expect.stringContaining("Frankenstein"));
    await form.getByLabel("Find a book").fill("pride prejudice");
    await page.getByLabel("Club name").fill("Austen fans");
    await page.getByRole("button", { name: "Start club" }).click();
    await page.waitForURL(/\/clubs\/[0-9a-f-]{36}$/);
    await page.getByRole("link", { name: "Pride and Prejudice" }).first().waitFor();
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
    await panel.getByText("Sunday Classics", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await expect(panel.count()).resolves.toBe(0);
    await expect(bell.evaluate((b) => b === document.activeElement)).resolves.toBe(true);
    expect(errors()).toEqual([]);
  });

  it("nudges the demo's streak in the bell in the evening, and links to Goals", async () => {
    const { page, errors } = await newPage();
    // 8 pm on the 20th: the demo has read every day for the last six, and nothing yet today. The
    // days 7 and 8 ago it missed (the 12th and 13th) used this month's two rest days, so missing
    // today would end the streak.
    const evening = new Date();
    evening.setDate(20);
    evening.setHours(20, 0, 0, 0);
    await page.clock.setFixedTime(evening);
    await signInDemo(page);
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const panel = page.getByRole("region", { name: "Notifications" });
    await panel.getByText("Your reading").waitFor();
    await panel.getByRole("link", { name: /-day streak ends tonight/ }).click();
    await page.waitForURL(/view=goals/);
    await page.getByText("No rest days left this month: miss a day and the streak starts again.").waitFor();
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

  it("reads in OpenDyslexic with a reading ruler that J and K move, and line focus", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.keyboard.press("t");
    const display = page.getByRole("dialog", { name: "Display" });
    await display.getByLabel("OpenDyslexic").check();
    await display.getByLabel("Reading ruler").check();
    await display.getByRole("button", { name: "Done" }).click();
    await expect(page.locator(".reader-text").evaluate((el) => getComputedStyle(el).fontFamily)).resolves.toContain("OpenDyslexic");
    const ruler = page.getByTestId("reading-guide");
    await ruler.waitFor({ state: "attached" });
    const before = await ruler.evaluate((el) => (el as HTMLElement).offsetTop);
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.waitForFunction((top) => (document.querySelector("[data-testid=reading-guide]") as HTMLElement | null)!.offsetTop > top, before);
    await page.keyboard.press("k");
    // Line focus dims above and below a window of lines.
    await page.keyboard.press("t");
    await display.getByLabel("Line focus").check();
    await display.getByRole("button", { name: "Done" }).click();
    await expect(page.locator(".reading-guide-dim").count()).resolves.toBe(2);
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

  it("offers Previously… from chapter 2, which says plainly when the backend isn't there", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/frankenstein");
    await page.getByRole("button", { name: /^(Play|Pause)$/ }).first().waitFor();
    // Nothing comes before the first chapter.
    await expect(page.getByRole("button", { name: /^Previously…/ }).count()).resolves.toBe(0);
    await page.locator("main").getByRole("button", { name: "Next chapter" }).click();
    await page.getByRole("button", { name: /^Previously…/ }).click();
    const dialog = page.getByRole("dialog", { name: "Previously…" });
    await dialog.getByText(/Written by AI from chapters 1 to 1 only/).waitFor();
    await dialog.getByRole("alert").getByText(/need the LiteraryWorm backend/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("shows the four smart lists in My Library", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=smart");
    for (const name of ["Almost there", "Waiting for you", "From authors you follow", "Loved it"]) {
      await page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) }).waitFor();
    }
    expect(errors()).toEqual([]);
  });

  it("puts a book on the family shelf from its page, and Home shows it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const row = page.getByRole("region", { name: "The family shelf" });
    await row.getByRole("heading", { name: "The family shelf" }).waitFor();
    await row.getByRole("link", { name: /The Secret Garden/ }).first().waitFor();
    await goInApp(page, "/books/treasure-island");
    await page.getByRole("button", { name: "Add to the family shelf" }).click();
    await page.getByRole("button", { name: "On the family shelf" }).waitFor();
    await goInApp(page, "/browse");
    await row.getByRole("link", { name: /Treasure Island/ }).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("pauses on the sleep timer, then offers 15 more minutes from a little earlier", async () => {
    const { page, errors } = await newPage();
    // The page's clock, so five minutes of listening pass in a moment.
    await page.clock.install();
    await signInDemo(page);
    await goInApp(page, "/listen/dune");
    await page.getByLabel("Voice").selectOption({ label: "No voice (silent sample)" });
    await page.getByLabel("Sleep timer").selectOption("5");
    await page.getByRole("button", { name: "Play", exact: true }).first().click();
    await page.clock.runFor(5 * 60 * 1000 + 2000);
    await page.getByText("Sleep timer: paused. Play goes back 30 seconds.").waitFor();
    const more = page.getByRole("button", { name: "15 more minutes" });
    await more.first().waitFor();
    await more.first().click();
    await page.getByText(/Sleep timer: pauses after 1[45]:\d\d more of playing/).waitFor();
    await expect(more.count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("opens bedtime listening with a sleep timer already set, dims it, and goes back to the player", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/dune");
    await page.getByLabel("Voice").selectOption({ label: "No voice (silent sample)" });
    await expect(page.getByLabel("Sleep timer").inputValue()).resolves.toBe("off");
    await page.getByRole("link", { name: "Bedtime listening" }).click();
    const view = page.locator(".bedtime-view");
    await view.getByText("Bedtime listening", { exact: true }).waitFor();
    await view.getByRole("timer").filter({ hasText: /^Stops (in \d+:\d\d|at the end of this chapter)$/ }).waitFor();
    await expect(view.getByLabel("Sleep timer").inputValue()).resolves.not.toBe("off");
    await view.getByRole("button", { name: "Dimmer" }).click();
    await expect(view.getByRole("button", { name: "Dimmer" }).getAttribute("aria-pressed")).resolves.toBe("true");
    await view.getByRole("link", { name: /^Exit/ }).click();
    await page.getByRole("heading", { level: 1, name: "Dune" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("keeps a speed for one book while other books keep the usual speed", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/dune");
    await page.getByLabel("Voice").selectOption({ label: "No voice (silent sample)" });
    await page.getByRole("button", { name: "Skip lengths, intros and outros" }).click();
    const dialog = page.getByRole("dialog", { name: "Player settings" });
    await dialog.getByRole("switch", { name: /Keep this speed for this book/ }).check();
    await dialog.getByRole("button", { name: "Close" }).click();
    await page.getByLabel("Speed").selectOption("2");
    await goInApp(page, "/listen/emma");
    await expect(page.getByLabel("Speed").inputValue()).resolves.toBe("1");
    await goInApp(page, "/listen/dune");
    await expect(page.getByLabel("Speed").inputValue()).resolves.toBe("2");
    expect(errors()).toEqual([]);
  });

  it("turns on character voices in player settings, and the profile keeps the choice", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    // The demo's Frankenstein sample: an upload with natural voices.
    await goInApp(page, "/listen/u-d3e0a1000000000000000000000000a4");
    await page.getByRole("button", { name: "Skip lengths, intros and outros" }).click();
    const dialog = page.getByRole("dialog", { name: "Player settings" });
    const cast = dialog.getByRole("switch", { name: /Character voices/ });
    await expect(cast.isChecked()).resolves.toBe(false);
    await cast.check();
    await dialog.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Skip lengths, intros and outros" }).click();
    await expect(page.getByRole("dialog", { name: "Player settings" }).getByRole("switch", { name: /Character voices/ }).isChecked()).resolves.toBe(true);
    expect(errors()).toEqual([]);
  });

  it("is told about the 48-hour rule before cancelling, and sees the charge still to come after", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#plan");
    const plan = page.locator("#plan");
    await plan.getByText(/Cancel at least 48 hours before your next billing date/).waitFor();
    await plan.getByRole("button", { name: "Cancel membership" }).click();
    // The reason is optional: Continue without one goes straight to the confirmation.
    await page.getByRole("dialog", { name: "Before you go" }).getByRole("button", { name: "Continue" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel your membership?" });
    await dialog.getByText(/No refunds/).waitFor();
    await dialog.getByRole("button", { name: "Cancel membership" }).click();
    await plan.getByText(/^Cancelled: ends /).waitFor();
    await plan.getByRole("button", { name: "Keep my membership" }).click();
    await plan.getByText("Active", { exact: true }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("is asked why when cancelling, and offered what fits: a smaller plan, or a month's credit the demo never adds", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account#plan");
    const plan = page.locator("#plan");
    await plan.getByRole("button", { name: "Cancel membership" }).click();
    let ask = page.getByRole("dialog", { name: "Before you go" });
    // A note needs a reason.
    await ask.getByLabel("Anything else? (optional)").fill("Too much for us now.");
    await ask.getByRole("button", { name: "Continue" }).click();
    await ask.getByText("Choose a reason to send a note with it.").waitFor();
    await ask.getByLabel("It costs too much").check();
    await ask.getByRole("button", { name: "Continue" }).click();
    let offer = page.getByRole("dialog", { name: "Cancel your membership?" });
    await offer.getByRole("heading", { name: "Try Standard instead" }).waitFor();
    await expect(offer.getByRole("link", { name: "See Standard" }).getAttribute("href")).resolves.toBe("/plans?plan=standard");
    await offer.getByRole("button", { name: "Keep membership" }).click();

    await plan.getByRole("button", { name: "Cancel membership" }).click();
    ask = page.getByRole("dialog", { name: "Before you go" });
    await ask.getByLabel("Something else").check();
    await ask.getByRole("button", { name: "Continue" }).click();
    offer = page.getByRole("dialog", { name: "Cancel your membership?" });
    await offer.getByRole("heading", { name: "Stay, and have a month on us" }).waitFor();
    await offer.getByRole("button", { name: "Take the credit and stay" }).click();
    await plan.getByText(/In the demo nothing is credited\. A member would get \$60\.00 off/).waitFor();
    await plan.getByText("Active", { exact: true }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("plays the Year in Review as a story, one screen at a time, each a story-sized picture", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=stats");
    await page.getByRole("button", { name: "Play as a story" }).click();
    const dialog = page.getByRole("dialog", { name: "Your year as a story" });
    await dialog.getByText(/^Screen 1 of \d+$/).waitFor();
    const picture = dialog.getByRole("img", { name: /^Picture: Year in review: \d{4} .+'s year in books/ });
    await picture.waitFor();
    await expect(picture.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).resolves.toEqual([1080, 1920]);
    await expect(dialog.getByRole("button", { name: "Previous" }).isDisabled()).resolves.toBe(true);
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByText(/^Screen 2 of \d+$/).waitFor();
    await dialog.getByRole("img", { name: /^Picture: Time with books: / }).waitFor();
    await dialog.getByRole("button", { name: "Previous" }).focus();
    await page.keyboard.press("ArrowRight");
    await dialog.getByText(/^Screen 3 of \d+$/).waitFor();
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
    // The demo's themes challenge lists its nine themes.
    await expect(section.getByRole("list", { name: "Themes in Reading around: 6 themes" }).getByRole("listitem").count()).resolves.toBe(9);
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

  it("gives the demo its invite link, a past sprint and a sample wishlist that opens Gifts", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/account");
    await page.getByRole("heading", { name: "Invite a friend" }).waitFor();
    await expect(page.getByLabel("Your link").inputValue()).resolves.toMatch(/\/signup\?ref=AVERY234$/);
    await goInApp(page, "/library?view=goals");
    const sprint = page.locator(".sprint-card");
    await sprint.getByText("Last sprint: 20 minutes").waitFor();
    await sprint.getByText("23 pages between you.").waitFor();
    await goInApp(page, "/lists/demo-jordans-wishlist0");
    await page.getByRole("heading", { name: "Give this list as a gift" }).waitFor();
    await page.getByRole("link", { name: "Choose a gift" }).click();
    await page.getByText("From Jordan's wishlist: 5 books are picked. Change them below if you like.").waitFor();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByRole("alert").filter({ hasText: "The demo account can't make payments. Create an account to give a gift." }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("offers a gift card beside gift memberships, with its amount and no plan or books", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/gifts");
    await page.getByLabel("A gift card").check();
    await expect(page.getByRole("group", { name: "Plan" }).count()).resolves.toBe(0);
    await page.getByLabel("$100.00").check();
    await page.getByText("A $100.00 gift card, paid once.").waitFor();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByRole("alert").filter({ hasText: "The demo account can't make payments. Create an account to give a gift." }).waitFor();
    await page.getByLabel("A membership").check();
    await page.getByRole("group", { name: "Plan" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("starts a household reading sprint and counts the pages turned in the reader", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=goals");
    const card = page.locator(".sprint-card");
    await card.getByLabel("Length").selectOption("15");
    await card.getByRole("button", { name: "Start a sprint" }).click();
    await card.getByRole("timer", { name: "Time left in the sprint" }).waitFor();
    await card.getByText(/^1(4:5\d|5:00)$/).waitFor();
    await card.getByText("You've read 0 pages so far on this device.").waitFor();
    await goInApp(page, "/read/frankenstein");
    await page.locator(".sprint-chip").waitFor();
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByRole("timer", { name: /^Reading sprint: 1\d:\d\d left, pages read: 1$/ }).waitFor();
    await goInApp(page, "/library?view=goals");
    await card.getByText("You've read 1 page so far on this device.").waitFor();
    expect(errors()).toEqual([]);
  });

  it("sorts My library A–Z, Z–A, by published year and by series, keeping the status filter", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library");
    const titles = () => page.locator(".library-row-title").allInnerTexts();
    await page.locator(".library-row-title").first().waitFor();
    const sortBy = page.getByLabel("Sort by");
    const options = await sortBy.locator("option").allInnerTexts();
    expect(options).toEqual(expect.arrayContaining(["Recently added", "Title A–Z", "Title Z–A", "Numbers first (0–9)", "Recently changed", "Published, newest", "Author A–Z", "Author Z–A", "Series, in reading order"]));

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
    await sortBy.selectOption("series");
    await page.waitForURL(/sort=series/);
    expect(page.url()).toContain("status=reading");
    expect(errors()).toEqual([]);
  });

  it("searches by author from the header's search box", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const by = page.getByLabel("Search by", { exact: true });
    // Without the backend there's no ISBN choice (Google Books only).
    expect(await by.locator("option").allInnerTexts()).toEqual(["Title", "Author", "Keywords"]);
    await by.selectOption("author");
    await page.getByPlaceholder("Search by author").fill("shelley");
    await page.keyboard.press("Enter");
    await page.waitForURL(/by=author/);
    expect(page.url()).toContain("q=shelley");
    await page.getByText(/Results for books by “shelley”/).waitFor();
    expect(errors()).toEqual([]);
  });

  it("searches uploads by title, author and keywords, linking to the page", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=uploads");
    const filler = "The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats. The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats. The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats. The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats. The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats. The keeper climbed the lighthouse stairs every evening and lit the lamp for the boats.";
    const epub = tinyEpub("The Lighthouse Keeper", "Rowan Ellis", [
      { heading: "Arrival", paragraphs: [filler, "A gull watched from the rocks."] },
      { heading: "The Storm", paragraphs: [filler, "That night a storm broke over the island and the lamp failed."] },
    ]);
    await page.locator('input[type="file"]').setInputFiles({ name: "lighthouse.epub", mimeType: "application/epub+zip", buffer: epub });
    await page.getByRole("link", { name: "The Lighthouse Keeper", exact: true }).waitFor();
    const searchBy = page.locator(".upload-search").getByLabel("Search by");
    // ISBN is offered only with LiteraryWorm's servers (Google Books), which this test copy doesn't use.
    expect(await searchBy.locator("option").allTextContents()).toEqual(["Title", "Author", "Keywords"]);
    // Author narrows the list as you type.
    await searchBy.selectOption("author");
    await page.getByLabel("Author's name").fill("zzz");
    await page.getByText("No uploads match.", { exact: false }).waitFor();
    await page.getByLabel("Author's name").fill("ellis");
    await page.getByRole("link", { name: "The Lighthouse Keeper", exact: true }).waitFor();
    // Keywords look through the text and say where.
    await searchBy.selectOption("keywords");
    await page.getByRole("searchbox", { name: "Keywords" }).fill("storm island");
    await page.locator(".upload-search").getByRole("button", { name: "Search" }).click();
    await page.getByText(/1 book has “storm island”/).first().waitFor();
    const hit = page.locator(".upload-hits a").first();
    expect(await hit.getAttribute("href")).toMatch(/\/read\/u-[0-9a-f]{32}\?chapter=1&page=0$/);
    await page.getByRole("searchbox", { name: "Keywords" }).fill("storm zebra");
    await page.locator(".upload-search").getByRole("button", { name: "Search" }).click();
    await page.getByText(/No uploads have every word of “storm zebra”/).waitFor();
    expect(await scrollsSideways(page)).toBe(false);
    expect(errors()).toEqual([]);
  });

  it("uploads a PDF and a Kindle book beside EPUBs, keeping their text", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=uploads");
    const line = "The tide came in over the flats while the gulls argued on the harbour wall.";
    const pdf = tinyPdf("Harbour Lights", "Mara Quinn", [[line, line, line, "The ferry was late again."], [line, line, "Nobody minded much."]]);
    const filler = `<p>${"The lantern swung in the wind above the empty quay, and the keeper watched the boats come home. ".repeat(6)}</p>`;
    const mobi = tinyMobi("Quay Lanterns", "Ivo Brandt", `<html><body><h1>First Night</h1>${filler}<mbp:pagebreak/><h1>Second Night</h1>${filler}</body></html>`);
    await page.locator('input[type="file"]').setInputFiles([
      { name: "harbour.pdf", mimeType: "application/pdf", buffer: pdf },
      { name: "lanterns.mobi", mimeType: "application/x-mobipocket-ebook", buffer: mobi },
    ]);
    await page.getByRole("link", { name: "Harbour Lights", exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole("link", { name: "Quay Lanterns", exact: true }).waitFor();
    await page.locator(".form-success").getByText("2 books are ready to read.").waitFor();
    // Keyword search reads the PDF's text.
    await page.locator(".upload-search").getByLabel("Search by").selectOption("keywords");
    await page.getByRole("searchbox", { name: "Keywords" }).fill("ferry late");
    await page.locator(".upload-search").getByRole("button", { name: "Search" }).click();
    await page.getByText(/1 book has “ferry late”/).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("sorts uploads under the search box, by published year and by series", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=uploads");
    const words = "The crew checked the hull and the engines before the long burn towards the belt. ".repeat(8);
    const chapters = [{ heading: "One", paragraphs: [words] }];
    await page.locator('input[type="file"]').setInputFiles([
      { name: "second.epub", mimeType: "application/epub+zip", buffer: tinyEpub("Calibans War (The Drift, #2)", "Ada Byron", chapters, "1990-04-01") },
      { name: "first.epub", mimeType: "application/epub+zip", buffer: tinyEpub("Leviathan Rising (The Drift, #1)", "Zoe Adams", chapters, "2015") },
    ]);
    await page.getByRole("link", { name: "Leviathan Rising (The Drift, #1)", exact: true }).waitFor();
    const sortBy = page.locator(".upload-search").getByLabel("Sort by");
    expect(await sortBy.locator("option").allTextContents()).toEqual([
      "Recently added",
      "Oldest added",
      "Recently changed",
      "Title A–Z",
      "Title Z–A",
      "Numbers first (0–9)",
      "Author A–Z",
      "Author Z–A",
      "Published, newest",
      "Published, oldest",
      "Series, in reading order",
    ]);
    const titles = () => page.locator(".library-row-title").allInnerTexts();
    const settles = async (want: string[]) => {
      for (let i = 0; i < 40; i++) {
        if ((await titles()).join("|") === want.join("|")) return;
        await page.waitForTimeout(50);
      }
      throw new Error(`Not sorted: ${(await titles()).join(", ")}`);
    };
    const first = "Leviathan Rising (The Drift, #1)";
    const second = "Calibans War (The Drift, #2)";
    // With the demo's four sample uploads (data/demoUploads.ts).
    const tide = "The Tide Clock (The Lantern Coast, #1)";
    const salt = "The Salt Archive (The Lantern Coast, #2)";
    const orchard = "Notes from a Small Orchard";
    const frank = "Frankenstein; Or, The Modern Prometheus";
    await sortBy.selectOption("published");
    await page.waitForURL(/sort=published/);
    await settles([salt, tide, first, orchard, second, frank]);
    await sortBy.selectOption("published-oldest");
    await settles([frank, second, orchard, first, tide, salt]);
    await sortBy.selectOption("series");
    await page.waitForURL(/sort=series/);
    await settles([first, second, tide, salt, frank, orchard]);
    await sortBy.selectOption("author");
    await settles([first, second, orchard, salt, tide, frank]);
    await sortBy.selectOption("added");
    await page.waitForURL((url) => !url.search.includes("sort="));
    expect(await scrollsSideways(page)).toBe(false);
    expect(errors()).toEqual([]);
  });

  it("plays an upload aloud, and offers the LibriVox recording when the catalog has the book", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=uploads");
    // The demo's Frankenstein upload is the catalog's title, which a LibriVox volunteer reads.
    const row = page.locator(".library-row", { has: page.getByRole("link", { name: "Frankenstein; Or, The Modern Prometheus", exact: true }) });
    const recording = row.getByRole("link", { name: /Listen to their recording/ });
    await recording.waitFor();
    expect(await recording.getAttribute("href")).toBe("/listen/frankenstein");
    // The sample uploads with original text have no recording to offer.
    const orchard = page.locator(".library-row", { has: page.getByRole("link", { name: "Notes from a Small Orchard", exact: true }) });
    expect(await orchard.getByRole("link", { name: /Listen to their recording/ }).count()).toBe(0);
    // Listen opens the upload itself in the player, read by a device voice (or silently without one).
    await row.getByRole("link", { name: /^Listen Frankenstein/ }).click();
    await page.waitForURL(/\/listen\/u-d3e0a1000000000000000000000000a4$/);
    await page.getByRole("heading", { name: "Frankenstein; Or, The Modern Prometheus" }).first().waitFor();
    await page.getByRole("link", { name: /Listen to their recording/ }).waitFor();
    // The demo's Frankenstein sample has natural voices (Google), recorded ahead of time, and starts with the first.
    expect(await page.locator('optgroup[label="Natural voices (Google)"] option').count()).toBe(6);
    await page.getByText(/Read aloud by Aoede, a natural voice from Google\. In the demo/).waitFor();
    const piece = await page.request.get(`${BASE_URL}/voices/demo/en-GB-Chirp3-HD-Aoede-0-0.mp3`);
    expect(piece.ok()).toBe(true);
    expect(piece.headers()["content-type"]).toMatch(/audio\/mpeg/);
    expect(await scrollsSideways(page)).toBe(false);
    expect(errors()).toEqual([]);
    // The demo's other uploads keep the device voices, and say members have natural voices.
    await goInApp(page, "/listen/u-d3e0a1000000000000000000000000a1");
    await page.getByText("Members can choose a natural voice from Google for their uploads.").waitFor();
    expect(await page.locator('optgroup[label="Natural voices (Google)"]').count()).toBe(0);
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

  it("shows the demo a sample affiliate dashboard", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/affiliates");
    const panel = page.getByRole("region", { name: "Your affiliate link" });
    await panel.getByText(/In the demo the link and counts are a sample/).waitFor();
    expect(await panel.getByRole("textbox", { name: "Your link" }).inputValue()).toMatch(/\/signup\?aff=AVERYREAD2$/);
    await panel.getByText("Credit earned").waitFor();
    await panel.getByText("$32.00").waitFor();
    expect(errors()).toEqual([]);
  });

  it("keeps each profile's accessibility settings, and brings them back when it's chosen again", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    const dyslexic = () => page.evaluate(() => document.documentElement.hasAttribute("data-dyslexic-font"));
    const setOpenDyslexic = async (on: boolean) => {
      await page.getByRole("button", { name: "Accessibility menu" }).click();
      const toggle = page.getByRole("region", { name: "Accessibility settings" }).getByRole("switch", { name: /OpenDyslexic font/ });
      if (on) await toggle.check();
      else await toggle.uncheck();
      await page.keyboard.press("Escape");
    };
    const choose = async (name: RegExp) => {
      await goInApp(page, "/profiles");
      await page.getByRole("button", { name }).click();
      await page.waitForURL(/\/browse/);
    };

    await setOpenDyslexic(true);
    expect(await dyslexic()).toBe(true);
    // Sam has nothing kept yet, so what's on screen stays until Sam changes it.
    await choose(/^Sam/);
    expect(await dyslexic()).toBe(true);
    await setOpenDyslexic(false);
    // Back to the first profile: its own choice comes back; then Sam's.
    await choose(/^Avery/);
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-dyslexic-font"));
    await choose(/^Sam/);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-dyslexic-font"));
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
    await report.getByText("22 min of bedtime listening").waitFor();
    const toggle = report.getByRole("switch", { name: /Email me this every week/ });
    await expect(toggle.isChecked()).resolves.toBe(false);
    await toggle.click();
    await page.getByText("We'll email you the Kids reading report every Monday.").waitFor();
    expect(errors()).toEqual([]);
  });

  it("loads analytics after Termly, sending nothing on its own, and pauses it for a Kids profile", async () => {
    const { page, errors } = await newPage();
    const html = await (await fetch(`${BASE_URL}/`)).text();
    expect(html.indexOf("app.termly.io")).toBeGreaterThan(-1);
    expect(html.indexOf("app.termly.io")).toBeLessThan(html.indexOf("analytics.ahrefs.com"));
    expect(html).toContain("data-no-pageview-auto");
    expect(html).toContain('data-categories="analytics"');
    await signInDemo(page);
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /Mia/ }).first().click();
    await page.waitForURL(/\/browse/);
    const keys = await page.$$eval('script[src^="https://analytics.ahrefs.com/"]', (tags) => tags.map((t) => t.getAttribute("data-key")));
    expect(keys.every((k) => k === null)).toBe(true);
    expect(errors()).toEqual([]);
  });

  it("lets a Kids profile ask for a book, and a grown-up say yes in Family", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /Mia/ }).first().click();
    await page.waitForURL(/\/browse/);
    await goInApp(page, "/books/dracula");
    await page.getByRole("heading", { name: "This book isn't on Mia's shelf" }).waitFor();
    await page.getByRole("button", { name: "Ask a grown-up" }).click();
    await page.getByText(/You asked for Dracula/).waitFor();
    // A grown-up answers, with the account password.
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /Avery/ }).first().click();
    await page.waitForURL(/\/browse/);
    await goInApp(page, "/account#family");
    const requests = page.locator(".book-requests");
    await requests.getByText(/Mia asked for Dracula/).waitFor();
    await requests.getByRole("button", { name: "Yes, open it" }).click();
    const dialog = page.getByRole("dialog", { name: /Open Dracula for Mia/ });
    const hint = await dialog.getByText(/Demo account password:/).textContent();
    await dialog.getByLabel("Account password").fill(hint!.replace("Demo account password:", "").trim());
    await dialog.getByRole("button", { name: "Yes, open it" }).click();
    await page.getByText("Mia can open Dracula now.").waitFor();
    // Mia's shelf now has it.
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /Mia/ }).first().click();
    await page.waitForURL(/\/browse/);
    await page.getByRole("heading", { name: "Books you asked for" }).waitFor();
    await goInApp(page, "/books/dracula");
    await page.getByRole("heading", { level: 1, name: /Dracula/ }).waitFor();
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

  it("highlights in one of twelve colours", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/read/frankenstein");
    await page.getByText(/^Page 1 of \d+/).first().waitFor();
    await page.locator(".reader-text p").first().click({ clickCount: 3 });
    const toolbar = page.getByRole("toolbar", { name: "Selected text" });
    await toolbar.waitFor();
    expect(await toolbar.locator(".swatch").count()).toBe(12);
    await toolbar.getByRole("button", { name: "Highlight in indigo" }).click();
    await page.locator(".reader-text mark.hl-indigo").first().waitFor();
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

  it("turns on voice control in car mode after saying who hears it, and follows spoken commands", async () => {
    const { page, errors } = await newPage(393, 852);
    // A stand-in for the browser's speech recognition: the test says what it "heard".
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      class FakeRecognizer {
        onresult: ((e: unknown) => void) | null = null;
        constructor() {
          w.__recognizer = this;
        }
        start() {
          w.__listening = true;
        }
        stop() {}
        abort() {
          w.__listening = false;
        }
      }
      w.SpeechRecognition = FakeRecognizer;
      w.webkitSpeechRecognition = FakeRecognizer;
      w.__say = (transcript: string) =>
        (w.__recognizer as FakeRecognizer).onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal: true })] });
    });
    await signInDemo(page);
    await goInApp(page, "/listen/frankenstein?view=car");
    await page.locator(".car-play").waitFor();
    const say = (words: string) => page.evaluate((t) => (window as unknown as { __say: (s: string) => void }).__say(t), words);
    const voice = page.getByRole("button", { name: "Voice control" });
    await expect(voice.getAttribute("aria-pressed")).resolves.toBe("false");
    // Nothing listens until the listener agrees, after being told the browser's speech service hears it.
    await voice.click();
    const dialog = page.getByRole("dialog", { name: "Turn on voice control?" });
    await dialog.getByText(/Google's in Chrome and Edge, Apple's in Safari/).waitFor();
    await expect(page.evaluate(() => (window as unknown as { __listening?: boolean }).__listening ?? false)).resolves.toBe(false);
    await dialog.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect(voice.getAttribute("aria-pressed")).resolves.toBe("true");
    await expect(page.evaluate(() => (window as unknown as { __listening?: boolean }).__listening)).resolves.toBe(true);
    await say("skip forward 30 seconds");
    await page.getByRole("status").filter({ hasText: "Heard: Forward 30 seconds." }).waitFor();
    // Stray talk does nothing; the screen still fits a phone without scrolling.
    await say("turn left at the lights");
    await page.getByRole("status").filter({ hasText: "Heard: Forward 30 seconds." }).waitFor();
    await expect(page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).resolves.toBe(true);
    // Leaving car mode by voice stops listening.
    await say("exit car mode");
    await page.getByRole("link", { name: "Car mode" }).waitFor();
    await expect(page.evaluate(() => (window as unknown as { __listening?: boolean }).__listening)).resolves.toBe(false);
    expect(errors()).toEqual([]);
  });

  it("lists badges, words, notes and readers in My Library", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=badges");
    await page.getByRole("heading", { name: "Badges", level: 2 }).waitFor();
    // The demo has finished books, so the first one is earned.
    await page.locator(".badge-card.is-earned").filter({ hasText: "First finish" }).waitFor();
    // All 30, the 16 added in November among them.
    await page.getByText(/ of 30 earned\./).waitFor();
    await page.locator(".badge-card").filter({ hasText: "World reader" }).waitFor();
    await goInApp(page, "/library?view=words");
    await page.getByText(/3 words\. 2 to review today/).waitFor();
    await goInApp(page, "/library?view=notes");
    await page.getByRole("heading", { name: /No highlights yet|Notes and highlights/ }).waitFor();
    // The demo follows a sample reader, Jordan, and shows her newest logs (data/demoReaders.ts).
    await goInApp(page, "/library?view=readers");
    await page.getByRole("heading", { name: "Readers you follow" }).waitFor();
    await page.getByText(/Read it in two evenings/).waitFor();
    // And two of Avery's own lists.
    await goInApp(page, "/library?view=lists");
    await page.getByText("Holiday reads").first().waitFor();
    await page.getByText("Classics to finish").first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("lists the demo's reminder for its sample upcoming book, whose page has Remind me set and says it's a sample", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=reminders");
    const row = page.locator(".reminder-row").filter({ hasText: "The Lighthouse at Wren Cove" });
    await row.getByText(/^Due /).waitFor();
    await row.getByRole("link", { name: "The Lighthouse at Wren Cove" }).click();
    await page.getByRole("heading", { name: "The Lighthouse at Wren Cove", level: 1 }).waitFor();
    await page.getByText(/A sample upcoming book for the LiteraryWorm demo, not a real title/).waitFor();
    await page.getByRole("button", { name: /Reminder set/ }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("reviews the words due today from Home, and asks them again later", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await page.getByRole("link", { name: /2 words to review today/ }).click();
    await page.waitForURL(/view=words/);
    await page.getByRole("button", { name: "Review 2 words" }).click();
    const dialog = page.getByRole("dialog", { name: "Review" });
    await dialog.getByText("Word 1 of 2").waitFor();
    await dialog.getByRole("button", { name: "Show the meaning" }).click();
    await dialog.getByRole("button", { name: "I knew it" }).click();
    await dialog.getByRole("button", { name: "Show the meaning" }).click();
    await dialog.getByRole("button", { name: "Not yet" }).click();
    await dialog.getByText("That's all 2 words: you knew 1.").waitFor();
    await dialog.getByRole("button", { name: "Done" }).click();
    // Nothing is due now: known waits a day (step one), Not yet asks again tomorrow.
    await page.getByText(/Nothing to review today/).waitFor();
    await expect(page.getByText("Due tomorrow").count()).resolves.toBe(2);
    expect(errors()).toEqual([]);
  });

  it("writes, edits and deletes a private journal entry on a book's page", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/frankenstein");
    const journal = page.getByRole("region", { name: "My journal" });
    await journal.getByLabel("New entry").fill("Read the storm chapter on the train.");
    await journal.getByRole("button", { name: "Add to journal" }).click();
    const list = journal.getByRole("list", { name: "Journal entries for Frankenstein" });
    await list.getByText("Read the storm chapter on the train.").waitFor();
    await list.getByRole("button", { name: /^Edit/ }).click();
    await journal.getByLabel("Edit the entry").fill("Read the storm chapter twice.");
    await journal.getByRole("button", { name: "Save entry" }).click();
    await list.getByText("Read the storm chapter twice.").waitFor();
    // It's in My Library → Notes, ready to export.
    await goInApp(page, "/library?view=notes");
    // Avery's highlights in Pride and Prejudice are counted there too.
    await page.getByText(/1 journal entry/).first().waitFor();
    await goInApp(page, "/books/frankenstein");
    await page.getByRole("region", { name: "My journal" }).getByRole("button", { name: /^Delete/ }).click();
    await page.getByRole("dialog", { name: "Delete this journal entry?" }).getByRole("button", { name: "Delete entry" }).click();
    await expect(page.getByRole("list", { name: "Journal entries for Frankenstein" }).count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("exports Avery's notes as a PDF", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library?view=notes");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).first().click()]);
    expect(download.suggestedFilename()).toMatch(/-notes\.pdf$/);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(path!);
    expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(bytes.toString("latin1")).toContain("Pride and Prejudice");
    expect(errors()).toEqual([]);
  });

  it("reviews highlights that are due, from Home's nudge to Notes", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/profiles");
    await page.getByRole("button", { name: /^Sam/ }).click();
    // Sam's two highlights from last week are due.
    await page.getByRole("link", { name: /2 highlights to review today/ }).click();
    await page.waitForURL(/view=notes/);
    await page.getByRole("button", { name: "Review 2 highlights" }).click();
    const dialog = page.getByRole("dialog", { name: "Review highlights" });
    await dialog.getByText("Highlight 1 of 2").waitFor();
    await dialog.getByText(/Mary Shelley defending the premise/).waitFor();
    await dialog.getByRole("button", { name: "Still matters" }).click();
    await dialog.getByText("Highlight 2 of 2").waitFor();
    await dialog.getByRole("button", { name: "Again soon" }).click();
    await dialog.getByText("That's all 2 highlights for today.").waitFor();
    await dialog.getByRole("button", { name: "Done" }).click();
    await page.getByText("No highlights to review today.").waitFor();
    await goInApp(page, "/browse");
    await page.getByRole("heading", { name: "Home for Sam" }).waitFor();
    await expect(page.getByRole("link", { name: /highlights? to review today/ }).count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("turns on offline listening on a schedule for an audiobook, and off again", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/frankenstein");
    const schedule = page.getByRole("group", { name: "Listen offline on a schedule" });
    await schedule.getByLabel("Keep").selectOption({ label: "the next 5 chapters" });
    await schedule.getByLabel("On Wi-Fi only").waitFor();
    await schedule.getByRole("button", { name: "Turn on" }).click();
    await schedule.getByText("Keeping the next 5 chapters on this device as you listen, on Wi-Fi only.").waitFor();
    // It stays on the device: a fresh look at the page shows it on.
    await goInApp(page, "/books/dune");
    await goInApp(page, "/books/frankenstein");
    await page.getByRole("group", { name: "Listen offline on a schedule" }).getByText(/^On: the next 5 chapters, on Wi-Fi only\.$/).waitFor();
    await page.getByRole("group", { name: "Listen offline on a schedule" }).getByRole("button", { name: "Turn off" }).click();
    await page.getByRole("group", { name: "Listen offline on a schedule" }).getByRole("button", { name: "Turn on" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("exports the library as a Goodreads CSV that names its books and shelves", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/library");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export for Goodreads" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^literaryworm-goodreads-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    let text = "";
    for await (const chunk of stream) text += chunk.toString("utf8");
    expect(text).toContain("Book Id,Title,Author,Author l-f");
    // Avery's demo library: Dune is being read, Babel is to read.
    expect(text).toMatch(/,Dune,Frank Herbert,"Herbert, Frank",/);
    expect(text).toContain("currently-reading");
    expect(text).toContain("to-read");
    await page.getByText(/Saved \d+ books as a Goodreads file\./).waitFor({ state: "attached" });
    expect(errors()).toEqual([]);
  });

  it("marks a book Didn't finish, then finished, and reads it again as a 2nd read", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/dune");
    const status = page.locator(".detail-actions").getByLabel("Reading status");
    await status.selectOption({ label: "Didn't finish" });
    await page.getByText("Marked as didn't finish.").waitFor({ state: "attached" });
    await goInApp(page, "/library?status=did_not_finish");
    // Avery's demo already has one (Moby-Dick).
    await page.getByRole("radio", { name: /Didn't finish \(2\)/ }).waitFor({ state: "attached" });
    await goInApp(page, "/books/dune");
    await page.locator(".detail-actions").getByLabel("Reading status").selectOption({ label: "Finished" });
    await page.getByRole("button", { name: "Read again" }).click();
    await page.getByText("Your 2nd read").waitFor();
    await expect(page.locator(".detail-actions").getByLabel("Reading status").inputValue()).resolves.toBe("reading");
    expect(errors()).toEqual([]);
  });

  it("tags a book's moods and pace, then filters My Library by mood", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/babel");
    await page.getByRole("button", { name: /How did it feel\?/ }).click();
    const moods = page.getByRole("group", { name: "Moods (up to 3)" });
    await moods.getByRole("button", { name: "Funny" }).click();
    await page.getByText("Added funny.").waitFor({ state: "attached" });
    await page.getByRole("group", { name: "Pace" }).getByRole("button", { name: "Fast" }).click();
    await page.getByRole("button", { name: "How it felt: Funny · Fast pace" }).waitFor();
    await goInApp(page, "/library?mood=funny");
    await page.locator(".library-list").getByText("Babel").first().waitFor();
    await expect(page.locator(".library-list").getByText("Dune").count()).resolves.toBe(0);
    expect(errors()).toEqual([]);
  });

  it("shares a clip from the player, and the clip page shows it to anyone", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/listen/frankenstein");
    await page.getByRole("button", { name: "Share a clip" }).click();
    const dialog = page.getByRole("dialog", { name: "Share a clip" });
    await dialog.getByText("15 seconds").click();
    const link = await dialog.getByLabel("Clip link").inputValue();
    expect(link).toMatch(/\/clips\/frankenstein\?c=\d+&s=\d+&e=\d+$/);
    // A visitor opens it (signed out, in a new page).
    const visitor = await newPage();
    await visitor.page.goto(`${BASE_URL}${new URL(link).pathname}${new URL(link).search}`);
    await visitor.page.getByRole("heading", { level: 1, name: "Frankenstein" }).waitFor();
    await visitor.page.getByRole("button", { name: "Play clip" }).waitFor();
    await goInApp(visitor.page, "/clips/frankenstein?c=0&s=0&e=500");
    await visitor.page.getByRole("heading", { level: 1, name: "Clip not found" }).waitFor();
    expect(errors()).toEqual([]);
    expect(visitor.errors()).toEqual([]);
  });

  it("starts a buddy read from a book's page and shows its invite code", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/dracula");
    await page.getByRole("button", { name: "Read with a friend" }).click();
    await page.waitForURL(/\/clubs\//);
    await page.getByRole("heading", { level: 1, name: "Buddy read: Dracula" }).waitFor();
    await page.getByText("Buddy read · 2 readers").waitFor();
    await page.getByRole("heading", { name: "Invite your reading buddy" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("adds schema.org data for the page shown: the membership on Plans, the book on its page", async () => {
    const { page, errors } = await newPage();
    const types = () =>
      page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.flatMap((el) => [JSON.parse(el.textContent ?? "null")].flat().map((d) => d["@type"])));
    await page.goto(`${BASE_URL}/plans`);
    await page.getByRole("heading", { name: "Questions about plans" }).waitFor();
    await expect(types()).resolves.toEqual(expect.arrayContaining(["WebSite", "Organization", "Product", "FAQPage"]));
    await goInApp(page, "/books/frankenstein");
    await page.getByRole("heading", { level: 1, name: /Frankenstein/ }).waitFor();
    await expect(types().then((t) => [...t].sort())).resolves.toEqual(["Book", "ItemPage", "Organization", "WebSite"]);
    expect(errors()).toEqual([]);
  });

  it("gives every public page its own node with a trail from Home", async () => {
    const { page, errors } = await newPage();
    const nodes = () =>
      page.locator('script[type="application/ld+json"][data-structured]').evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "null")));
    const visit = async (path: string, type: string, trail: string[]) => {
      await goInApp(page, path);
      // Wait for this page's own node (its @id is its address), not the last page's.
      const id = `https://www.literaryworm.com${path}#webpage`;
      await page.waitForFunction(
        ([want, kind]) =>
          [...document.querySelectorAll('script[data-structured="page"]')].some((el) => {
            const d = JSON.parse(el.textContent ?? "null");
            return d?.["@id"] === want && d?.["@type"] === kind;
          }),
        [id, type],
      );
      const node = (await nodes()).find((d) => d["@id"] === id);
      const crumbs = node?.breadcrumb?.itemListElement?.map((c: { name: string }) => c.name) ?? [];
      expect(crumbs).toEqual(trail);
    };
    await page.goto(`${BASE_URL}/`);
    await visit("/", "WebPage", []);
    await visit("/plans", "WebPage", ["Home", "Plans and pricing"]);
    await visit("/search?q=arctic&by=keywords", "SearchResultsPage", ["Home", "Search"]);
    await visit("/whats-new", "CollectionPage", ["Home", "What's new"]);
    await visit("/legal/privacy", "WebPage", ["Home", "Privacy Policy"]);
    await visit("/authors/Mary%20Shelley", "ProfilePage", ["Home", "Mary Shelley"]);
    await visit("/series/Anne%20of%20Green%20Gables", "CollectionPage", ["Home", "Anne of Green Gables"]);
    expect((await nodes()).some((d) => d["@type"] === "BookSeries" && d.hasPart.length > 1)).toBe(true);
    await visit("/books/anne-of-avonlea", "ItemPage", ["Home", "Anne of Green Gables", "Anne of Avonlea"]);
    // Only the page shown: the series' nodes went with its page.
    expect((await nodes()).some((d) => d["@type"] === "BookSeries")).toBe(false);
    expect(errors()).toEqual([]);
  });

  it("makes a reading plan with a day's share, shows it on Home, and removes it", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/the-midnight-library");
    const plan = page.getByRole("region", { name: "Reading plan" });
    // A day already gone is refused, with the reason next to the field.
    await plan.getByLabel("Finish by").fill("2020-01-01");
    await plan.getByRole("button", { name: "Make a plan" }).click();
    await plan.getByText("Choose today or a day still to come.").waitFor();
    // Two weeks from today (the browser's own calendar).
    const inTwoWeeks = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 13);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    await plan.getByLabel("Finish by").fill(inTwoWeeks);
    await plan.getByRole("button", { name: "Make a plan" }).click();
    await plan.getByText("14 days left", { exact: false }).waitFor();
    await plan.getByText(/^About \d+ (minutes?|hr).* a day$/).waitFor();
    await plan.getByText("On track").waitFor();
    await goInApp(page, "/browse");
    const card = page.getByRole("region", { name: "Your reading plans" });
    await card.getByRole("link", { name: "The Midnight Library" }).click();
    await page.waitForURL(/\/books\/the-midnight-library/);
    await page.getByRole("region", { name: "Reading plan" }).getByRole("button", { name: "Remove the plan" }).click();
    await page.getByRole("region", { name: "Reading plan" }).getByRole("button", { name: "Make a plan" }).waitFor();
    expect(errors()).toEqual([]);
  });

  it("offers a club AI discussion questions for chapters the reader has reached, and starts a post with one", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const section = page.getByRole("region", { name: "Discussion questions" });
    await section.getByText(/Written by AI/).waitFor();
    // Only chapters up to the reader's: never one past it.
    const select = section.getByLabel("Chapter");
    const offered = await select.locator("option").count();
    const total = await page.getByLabel("About", { exact: true }).locator("option").count();
    expect(offered).toBeGreaterThanOrEqual(1);
    expect(offered).toBeLessThanOrEqual(total);
    // The demo club has chapter 1's questions to hand.
    await select.selectOption({ index: 0 });
    const first = section.getByRole("listitem").first();
    await first.locator("p").getByText(/rich single man/).waitFor();
    await expect(section.getByRole("listitem").count()).resolves.toBeGreaterThanOrEqual(5);
    await first.getByRole("button", { name: /Start a post with this/ }).click();
    // The post box now holds the question, about chapter 1, with focus there.
    const box = page.getByLabel("Your post");
    await expect(box.inputValue()).resolves.toMatch(/rich single man/);
    await expect(box.evaluate((el) => el === document.activeElement)).resolves.toBe(true);
    await expect(page.getByLabel("About", { exact: true }).inputValue()).resolves.toBe("0");
    expect(errors()).toEqual([]);
  });

  it("starts with high contrast on when the device asks for more contrast, and can turn it off", async () => {
    const { page, errors } = await newPage();
    await page.emulateMedia({ contrast: "more" });
    await signInDemo(page);
    const root = () => page.evaluate(() => document.documentElement.hasAttribute("data-high-contrast"));
    await expect(root()).resolves.toBe(true);
    // Black, not the usual near-black.
    await expect(page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).resolves.toBe("#000000");
    await page.getByRole("button", { name: /Accessibility/ }).click();
    const toggle = page.getByRole("switch", { name: /High contrast/ });
    await expect(toggle.isChecked()).resolves.toBe(true);
    await toggle.click({ force: true });
    await expect(root()).resolves.toBe(false);
    expect(errors()).toEqual([]);
  });

  it("lets club members vote on what to read next, and the owner close a poll and start a club with the winner", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    // Jordan's open poll in the demo club is in the bell until the reader votes.
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await page.getByRole("link", { name: /Sunday Classics asks: What should we read after Pride and Prejudice\?/ }).click();
    await page.waitForURL(/\/clubs\/demo-club/);
    const card = page.getByRole("region", { name: "What to read next" });
    await card.getByText("1 vote: Jordan").waitFor();
    await card.getByRole("button", { name: "Vote for Jane Eyre" }).click();
    await card.getByText("2 votes: Priya, You").waitFor();
    await expect(card.getByRole("button", { name: /for Jane Eyre/ }).getAttribute("aria-pressed")).resolves.toBe("true");
    // Only the owner closes it; the demo club is Jordan's.
    await expect(card.getByRole("button", { name: "Close the poll" }).count()).resolves.toBe(0);
    // In a club of the reader's own: start a poll (two books at least), vote, close it, start the next club.
    await goInApp(page, "/library?view=clubs");
    await page.getByRole("button", { name: /Start a club/ }).first().click();
    await page.getByLabel("Club name").fill("Poll test");
    await page.getByRole("button", { name: "Start club", exact: true }).click();
    await page.waitForURL(/\/clubs\/(?!demo-club)/);
    const mine = page.getByRole("region", { name: "What to read next" });
    await mine.getByRole("button", { name: "Start a poll" }).click();
    await mine.getByRole("button", { name: "Start the poll" }).click();
    await mine.getByText("Add at least 2 books.").waitFor();
    for (const title of ["Emma", "Persuasion"]) {
      await mine.getByLabel("Find a book to offer").fill(title);
      await mine.getByRole("list", { name: "Books found" }).getByRole("button", { name: `Add ${title}` }).click();
    }
    await mine.getByRole("button", { name: "Start the poll" }).click();
    await mine.getByRole("button", { name: "Vote for Persuasion" }).click();
    await mine.getByRole("button", { name: "Close the poll" }).click();
    await mine.getByText(/Persuasion won/).waitFor();
    await mine.getByRole("link", { name: "Start a club with it" }).click();
    await page.waitForURL(/view=clubs&start=persuasion/);
    expect(errors()).toEqual([]);
  });

  it("shows a club's shared highlights, holding back ones past the reader's chapter", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/clubs/demo-club");
    const section = page.getByRole("region", { name: "Shared highlights" });
    // Jordan's is from chapter 1, open to everyone; Priya's is much later in the book.
    await section.getByText(/a single man in possession of a good fortune/).waitFor();
    await section.getByText("The most famous first line, and it's a joke.").waitFor();
    await expect(section.getByText("In vain have I struggled.").count()).resolves.toBe(0);
    await section.getByText(/1 more is from chapters you haven't reached/).waitFor();
    await section.getByRole("button", { name: "Show it anyway" }).click();
    await section.getByText("In vain have I struggled.").waitFor();
    // Avery has highlighted the book's first lines, so one can be shared with the club (in memory in the demo).
    await section.getByRole("heading", { name: "Share one of yours" }).waitFor();
    const pick = section.getByLabel("Highlight");
    await expect(pick.locator("option").count()).resolves.toBeGreaterThan(0);
    await pick.selectOption({ index: 0 });
    await section.getByRole("button", { name: "Share with the club" }).click();
    await page.getByText("Shared with the club.").waitFor();
    await section.getByRole("button", { name: /^Stop sharing/ }).first().waitFor();
    expect(errors()).toEqual([]);
  });

  it("lists the classics in their own language on Discover and Search", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/browse");
    const row = page.getByRole("region", { name: "In their own language" });
    await row.getByRole("link", { name: /Effi Briest/ }).first().waitFor();
    await goInApp(page, "/search");
    const links = page.getByRole("navigation", { name: "Classics in other languages" });
    await links.getByRole("link", { name: "Madame Bovary (French)" }).waitFor();
    await expect(links.getByRole("link").count()).resolves.toBeGreaterThan(0);
    expect(errors()).toEqual([]);
  });

  it("shows the time spent with a book, the pace and the biggest days", async () => {
    const { page, errors } = await newPage();
    await signInDemo(page);
    await goInApp(page, "/books/dune");
    const stats = page.getByRole("region", { name: "Your time with this book" });
    await stats.getByText("3 hr 40 min").waitFor();
    await stats.getByText("2 hr 25 min reading, 1 hr 15 min listening").waitFor();
    await stats.getByText("About 11% of the book an hour").waitFor();
    await stats.getByText(/to the end$/).waitFor();
    await expect(stats.getByRole("listitem").count()).resolves.toBe(3);
    // A book with no time yet has no statistics.
    // Wait for Babel's own heading: Dune's is still showing for a moment after the navigation.
    await goInApp(page, "/books/babel");
    await page.getByRole("heading", { level: 1, name: "Babel" }).waitFor();
    await expect(page.getByRole("region", { name: "Your time with this book" }).count()).resolves.toBe(0);
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
    // On a phone, three rows of big buttons: Back and Forward, Play across, then the chapters.
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    const [back, forward, play, prev, next] = await Promise.all([".car-back", ".car-forward", ".car-play", ".car-prev", ".car-next-chapter"].map(box));
    expect(back.x < forward.x && Math.abs(back.y - forward.y) < 2).toBe(true);
    expect(play.y > back.y + back.height - 1 && prev.y > play.y + play.height - 1).toBe(true);
    expect(prev.x < next.x && Math.abs(prev.y - next.y) < 2).toBe(true);
    expect(play.width > back.width * 1.5).toBe(true);
    for (const b of [back, forward, play, prev, next]) expect(b.height).toBeGreaterThanOrEqual(96);
    await expect(page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).resolves.toBe(true);
    // A phone on its side in a dashboard mount: the five in one row, and it fits without scrolling.
    await page.setViewportSize({ width: 844, height: 390 });
    const row = await Promise.all([".car-prev", ".car-back", ".car-play", ".car-forward", ".car-next-chapter"].map(box));
    expect(row.every((b, i) => Math.abs(b.y - row[0].y) < 2 && (i === 0 || b.x > row[i - 1].x))).toBe(true);
    await expect(page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).resolves.toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of ["badges", "upnext", "words"]) {
      await goInApp(page, `/library?view=${view}`);
      await page.locator(".library-tabs").waitFor();
      await expect(scrollsSideways(page)).resolves.toBe(false);
    }
    expect(errors()).toEqual([]);
  });
});
