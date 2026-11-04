import { describe, expect, it } from "@jest/globals";
import { fromVolume } from "../lib/bookDetail";
import { isOut } from "../lib/release";
import { DEMO_UPCOMING_ID, demoUpcomingReminder, demoUpcomingRelease, demoUpcomingVolume } from "./demoUpcoming";

const NOW = new Date(2026, 10, 4, 12).getTime();

describe("the demo's sample upcoming book", () => {
  it("is out three weeks after the demo starts, so it's never out yet", () => {
    expect(demoUpcomingRelease(NOW)).toBe("2026-11-25");
    expect(isOut(demoUpcomingRelease(NOW), new Date(NOW))).toBe(false);
  });

  it("would count as out on its release day, not the day before", () => {
    const release = demoUpcomingRelease(NOW);
    expect(isOut(release, new Date(NOW + 20 * 86_400_000))).toBe(false);
    expect(isOut(release, new Date(NOW + 21 * 86_400_000))).toBe(true);
  });

  it("gives Avery a reminder that matches its page", () => {
    const reminder = demoUpcomingReminder(NOW);
    const volume = demoUpcomingVolume(NOW);
    expect(reminder).toEqual({ bookId: DEMO_UPCOMING_ID, title: volume.title, author: volume.authors[0], releaseDate: volume.publishedDate });
  });

  it("shows Remind Me's release on its page, says it's a sample, and links nowhere", () => {
    const view = fromVolume(demoUpcomingVolume(NOW));
    expect(view.release).toMatchObject({ date: "2026-11-25", exact: true });
    expect(view.description).toMatch(/^A sample upcoming book for the LiteraryWorm demo, not a real title\./);
    expect(view.googleLink).toBeNull();
  });

  it("isn't a Google Books id (Google's are 12 characters), so it can't clash with a real title", () => {
    expect(DEMO_UPCOMING_ID).toMatch(/^demo-/);
  });
});
