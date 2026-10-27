import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEME_KEY, resolveTheme } from './theme'

describe('resolveTheme – chọn giao diện lúc mở trang', () => {
  it('lần đầu (chưa chọn) theo cài đặt máy', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
    expect(resolveTheme(null, undefined)).toBe('light') // trình duyệt không hỗ trợ matchMedia
  })

  it('đã chọn thì nhớ lựa chọn, bỏ qua cài đặt máy', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('giá trị lưu hỏng thì coi như chưa chọn', () => {
    expect(resolveTheme('blue', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})

describe('script chống nháy màu trong index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const head = html.slice(0, html.indexOf('</head>'))

  it('nằm trong <head> và đọc đúng khóa localStorage', () => {
    expect(head).toContain(`localStorage.getItem('${THEME_KEY}')`)
    expect(head).toContain('prefers-color-scheme: dark')
    expect(head).toContain("classList.add('dark')")
  })

  // Chạy thử đoạn script với các tình huống, kết quả phải khớp resolveTheme
  const script = head.match(/<script>([\s\S]*?)<\/script>/)[1]
  for (const [stored, prefersDark] of [
    [null, true],
    [null, false],
    ['light', true],
    ['dark', false],
    ['blue', true],
  ]) {
    it(`lưu=${stored}, máy tối=${prefersDark} → ${resolveTheme(stored, prefersDark)}`, () => {
      const classes = new Set()
      const root = { classList: { add: (c) => classes.add(c) }, style: {} }
      new Function('document', 'localStorage', 'matchMedia', script)(
        { documentElement: root },
        { getItem: () => stored },
        () => ({ matches: prefersDark }),
      )
      const theme = classes.has('dark') ? 'dark' : 'light'
      expect(theme).toBe(resolveTheme(stored, prefersDark))
      expect(root.style.colorScheme).toBe(theme)
    })
  }

  it('localStorage bị chặn vẫn không lỗi, theo cài đặt máy', () => {
    const classes = new Set()
    const root = { classList: { add: (c) => classes.add(c) }, style: {} }
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(() =>
      new Function('document', 'localStorage', 'matchMedia', script)(
        { documentElement: root },
        blocked,
        () => ({ matches: true }),
      ),
    ).not.toThrow()
    expect(classes.has('dark')).toBe(true)
  })
})
