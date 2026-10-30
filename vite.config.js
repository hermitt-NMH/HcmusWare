import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Chép startPrefetch (src/lib/prefetch.js) vào <head> của index.html: gọi sẵn dữ liệu của trang
// ngay khi HTML tải xong, không phải chờ tải JS (#179). Hàm trong file đó không import gì nên chép được.
function inlinePrefetch(mode) {
  const env = loadEnv(mode, process.cwd())
  return {
    name: 'inline-prefetch',
    transformIndexHtml(html) {
      if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return html
      // Lấy phần trên dòng "BUNDLE_ONLY" (prefetchPlan, startPrefetch), bỏ chữ export
      const code = readFileSync('src/lib/prefetch.js', 'utf8')
        .split('// ---- BUNDLE_ONLY')[0]
        .replace(/^export /gm, '')
      const args = [env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY].map((x) => JSON.stringify(x))
      const script = `<script>;(function () {\n${code}\nstartPrefetch(window, ${args.join(', ')})\n})()</script>`
      return html.replace('</head>', `${script}\n  </head>`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), inlinePrefetch(mode)],
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện ra file riêng: thư viện ít đổi nên trình duyệt giữ cache lâu,
        // mỗi lần deploy người dùng chỉ phải tải lại phần code của nhóm.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}))
