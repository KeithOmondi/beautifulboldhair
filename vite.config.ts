import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// On Vercel the page is a static file, so the link-preview placeholders (which the Node server fills in per branch) are replaced once at build time.
// When the Node server serves the site, the placeholders are left for it.
const staticPreviews = () => ({
  name: 'static-previews',
  transformIndexHtml(html: string) {
    if (!process.env.VERCEL) return html
    const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''
    return html
      .replaceAll('__OG_TITLE__', 'Beautifully Bold Hair | Book online')
      .replaceAll('__OG_DESC__', 'Book your appointment online or shop wigs and hair. Instant confirmation.')
      .replaceAll('__OG_URL__', site)
      .replaceAll('__OG_IMAGE__', `${site}/bbh-icon.png`)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), staticPreviews(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    // Same-origin API in development, so the session cookie behaves exactly like production.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8000', changeOrigin: false },
    },
  },
})
