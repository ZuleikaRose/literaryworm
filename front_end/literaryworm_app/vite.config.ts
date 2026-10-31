import { existsSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/texts/': texts } },
  preview: { proxy: { '/texts/': texts } },
})
