// Ngôn ngữ giao diện tiếng Việt / tiếng Anh (làm thêm theo phản hồi khách hàng).
// Cách dùng: t('Câu tiếng Việt') – chính câu tiếng Việt là khóa, src/i18n/en.js dịch sang tiếng Anh;
// câu chưa có trong từ điển thì hiện nguyên tiếng Việt. Chèn giá trị: t('Còn {n} sản phẩm', { n }).
// - Gọi t() lúc render (trong component / hàm được component gọi), không gọi ở cấp module:
//   hằng số tính lúc import sẽ đứng yên ở ngôn ngữ cũ. Nhãn đặt trong hằng số thì bọc tKey() để
//   kiểm thử thấy khóa, rồi t(nhãn) ở chỗ hiện ra.
// - Từ điển tiếng Anh tải sau (dynamic import) nên bản tiếng Việt không nặng thêm.
// - Trang vẽ sẵn lúc build (#115) là tiếng Việt; chọn tiếng Anh thì main.jsx vẽ lại từ đầu thay vì hydrate.
// - Dữ liệu trong DB (tên sản phẩm, mô tả, đánh giá) giữ nguyên, không dịch.

import { Fragment, createElement } from 'react'

export const LANG_KEY = 'hcmusware.lang'
export const LANGS = ['vi', 'en']

let lang = 'vi'
let dict = null // từ điển tiếng Anh, null khi chưa tải
const listeners = new Set()

// localStorage có thể bị chặn (chế độ riêng tư) → coi như tiếng Việt.
export function readStoredLang() {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

export function currentLang() {
  return lang
}

export function subscribeLang(onChange) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

// Locale cho ngày giờ (cùng dạng 09/11/2026 ở cả hai ngôn ngữ). Tiền vẫn định dạng kiểu Việt Nam (₫).
export function dateLocale() {
  return lang === 'en' ? 'en-GB' : 'vi-VN'
}

const loadDict = async () => (dict ??= (await import('../i18n/en.js')).default)

function apply(next) {
  lang = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((fn) => fn())
}

// Đổi ngôn ngữ (nút trên Header): tải từ điển nếu cần, áp dụng và nhớ lại.
export async function setLang(next) {
  if (next === 'en') await loadDict()
  try {
    localStorage.setItem(LANG_KEY, next)
  } catch {
    // không lưu được thì chỉ đổi trong lần mở trang này
  }
  apply(next)
}

// Gọi 1 lần lúc khởi động (main.jsx) trước khi vẽ. Trả về ngôn ngữ đã chọn.
// Đổi ở tab khác thì tab này đổi theo.
export async function initLang() {
  const stored = readStoredLang()
  if (stored === 'en') await loadDict().catch(() => null)
  apply(dict ? stored : 'vi')
  window.addEventListener('storage', (e) => {
    if (e.key === LANG_KEY) setLang(readStoredLang()).catch(() => {})
  })
  return lang
}

// Dùng cho kiểm thử: nạp sẵn từ điển và chọn ngôn ngữ, không đụng localStorage.
export function __setForTest(next, d) {
  dict = d ?? dict
  lang = next
}

// Bản dịch dạng mảng [số ít, số nhiều] chọn theo vars.n: '{n} sản phẩm' → ['{n} product', '{n} products'].
export function t(text, vars) {
  if (typeof text !== 'string') return text // nhãn lấy từ dữ liệu có thể là số / null
  let s = lang === 'en' ? (dict?.[text] ?? text) : text
  if (Array.isArray(s)) s = Number(vars?.n) === 1 ? s[0] : s[1]
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
  return s
}

// Như t() nhưng giá trị chèn có thể là phần tử React (chữ đậm, link) mà câu vẫn liền một khóa:
// tJsx('Mã đơn của bạn là {id}.', { id: <strong>#12</strong> })
export function tJsx(text, vars) {
  const parts = t(text).split(/\{(\w+)\}/)
  return createElement(Fragment, null, ...parts.map((p, i) => (i % 2 ? (vars[p] ?? `{${p}}`) : p)))
}

// Đánh dấu nhãn trong hằng số là khóa cần dịch (không đổi gì); dịch bằng t() lúc hiện.
export const tKey = (text) => text
