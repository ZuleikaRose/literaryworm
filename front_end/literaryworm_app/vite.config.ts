import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { createServer, defineConfig, type Plugin, type ProxyOptions, type ViteDevServer } from 'vite'

// The public-domain books' texts live in the public `book-texts` Storage bucket (vercel.json sends
// /texts/ there in production). Here the same: a text kept in public/texts is served as it is (the
// three the tests use), any other comes from the bucket.
const texts: ProxyOptions = {
  target: 'https://ldzdmrdvmacpudsbngvd.supabase.co',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/texts\//, '/storage/v1/object/public/book-texts/'),
  bypass: (req) => {
    const file = req.url?.split('?')[0] ?? ''
    return existsSync(`public${decodeURIComponent(file)}`) ? file : undefined
  },
}

// The on-device voices' models live in the public `voice-models` bucket (vercel.json sends
// /voice-models/ there). Here the same, or from public/voice-models when a copy is kept there (not in git).
const voiceModels: ProxyOptions = {
  ...texts,
  rewrite: (path) => path.replace(/^\/voice-models\//, '/storage/v1/object/public/voice-models/'),
}

/** src/lib/publicPages.ts, loaded through Vite (it imports the app's TypeScript and JSON). */
interface PublicPagesModule {
  renderFor(template: string, pathname: string): string
  prerenderedFiles(template: string): { file: string; html: string }[]
}
const PUBLIC_PAGES = '/src/lib/publicPages.ts'

/**
 * Gives every page in the sitemap its own HTML (src/lib/publicPages.ts): after `vite build`, one file
 * per page beside index.html (Home), plus shell.html for the app's other addresses and 404.html; on
 * the dev server, each address's own head, so the end-to-end tests read what Vercel will serve.
 */
function prerender(): Plugin {
  let root = ''
  let outDir = ''
  let building = false
  return {
    name: 'literaryworm-prerender',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
      building = config.command === 'build'
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        if (!ctx.server) return html
        const pages = (await ctx.server.ssrLoadModule(PUBLIC_PAGES)) as PublicPagesModule
        return pages.renderFor(html, new URL(ctx.originalUrl ?? ctx.path, 'http://localhost').pathname)
      },
    },
    async closeBundle() {
      if (!building) return
      let server: ViteDevServer | undefined
      try {
        server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
        const pages = (await server.ssrLoadModule(PUBLIC_PAGES)) as PublicPagesModule
        const files = pages.prerenderedFiles(readFileSync(join(outDir, 'index.html'), 'utf8'))
        for (const { file, html } of files) {
          const path = join(outDir, file)
          mkdirSync(dirname(path), { recursive: true })
          writeFileSync(path, html)
        }
        this.info(`prerendered ${files.length} pages`)
      } finally {
        await server?.close()
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), prerender()],
  server: { proxy: { '/texts/': texts, '/voice-models/': voiceModels } },
  preview: { proxy: { '/texts/': texts, '/voice-models/': voiceModels } },
})
