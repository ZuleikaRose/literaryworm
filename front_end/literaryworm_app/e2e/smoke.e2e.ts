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
