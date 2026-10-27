// Giao diện sáng/tối (F18). Chế độ tối = class "dark" trên thẻ <html>:
// - index.css: bảng màu tối + biến thể dark: của Tailwind
// - index.html: đoạn script đặt class TRƯỚC khi React chạy để không nháy màu (giữ cùng logic với resolveTheme)
// Lần đầu theo cài đặt máy; bấm nút đổi thì nhớ lựa chọn trong localStorage.

export const THEME_KEY = 'hcmusware.theme'

// stored: 'light' | 'dark' | null (chưa chọn); prefersDark: máy đang để chế độ tối.
export function resolveTheme(stored, prefersDark) {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

// localStorage có thể bị chặn (chế độ riêng tư, tắt cookie) → coi như chưa chọn.
export function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

const systemDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)')

export function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme // ô nhập, thanh cuộn, hộp thoại gốc của trình duyệt đổi theo
}

// Người dùng bấm nút đổi: áp dụng ngay và nhớ lại.
export function setTheme(theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // không lưu được thì chỉ đổi trong lần mở trang này
  }
}

// Gọi 1 lần lúc khởi động (main.jsx): chưa chọn thì đổi theo máy khi người dùng đổi cài đặt máy;
// đổi ở tab khác thì tab này đổi theo.
export function watchTheme() {
  const media = systemDark()
  const sync = () => applyTheme(resolveTheme(readStoredTheme(), media?.matches))
  media?.addEventListener?.('change', sync)
  window.addEventListener('storage', (e) => e.key === THEME_KEY && sync())
}
