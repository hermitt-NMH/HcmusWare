import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { __setForTest, currentLang, t } from './i18n'
import en from '../i18n/en'

afterEach(() => __setForTest('vi'))

describe('t – dịch giao diện', () => {
  it('tiếng Việt: trả nguyên câu, chèn giá trị', () => {
    expect(t('Giỏ hàng')).toBe('Giỏ hàng')
    expect(t('Còn {n} sản phẩm', { n: 3 })).toBe('Còn 3 sản phẩm')
    expect(currentLang()).toBe('vi')
  })

  it('tiếng Anh: dịch theo từ điển, chọn số ít / số nhiều theo n', () => {
    __setForTest('en', {
      'Giỏ hàng': 'Cart',
      '{n} sản phẩm': ['{n} product', '{n} products'],
    })
    expect(t('Giỏ hàng')).toBe('Cart')
    expect(t('{n} sản phẩm', { n: 1 })).toBe('1 product')
    expect(t('{n} sản phẩm', { n: 5 })).toBe('5 products')
  })

  it('câu chưa có bản dịch thì hiện tiếng Việt; giá trị không phải chuỗi giữ nguyên', () => {
    __setForTest('en', {})
    expect(t('Câu chưa dịch {x}', { x: 1 })).toBe('Câu chưa dịch 1')
    expect(t(null)).toBe(null)
    expect(t(32)).toBe(32)
  })
})

// Mọi khóa viết trong code (t('...'), tKey('...'), tJsx('...')) phải có trong src/i18n/en.js,
// để giao diện tiếng Anh không lẫn câu tiếng Việt. Thêm câu mới → thêm bản dịch.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'i18n' ? [] : sourceFiles(p)
    // i18n.js chỉ có câu ví dụ trong chú thích
    return /\.jsx?$/.test(f) && !/\.test\.|^i18n\.js$/.test(f) ? [p] : []
  })
}

const KEY_RE = /\bt(?:Key|Jsx)?\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => (c === 'n' ? '\n' : c))

describe('từ điển tiếng Anh', () => {
  const src = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
  const keys = new Set()
  for (const file of sourceFiles(src))
    for (const m of readFileSync(file, 'utf8').matchAll(KEY_RE)) keys.add(unescape(m[2]))

  it('có bản dịch cho mọi câu trong code', () => {
    expect(keys.size).toBeGreaterThan(500)
    expect([...keys].filter((k) => !(k in en))).toEqual([])
  })

  it('bản dịch giữ đủ các chỗ chèn {…} của câu gốc', () => {
    const slots = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join()
    const bad = [...keys]
      .filter((k) => k in en)
      .filter((k) => [en[k]].flat().some((v) => slots(v) !== slots(k)))
    expect(bad).toEqual([])
  })
})
