import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
