# ERD (drawsql.png)

`drawsql.png` in the repository root is rendered from `erd.html` in this folder.

## Updating it

1. Add or change a migration in `supabase/migrations/`, then run `supabase/build-schema.sh`.
2. Edit the `tables` and `relations` arrays in `erd.html` to match (columns, keys, nullability, notes),
   and update the `subtitle`. `schema.sql` itself is generated: run `supabase/build-schema.sh` after changing a migration.
3. Render the page to a PNG. With Playwright, for example:

   ```js
   await page.setViewportSize({ width: 1700, height: 900 });
   await page.goto("file:///<repo>/docs/erd/erd.html");
   await page.waitForSelector("body[data-ready]");
   await page.locator("#canvas").screenshot({ path: "drawsql.png" });
   ```
