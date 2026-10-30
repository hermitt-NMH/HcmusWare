// Đo Lighthouse Mobile (mặc định của Lighthouse: Moto G Power, mạng 4G chậm, CPU chậm 4 lần) ở cả
// chế độ sáng và tối (#115, tiêu chí ≥ 85). Chế độ tối: Edge/Chrome chạy với --force-dark-mode nên
// prefers-color-scheme = dark, index.html bật class "dark" như máy người dùng để tối.
// Điểm Hiệu năng dưới ngưỡng thì đo thêm 2 lần, lấy trung vị (điểm dao động vài điểm giữa các lần).
//
// Cách chạy: npm run test:lighthouse                     (mặc định https://hcmusware.vercel.app)
//            node scripts/lighthouse.js <BASE_URL>
// Cần mạng để npx tải lighthouse lần đầu. Báo cáo JSON ghi vào ui-test-output/lighthouse/.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = (process.argv[2] || process.env.BASE_URL || 'https://hcmusware.vercel.app').replace(
  /\/$/,
  '',
)
const MIN = 85
const OUT = fileURLToPath(new URL('../ui-test-output/lighthouse/', import.meta.url))
const CHROME = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p))
mkdirSync(OUT, { recursive: true })

// Sản phẩm 1 (AMD Ryzen 5 7600, có từ dữ liệu gốc) và shop chính HcmusWare luôn có trên bản online.
const PAGES = [
  '/',
  '/san-pham',
  '/danh-muc/cpu',
  '/san-pham/1',
  '/thuong-hieu',
  '/shop/hcmusware',
  '/build-pc',
  '/goi-y-cau-hinh',
  '/gio-hang',
  '/dang-nhap',
]
const CATS = ['performance', 'accessibility', 'best-practices', 'seo']

const WIN = process.platform === 'win32'
// Đo dồn dập thì lớp chống bot của Vercel chặn IP (403, X-Vercel-Mitigated: challenge, cả với người dùng
// thật cùng mạng) → nghỉ giữa các lần đo, gặp lỗi tải trang thì nghỉ lâu hơn rồi mới đo lại
const PAUSE_MS = 15000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Một lần đo; trang tải lỗi (vd ERRORED_DOCUMENT_REQUEST, 403) thì đo lại, tối đa 3 lần
async function run(path, theme, n) {
  const file = `${OUT}${theme}${path.replace(/\W+/g, '_')}-${n}.json`
  const flags = ['--headless=new', theme === 'dark' ? '--force-dark-mode' : ''].join(' ').trim()
  let r
  for (let attempt = 1; attempt <= 3 && !r; attempt++) {
    await sleep(attempt === 1 ? PAUSE_MS : 90000)
    try {
      execFileSync(
        WIN ? 'npx.cmd' : 'npx',
        [
          '--yes',
          'lighthouse@12.8.2',
          BASE + path,
          `--only-categories=${CATS.join(',')}`,
          // Windows phải chạy qua shell (npx.cmd): bọc ngoặc kép, không thì shell tách
          // "--force-dark-mode" thành tham số riêng của Lighthouse và trình duyệt vẫn để sáng
          WIN ? `"--chrome-flags=${flags}"` : `--chrome-flags=${flags}`,
          '--output=json',
          `--output-path=${file}`,
          '--quiet',
        ],
        { stdio: 'ignore', shell: WIN, env: { ...process.env, CHROME_PATH: CHROME } },
      )
      const j = JSON.parse(readFileSync(file, 'utf8'))
      if (!j.runtimeError) r = j
    } catch {
      // đo lại
    }
  }
  if (!r) return null
  return {
    scores: Object.fromEntries(
      CATS.map((c) => [c, Math.round((r.categories[c]?.score ?? 0) * 100)]),
    ),
    lcp: r.audits['largest-contentful-paint']?.displayValue,
    cls: r.audits['cumulative-layout-shift']?.displayValue,
    shot: r.audits['final-screenshot']?.details?.data,
  }
}

const rows = []
const lightShots = new Map()
for (const theme of ['light', 'dark']) {
  for (const path of PAGES) {
    let runs = [await run(path, theme, 1)]
    if (runs[0] && runs[0].scores.performance < MIN)
      runs.push(await run(path, theme, 2), await run(path, theme, 3))
    runs = runs.filter(Boolean)
    if (!runs.length) {
      // Vercel chặn IP hoặc trang không tải được cả 3 lần: ghi lỗi, đo tiếp trang khác
      rows.push({ theme, path, ok: false })
      console.log(
        `LỖI  ${theme === 'dark' ? 'tối ' : 'sáng'} ${path.padEnd(16)} không đo được (trang tải lỗi 3 lần, xem JSON)`,
      )
      continue
    }
    runs.sort((a, b) => a.scores.performance - b.scores.performance)
    const mid = runs[Math.floor(runs.length / 2)]
    // Ảnh chụp cuối của bản tối trùng hệt bản sáng = trình duyệt không nhận cờ tối, lần đo vô nghĩa
    if (theme === 'light') lightShots.set(path, runs[0].shot)
    const sameAsLight = theme === 'dark' && runs.some((x) => x.shot === lightShots.get(path))
    const ok = CATS.every((c) => mid.scores[c] >= MIN) && !sameAsLight
    rows.push({ theme, path, ...mid, ok, n: runs.length })
    console.log(
      `${ok ? 'ĐẠT' : 'LỖI'}  ${theme === 'dark' ? 'tối ' : 'sáng'} ${path.padEnd(16)} ` +
        CATS.map((c) => `${c.slice(0, 4)} ${String(mid.scores[c]).padStart(3)}`).join('  ') +
        `  LCP ${mid.lcp}  CLS ${mid.cls}${runs.length > 1 ? `  (trung vị ${runs.length} lần)` : ''}` +
        (sameAsLight ? '  ẢNH GIỐNG BẢN SÁNG: chế độ tối không bật' : ''),
    )
  }
}
const failed = rows.filter((r) => !r.ok).length
console.log(
  `\nLighthouse Mobile ${BASE}: ${rows.length - failed}/${rows.length} trang×chế độ ≥ ${MIN} cả 4 mục`,
)
process.exit(failed ? 1 : 0)
