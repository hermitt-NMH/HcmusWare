import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefetchPlan, startPrefetch, takePrefetched } from './prefetch'

const URL_ = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ghi lại request supabase-js thật sự gửi khi gọi các hàm trong api.js
async function capture(run) {
  const calls = []
  vi.stubGlobal('fetch', async (input, init = {}) => {
    calls.push(
      `${init.method || 'GET'} ${String(input)} ${typeof init.body === 'string' ? init.body : ''}`,
    )
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  })
  await run(await import('./api'))
  vi.unstubAllGlobals()
  return calls
}
const planKeys = (path) => prefetchPlan(path).map(([m, p, b]) => `${m} ${URL_}${p} ${b || ''}`)

afterEach(() => {
  vi.unstubAllGlobals()
  delete globalThis.__hcmPrefetch
})

describe('prefetchPlan khớp từng ký tự với request của lib/api.js', () => {
  it.each([
    ['/', (api) => Promise.all([api.getCategories(), api.getProducts({ limit: 8 })])],
    ['/san-pham', (api) => Promise.all([api.getCategories(), api.getProducts({})])],
    [
      '/danh-muc/cpu',
      (api) =>
        Promise.all([
          api.getCategories(),
          api.getCategoryBySlug('cpu'),
          api.getProducts({ categorySlug: 'cpu' }),
        ]),
    ],
    ['/san-pham/1', (api) => Promise.all([api.getCategories(), api.getProductById('1')])],
    [
      '/shop/hcmusware',
      (api) => Promise.all([api.getCategories(), api.getShopBySlug('hcmusware')]),
    ],
    ['/thuong-hieu', (api) => Promise.all([api.getCategories(), api.getBrandList()])],
  ])('%s', async (path, run) => {
    expect(planKeys(path).sort()).toEqual((await capture(run)).sort())
  })

  it('trang khác chỉ gọi sẵn danh mục cho Header', () => {
    expect(prefetchPlan('/gio-hang')).toHaveLength(1)
    expect(prefetchPlan('/san-pham/abc')).toHaveLength(1)
    expect(prefetchPlan('/admin/san-pham')).toHaveLength(1)
  })
})

function fakeWindow({ pathname = '/san-pham', storage = {} } = {}) {
  const fetch = vi.fn(async () => new Response('[{"id":1}]', { status: 200 }))
  return {
    fetch,
    location: { pathname },
    localStorage: { length: Object.keys(storage).length, key: (i) => Object.keys(storage)[i] },
    setTimeout: () => {},
  }
}

describe('startPrefetch', () => {
  it('chưa đăng nhập: gọi sẵn bằng khóa anon', () => {
    const win = fakeWindow()
    startPrefetch(win, URL_, ANON)
    expect(win.fetch).toHaveBeenCalledTimes(2)
    expect(win.fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${ANON}`)
    expect(Object.keys(win.__hcmPrefetch)).toEqual(planKeys('/san-pham'))
  })

  it('đã đăng nhập: không gọi sẵn gì (RLS theo từng người)', () => {
    const win = fakeWindow({ storage: { 'sb-abc-auth-token': '{}' } })
    startPrefetch(win, URL_, ANON)
    expect(win.fetch).not.toHaveBeenCalled()
    expect(win.__hcmPrefetch).toBeUndefined()
  })

  it('localStorage bị chặn: bỏ qua, không lỗi', () => {
    const win = fakeWindow()
    Object.defineProperty(win, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(() => startPrefetch(win, URL_, ANON)).not.toThrow()
    expect(win.fetch).not.toHaveBeenCalled()
  })
})

describe('takePrefetched', () => {
  const key = planKeys('/san-pham')[1]
  const [, input] = key.split(' ')
  const anonInit = { method: 'GET', headers: { Authorization: `Bearer ${ANON}` } }

  it('khớp: trả kết quả gọi sẵn, chỉ dùng 1 lần', async () => {
    const ready = new Response('sẵn')
    globalThis.__hcmPrefetch = { [key]: Promise.resolve(ready) }
    const real = vi.fn(async () => new Response('thật'))
    expect(await takePrefetched(input, anonInit, ANON, real)).toBe(ready)
    expect(await (await takePrefetched(input, anonInit, ANON, real)).text()).toBe('thật')
    expect(real).toHaveBeenCalledTimes(1)
  })

  it('đã đăng nhập (token khác anon): luôn gọi thật', async () => {
    globalThis.__hcmPrefetch = { [key]: Promise.resolve(new Response('sẵn')) }
    const real = vi.fn(async () => new Response('thật'))
    await takePrefetched(
      input,
      { method: 'GET', headers: { Authorization: 'Bearer user-jwt' } },
      ANON,
      real,
    )
    expect(real).toHaveBeenCalledTimes(1)
  })

  it('gọi sẵn bị lỗi mạng hoặc lỗi HTTP: gọi lại thật', async () => {
    const real = vi.fn(async () => new Response('thật'))
    globalThis.__hcmPrefetch = { [key]: Promise.resolve(null) }
    expect(await (await takePrefetched(input, anonInit, ANON, real)).text()).toBe('thật')
    globalThis.__hcmPrefetch = { [key]: Promise.resolve(new Response('', { status: 503 })) }
    expect(await (await takePrefetched(input, anonInit, ANON, real)).text()).toBe('thật')
  })
})
