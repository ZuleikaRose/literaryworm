#!/usr/bin/env node
/**
 * Writes public/sitemap.xml from src/lib/publicPages.ts (sitemapXml()): every page built ahead that
 * search engines should index (Home, Pricing, What's new, Search, Sign up, the affiliate program, the
 * footer pages, catalog books, series, genres with catalog titles, authors, and narrators of two or
 * more titles). publicPages.test.ts fails until the file is current. Run it after adding titles,
 * series, genres or footer pages, or a What's new entry:
 *
 *     npm run sitemap
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
try {
  const { indexedPages, sitemapXml } = await server.ssrLoadModule('/src/lib/publicPages.ts')
  const pages = indexedPages()
  writeFileSync(join(root, 'public/sitemap.xml'), sitemapXml(pages))
  console.log(`public/sitemap.xml: ${pages.length} pages`)
} finally {
  await server.close()
}
