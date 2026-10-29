import { describe, expect, it } from 'vitest'
import data from '../../../public/data/don-vi-hanh-chinh.json'
import {
  defaultAddress,
  formatAddress,
  matchKey,
  normalizePhone,
  normalizeVi,
  provincesOf,
  suggestUnits,
  validateAddress,
  wardsOf,
} from './address'

const provinces = provincesOf(data)
const provinceCode = (name) => provinces.find(([, n]) => n === name)[0]
const wardsIn = (provinceName) => wardsOf(data, provinceCode(provinceName))
const first = (units, q) => suggestUnits(units, q)[0]?.[1]

describe('normalizeVi / matchKey', () => {
  it('bỏ dấu, đ = d, không phân biệt hoa thường, gộp khoảng trắng', () => {
    expect(normalizeVi('  Thủ   ĐỨC ')).toBe('thu duc')
    expect(normalizeVi('Đắk Lắk')).toBe('dak lak')
    expect(normalizeVi('Phường Ngọc Hà')).toBe('phuong ngoc ha')
  })
  it('dấu kiểu cũ và mới như nhau: òa = oà', () => {
    expect(normalizeVi('Khánh Hoà')).toBe(normalizeVi('Khánh Hòa'))
    expect(normalizeVi('Thanh Hoá')).toBe(normalizeVi('Thanh Hóa'))
  })
  it('bỏ tiền tố loại đơn vị', () => {
    expect(matchKey('Thành phố Hồ Chí Minh')).toBe('ho chi minh')
    expect(matchKey('Tỉnh Khánh Hoà')).toBe('khanh hoa')
    expect(matchKey('Đặc khu Côn Đảo')).toBe('con dao')
    expect(matchKey('Xã Bình Chánh')).toBe('binh chanh')
  })
})

// Bảng ví dụ trong docs/user-story-g2.md, US-17.2
describe('suggestUnits – Tỉnh/Thành', () => {
  it.each([
    ['ho chi', 'Thành phố Hồ Chí Minh'],
    ['KHANH HOA', 'Tỉnh Khánh Hoà'],
    ['da nang', 'Thành phố Đà Nẵng'],
    ['dak lak', 'Tỉnh Đắk Lắk'],
  ])('gõ "%s" → %s', (q, expected) => {
    expect(first(provinces, q)).toBe(expected)
  })

  it('dữ liệu đủ 34 tỉnh/thành', () => {
    expect(provinces).toHaveLength(34)
  })
})

describe('suggestUnits – Phường/Xã', () => {
  it.each([
    ['Thành phố Hồ Chí Minh', 'thu duc', 'Phường Thủ Đức'],
    ['Thành phố Hồ Chí Minh', 'con dao', 'Đặc khu Côn Đảo'],
    ['Thành phố Hồ Chí Minh', 'ben th', 'Phường Bến Thành'],
    ['Thành phố Hà Nội', 'cau giay', 'Phường Cầu Giấy'],
  ])('%s, gõ "%s" → %s', (province, q, expected) => {
    expect(first(wardsIn(province), q)).toBe(expected)
  })

  it('chỉ gợi ý trong tỉnh đã chọn: Hà Nội gõ "thu duc" không có gợi ý', () => {
    expect(suggestUnits(wardsIn('Thành phố Hà Nội'), 'thu duc')).toEqual([])
  })

  it('gõ cả tiền tố vẫn ra: "phuong ben thanh"', () => {
    expect(first(wardsIn('Thành phố Hồ Chí Minh'), 'phuong ben thanh')).toBe('Phường Bến Thành')
  })

  it('tối đa 8 gợi ý; chuỗi rỗng / chỉ khoảng trắng thì không gợi ý', () => {
    const hcm = wardsIn('Thành phố Hồ Chí Minh')
    expect(suggestUnits(hcm, 'a')).toHaveLength(8)
    expect(suggestUnits(hcm, '   ')).toEqual([])
  })
})

