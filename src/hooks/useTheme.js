import { useCallback, useSyncExternalStore } from 'react'
import { currentTheme, setTheme } from '../lib/theme'

// Theo dõi class "dark" trên <html> (ai đổi cũng được: nút trên Header, tab khác, cài đặt máy).
function subscribe(onChange) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// Dùng trong component: const { theme, toggleTheme } = useTheme()
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light')
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme])
  return { theme, toggleTheme }
}
