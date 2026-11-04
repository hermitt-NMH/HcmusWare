import { useSyncExternalStore } from 'react'
import { currentLang, setLang, subscribeLang } from '../lib/i18n'

// Dùng trong component: const { lang, setLang } = useLang()
// App gọi hook này nên đổi ngôn ngữ là cả cây vẽ lại (state, giỏ hàng vẫn giữ nguyên).
// Lúc build (vẽ sẵn) luôn là tiếng Việt.
export function useLang() {
  const lang = useSyncExternalStore(subscribeLang, currentLang, () => 'vi')
  return { lang, setLang }
}
