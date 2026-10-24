# ERD (drawsql.png)

`drawsql.png` in the repository root is rendered from `erd.html` in this folder.

## Updating it

1. Change `schema.sql`.
2. Edit the `tables` and `relations` arrays in `erd.html` to match (columns, keys, nullability, notes),
   and update the `subtitle` with the latest phase.
3. Render the page to a PNG. With Playwright, for example:

   ```js
   await page.setViewportSize({ width: 1600, height: 900 });
   await page.goto("file:///<repo>/docs/erd/erd.html");
   await page.waitForSelector("body[data-ready]");
   await page.locator("#canvas").screenshot({ path: "drawsql.png" });
   ```
