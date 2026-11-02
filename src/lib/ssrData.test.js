import { afterEach, describe, expect, it } from 'vitest'
import { createSsrStore, readSnapshot, snapshotScript } from './ssrData'

describe('createSsrStore', () => {
  it('ghi kết quả theo id, gọi hàm một lần cho cùng id + deps', async () => {
    const store = createSsrStore()
    let calls = 0
    const fn = async () => ++calls
    const a = store.load('«R1»', '[1]', fn)
    expect(store.load('«R1»', '[1]', fn)).toBe(a) // React gọi lại khi vẽ lại → cùng promise
    expect(await a).toEqual({ ok: true, data: 1 })
    expect(calls).toBe(1)
    expect(store.data).toEqual({ '«R1»': { k: '[1]', d: 1 } })
  })

  it('deps đổi thì gọi lại và ghi đè (vd. shop tải xong mới biết id)', async () => {
    const store = createSsrStore()
    await store.load('«R2»', '[0]', async () => [])
    await store.load('«R2»', '[5]', async () => ['sp'])
    expect(store.data['«R2»']).toEqual({ k: '[5]', d: ['sp'] })
  })

  it('gọi lỗi thì không ghi, trang để trạng thái đang tải', async () => {
    const store = createSsrStore()
    const r = await store.load('«R3»', '[]', async () => {
      throw new Error('mất mạng')
    })
    expect(r).toEqual({ ok: false })
    expect(store.data).toEqual({})
  })

  it('undefined đổi thành null để JSON giữ lại', async () => {
    const store = createSsrStore()
    await store.load('«R4»', '[]', async () => undefined)
    expect(store.data['«R4»']).toEqual({ k: '[]', d: null })
  })
})

describe('snapshotScript', () => {
  it('không để chuỗi trong dữ liệu đóng thẻ <script> sớm', () => {
    const store = createSsrStore()
    store.data.x = { k: '[]', d: 'a</script><script>alert(1)</script>' }
    store.lazy.add('ShopPage')
    const html = snapshotScript(store)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('window.__hcmLazy=["ShopPage"]')
  })
})

describe('readSnapshot', () => {
  afterEach(() => {
    delete globalThis.window
  })

  it('chỉ trả dữ liệu khi id và deps khớp', () => {
    globalThis.window = { __hcmData: { '«R1»': { k: '["cpu"]', d: [1] } } }
    expect(readSnapshot('«R1»', '["cpu"]')).toEqual({ k: '["cpu"]', d: [1] })
    expect(readSnapshot('«R1»', '["ram"]')).toBeNull()
    expect(readSnapshot('«R9»', '["cpu"]')).toBeNull()
  })

  it('không có window (lúc build) hoặc không có dữ liệu thì null', () => {
    expect(readSnapshot('«R1»', '[]')).toBeNull()
    globalThis.window = {}
    expect(readSnapshot('«R1»', '[]')).toBeNull()
  })
})