describe('suggestUnits – thứ tự xếp hạng', () => {
  const units = [
    ['1', 'Xã Tân An'], // khớp đầu từ thứ hai
    ['2', 'Phường An Lạc'], // khớp từ đầu tên
    ['3', 'Xã Thanh'], // chứa "an" giữa từ
    ['4', 'Phường An Khánh'], // khớp từ đầu tên (A–Z đứng trước An Lạc)
    ['5', 'Xã Bình Minh'], // không khớp
  ]
  it('khớp đầu tên → khớp đầu một từ → chứa chuỗi; cùng nhóm xếp A–Z', () => {
    expect(suggestUnits(units, 'an').map(([c]) => c)).toEqual(['4', '2', '1', '3'])
  })
})

describe('validateAddress', () => {
  const ok = {
    recipient_name: ' Nguyễn Văn An ',
    phone: '+84 90 123 4567',
    province: ['79', 'Thành phố Hồ Chí Minh'],
    ward: ['26734', 'Phường Bến Thành'],
    street: ' 227 Nguyễn Văn Cừ ',
  }
  it('hợp lệ: chuẩn hóa tên, số điện thoại, tách mã và tên', () => {
    const { data, errors } = validateAddress(ok)
    expect(errors).toEqual({})
    expect(data).toEqual({
      recipient_name: 'Nguyễn Văn An',
      phone: '0901234567',
      province_code: '79',
      province_name: 'Thành phố Hồ Chí Minh',
      ward_code: '26734',
      ward_name: 'Phường Bến Thành',
      street: '227 Nguyễn Văn Cừ',
    })
  })
  it('chưa chọn từ gợi ý thì báo lỗi Tỉnh/Thành và Phường/Xã', () => {
    const { errors } = validateAddress({ ...ok, province: null, ward: null })
    expect(errors.province).toBe('Chọn Tỉnh/Thành trong danh sách gợi ý.')
    expect(errors.ward).toBe('Chọn Phường/Xã trong danh sách gợi ý.')
  })
  it('tên 1 ký tự, số điện thoại sai, đường trống / quá dài', () => {
    expect(validateAddress({ ...ok, recipient_name: 'A' }).errors.recipient_name).toBeTruthy()
    expect(
      validateAddress({ ...ok, recipient_name: 'A'.repeat(61) }).errors.recipient_name,
    ).toBeTruthy()
    expect(validateAddress({ ...ok, phone: '12345' }).errors.phone).toBeTruthy()
    expect(validateAddress({ ...ok, phone: '1901234567' }).errors.phone).toBeTruthy()
    expect(validateAddress({ ...ok, street: '  ' }).errors.street).toBeTruthy()
    expect(validateAddress({ ...ok, street: 'x'.repeat(201) }).errors.street).toBeTruthy()
  })
})

describe('normalizePhone, formatAddress, defaultAddress', () => {
  it('normalizePhone', () => {
    expect(normalizePhone('090.123-4567')).toBe('0901234567')
    expect(normalizePhone('+84901234567')).toBe('0901234567')
  })
  it('formatAddress: số nhà, phường/xã, tỉnh/thành – không có quận/huyện', () => {
    expect(
      formatAddress({
        street: '227 Nguyễn Văn Cừ',
        ward_name: 'Phường Chợ Quán',
        province_name: 'Thành phố Hồ Chí Minh',
      }),
    ).toBe('227 Nguyễn Văn Cừ, Phường Chợ Quán, Thành phố Hồ Chí Minh')
  })
  it('defaultAddress: địa chỉ mặc định, không có thì địa chỉ đầu; sổ rỗng → null', () => {
    expect(defaultAddress([{ id: 1 }, { id: 2, is_default: true }]).id).toBe(2)
    expect(defaultAddress([{ id: 1 }]).id).toBe(1)
    expect(defaultAddress([])).toBeNull()
  })
})
