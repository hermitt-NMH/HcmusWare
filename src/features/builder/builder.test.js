import { describe, expect, it } from 'vitest'
import {
  MAX_RAM_QTY,
  buildToCartEntries,
  buildTotalPrice,
  filterCandidates,
  groupBySlug,
  parseStoredBuild,
  resolveBuild,
  serializeBuild,
  stockProblems,
} from './builder'

const p = (id, slug, specs, extra = {}) => ({
  id,
  name: `${slug} ${id}`,
  price: 1000,
  stock: 5,
  specs,
  categories: { slug },
  ...extra,
})

const cpuAm5 = p(1, 'cpu', { socket: 'AM5', igpu: true })
const mbAm5 = p(10, 'mainboard', { socket: 'AM5', ram_type: 'DDR5', form_factor: 'Micro ATX' })
const mbLga = p(11, 'mainboard', { socket: 'LGA1700', ram_type: 'DDR4', form_factor: 'ATX' })
const mbUnknown = p(12, 'mainboard', { socket: null, ram_type: 'DDR5', form_factor: 'ATX' })
const ddr5 = p(20, 'ram', { ram_type: 'DDR5' })
const ddr4 = p(21, 'ram', { ram_type: 'DDR4' })
const caseMatx = p(30, 'case', { form_factors: ['Micro ATX', 'Mini ITX'] })
const caseAtx = p(31, 'case', { form_factors: ['ATX', 'Micro ATX', 'Mini ITX'] })
const caseItx = p(32, 'case', { form_factors: ['Mini ITX'] })
const coolerAll = p(40, 'cooler', { sockets: ['AM4', 'AM5', 'LGA1700'] })
const coolerIntel = p(41, 'cooler', { sockets: ['LGA1700'] })
const all = [
  cpuAm5,
  mbAm5,
  mbLga,
  mbUnknown,
  ddr5,
  ddr4,
  caseMatx,
  caseAtx,
  caseItx,
  coolerAll,
  coolerIntel,
]

const ids = (r) => r.items.map((x) => x.id)

describe('filterCandidates', () => {
  it('chưa chọn gì: hiện tất cả sản phẩm của danh mục, không có bộ lọc', () => {
    const r = filterCandidates('mainboard', all, {})
    expect(ids(r)).toEqual([10, 11, 12])
    expect(r.filters).toEqual([])
  })

  it('đã chọn CPU: mainboard cùng socket (R1), giữ mainboard chưa rõ socket', () => {
    const r = filterCandidates('mainboard', all, { cpu: cpuAm5 })
    expect(ids(r)).toEqual([10, 12])
    expect(r.filters).toEqual(['Socket AM5 (theo CPU)'])
  })

  it('đã chọn CPU: tản nhiệt hỗ trợ socket (R7)', () => {
    expect(ids(filterCandidates('cooler', all, { cpu: cpuAm5 }))).toEqual([40])
  })

  it('đã chọn mainboard: RAM đúng chuẩn (R2)', () => {
    expect(ids(filterCandidates('ram', all, { mainboard: mbLga }))).toEqual([21])
  })

  it('đã chọn mainboard: case vừa kích thước (R5)', () => {
    expect(ids(filterCandidates('case', all, { mainboard: mbAm5 }))).toEqual([30, 31])
    expect(ids(filterCandidates('case', all, { mainboard: mbLga }))).toEqual([31])
  })

  it('CPU không ảnh hưởng danh sách RAM/case (chỉ mainboard mới lọc)', () => {
    expect(ids(filterCandidates('ram', all, { cpu: cpuAm5 }))).toEqual([20, 21])
  })
})

describe('groupBySlug', () => {
  it('đủ 8 nhóm, kể cả nhóm rỗng', () => {
    const g = groupBySlug(all)
    expect(Object.keys(g)).toEqual([
      'cpu',
      'mainboard',
      'ram',
      'vga',
      'ssd',
      'psu',
      'case',
      'cooler',
    ])
    expect(g.vga).toEqual([])
    expect(g.mainboard).toHaveLength(3)
  })
})

describe('giá, tồn kho, giỏ hàng', () => {
  const build = { cpu: cpuAm5, mainboard: mbAm5, ram: ddr5 }

  it('tổng tiền nhân số kit RAM', () => {
    expect(buildTotalPrice(build, 1)).toBe(3000)
    expect(buildTotalPrice(build, 2)).toBe(4000)
  })

  it('bỏ qua linh kiện chưa có giá', () => {
    expect(buildTotalPrice({ cpu: { ...cpuAm5, price: null } })).toBe(0)
  })

  it('báo linh kiện không đủ hàng', () => {
    const lowRam = { ...ddr5, stock: 1 }
    expect(stockProblems({ ...build, ram: lowRam }, 1)).toEqual([])
    expect(stockProblems({ ...build, ram: lowRam }, 2)).toEqual(['ram'])
    expect(stockProblems({ cpu: { ...cpuAm5, stock: 0 } })).toEqual(['cpu'])
  })

  it('chuyển cấu hình thành danh sách thêm vào giỏ', () => {
    expect(buildToCartEntries(build, 2).map((e) => [e.product.id, e.qty])).toEqual([
      [1, 1],
      [10, 1],
      [20, 2],
    ])
  })
})

describe('lưu và mở lại cấu hình', () => {
  it('lưu id rồi đọc lại đúng', () => {
    const raw = serializeBuild({ cpu: 1, ram: 20 }, 2)
    expect(parseStoredBuild(raw)).toEqual({ ids: { cpu: 1, ram: 20 }, ramQty: 2 })
  })

  it('dữ liệu hỏng thì trả cấu hình rỗng', () => {
    expect(parseStoredBuild(null)).toEqual({ ids: {}, ramQty: 1 })
    expect(parseStoredBuild('xyz')).toEqual({ ids: {}, ramQty: 1 })
    expect(parseStoredBuild('[1,2]')).toEqual({ ids: {}, ramQty: 1 })
  })

  it('bỏ id sai kiểu, slug lạ; giới hạn ramQty', () => {
    const raw = JSON.stringify({ ids: { cpu: '1', ram: 20, gpu: 5 }, ramQty: 9 })
    expect(parseStoredBuild(raw)).toEqual({ ids: { ram: 20 }, ramQty: MAX_RAM_QTY })
  })

  it('resolveBuild bỏ id không còn hoặc sai danh mục', () => {
    const build = resolveBuild({ cpu: 1, mainboard: 20, ram: 999 }, all)
    expect(Object.keys(build)).toEqual(['cpu'])
  })
})
