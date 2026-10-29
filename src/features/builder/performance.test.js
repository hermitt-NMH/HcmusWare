import { describe, expect, it } from 'vitest'
import {
  cpuKey,
  detectBottleneck,
  estimateGameFps,
  estimatePerformance,
  fpsLevel,
  partScore,
} from './performance'
import { PERF_DATA } from './perfData'

// Bảng GIẢ LẬP để kiểm tra công thức – số tròn cho dễ tính tay, không phải số đo thật.
const data = {
  reference: { cpu: 'Ryzen 5 7600', gpu: 'RTX 4060' },
  sources: [{ id: 's1', title: 'Nguồn thử', url: 'https://example.com' }],
  cpus: { 'Ryzen 5 7600': 100, 'Ryzen 3 3200G': 50, 'Core i9-13900F': 130 },
  gpus: { 'RTX 4060': 100, 'RTX 5080': 240, 'RX 6500 XT': 45 },
  games: [
    {
      id: 'a',
      name: 'Game A',
      source: 's1',
      fps: { '1080p': 100, '1440p': 70, '4k': 40 },
      cpuFps: 150,
    },
    { id: 'b', name: 'Game B', source: 's1', fps: { '1080p': 200, '1440p': 140 }, cpuFps: 220 },
  ],
}
const cpu = (name) => ({ name, specs: { cores: 6 }, categories: { slug: 'cpu' } })
const vga = (chipset) => ({
  name: `VGA ${chipset}`,
  specs: { chipset },
  categories: { slug: 'vga' },
})

describe('cpuKey / partScore', () => {
  it('bỏ tên hãng ở CPU, bỏ GeForce/Radeon và dung lượng ở VGA', () => {
    expect(cpuKey('AMD Ryzen 5 7600')).toBe('Ryzen 5 7600')
    expect(cpuKey('Intel  Core i9-13900F')).toBe('Core i9-13900F')
    expect(partScore(data, vga('GeForce RTX 5080 16GB'), 'vga')).toBe(240)
    expect(partScore(data, cpu('Intel Core i9-13900F'), 'cpu')).toBe(130)
  })
  it('linh kiện chưa có trong bảng → null, không đoán', () => {
    expect(partScore(data, cpu('AMD Ryzen 9 9950X3D'), 'cpu')).toBeNull()
    expect(partScore(data, null, 'cpu')).toBeNull()
  })
})

describe('estimateGameFps', () => {
  const game = data.games[0]
  it('cấu hình tham chiếu: đúng FPS đo được, VGA giữ chân', () => {
    expect(estimateGameFps(game, 100, 100, '1080p')).toMatchObject({ fps: 100, limitedBy: 'gpu' })
  })
  it('VGA mạnh gấp 2,4 lần với CPU tham chiếu: bị CPU chặn ở 150', () => {
    expect(estimateGameFps(game, 100, 240, '1080p')).toMatchObject({ fps: 150, limitedBy: 'cpu' })
    // 4K: 40 × 2,4 = 96 < 150 → lại do VGA
    expect(estimateGameFps(game, 100, 240, '4k')).toMatchObject({ fps: 96, limitedBy: 'gpu' })
  })
  it('thiếu số liệu độ phân giải → null', () => {
    expect(estimateGameFps(data.games[1], 100, 100, '4k')).toBeNull()
  })
})

describe('fpsLevel', () => {
  it('≥ 60 mượt, 30–59 chơi được, < 30 giật', () => {
    expect([fpsLevel(60).key, fpsLevel(59).key, fpsLevel(29).key]).toEqual([
      'smooth',
      'playable',
      'low',
    ])
  })
})

describe('detectBottleneck', () => {
  it('CPU chặn dưới 85% sức VGA → cảnh báo CPU kèm % mất', () => {
    const b = detectBottleneck([
      { cpuLimit: 60, gpuLimit: 100 },
      { cpuLimit: 80, gpuLimit: 100 },
    ])
    expect(b).toMatchObject({ part: 'cpu', percent: 30 })
  })
  it('VGA dùng chưa tới 50% sức CPU → báo VGA yếu', () => {
    expect(detectBottleneck([{ cpuLimit: 300, gpuLimit: 100 }])).toMatchObject({ part: 'gpu' })
  })
  it('cân bằng hoặc không có dữ liệu → null', () => {
    expect(detectBottleneck([{ cpuLimit: 110, gpuLimit: 100 }])).toBeNull()
    expect(detectBottleneck([null])).toBeNull()
  })
})

describe('estimatePerformance', () => {
  it('bảng chưa có game → no-data (BA chưa nhập số liệu)', () => {
    expect(estimatePerformance({ cpu: cpu('x'), vga: vga('y') }, { games: [] }).status).toBe(
      'no-data',
    )
  })
  it('chưa chọn VGA → need-parts', () => {
    expect(estimatePerformance({ cpu: cpu('AMD Ryzen 5 7600') }, data)).toEqual({
      status: 'need-parts',
      missing: ['vga'],
    })
  })
  it('linh kiện không có trong bảng → unknown-part kèm tên', () => {
    const r = estimatePerformance({ cpu: cpu('AMD Ryzen 9 9950X3D'), vga: vga('RTX 4060') }, data)
    expect(r).toEqual({ status: 'unknown-part', unknown: ['AMD Ryzen 9 9950X3D'] })
  })
  it('CPU yếu + VGA mạnh: FPS từng game, cảnh báo CPU nghẽn, kèm nguồn', () => {
    const r = estimatePerformance(
      { cpu: cpu('AMD Ryzen 3 3200G'), vga: vga('GeForce RTX 5080 16GB') },
      data,
    )
    expect(r.status).toBe('ok')
    // Game A 1080p: VGA 240, CPU 75 → 75
    expect(r.games[0].results['1080p'].fps).toBe(75)
    expect(r.games[1].results['4k']).toBeNull()
    expect(r.bottleneck.part).toBe('cpu')
    expect(r.sources).toHaveLength(1)
  })
  it('cấu hình tham chiếu: không cảnh báo nghẽn', () => {
    const r = estimatePerformance({ cpu: cpu('AMD Ryzen 5 7600'), vga: vga('RTX 4060') }, data)
    expect(r.bottleneck).toBeNull()
  })
})

// Kiểm tra bảng thật của BA khi đã nhập (bảng trống thì bỏ qua).
describe.skipIf(!PERF_DATA.games.length)('perfData.js (số liệu BA)', () => {
  const sourceIds = new Set(PERF_DATA.sources.map((s) => s.id))
  it('có 10 game, game nào cũng có nguồn hợp lệ và đủ FPS 3 độ phân giải', () => {
    expect(PERF_DATA.games).toHaveLength(10)
    for (const g of PERF_DATA.games) {
      expect(sourceIds.has(g.source), g.name).toBe(true)
      expect(sourceIds.has(g.cpuSource), `${g.name} cpuSource`).toBe(true)
      expect(g.cpuFps, g.name).toBeGreaterThan(0)
      for (const res of ['1080p', '1440p', '4k'])
        expect(g.fps[res], `${g.name} ${res}`).toBeGreaterThan(0)
    }
  })
  it('linh kiện tham chiếu có điểm 100', () => {
    expect(PERF_DATA.cpus[PERF_DATA.reference.cpu]).toBe(100)
    expect(PERF_DATA.gpus[PERF_DATA.reference.gpu]).toBe(100)
  })
})
