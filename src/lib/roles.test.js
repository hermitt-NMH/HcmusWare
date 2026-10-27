import { describe, expect, it } from 'vitest'
import { AREA_ROLES, ROLE_VALUES, canAccess, roleLabel, roleShortcut } from './roles'

describe('canAccess – vai trò nào vào được khu vực nào', () => {
  it('khách hàng chỉ vào trang tài khoản', () => {
    expect(canAccess('customer', AREA_ROLES.account)).toBe(true)
    expect(canAccess('customer', AREA_ROLES.seller)).toBe(false)
    expect(canAccess('customer', AREA_ROLES.admin)).toBe(false)
  })

  it('người bán vào tài khoản và kênh người bán, không vào admin', () => {
    expect(canAccess('seller', AREA_ROLES.account)).toBe(true)
    expect(canAccess('seller', AREA_ROLES.seller)).toBe(true)
    expect(canAccess('seller', AREA_ROLES.admin)).toBe(false)
  })

  it('admin vào admin nhưng không vào kênh người bán (không có shop để quản lý)', () => {
    expect(canAccess('admin', AREA_ROLES.admin)).toBe(true)
    expect(canAccess('admin', AREA_ROLES.account)).toBe(true)
    expect(canAccess('admin', AREA_ROLES.seller)).toBe(false)
  })

  it('chưa có vai trò (chưa đăng nhập / hồ sơ chưa tải) hoặc vai trò lạ thì bị chặn', () => {
    for (const area of Object.values(AREA_ROLES)) {
      expect(canAccess(null, area)).toBe(false)
      expect(canAccess(undefined, area)).toBe(false)
      expect(canAccess('', area)).toBe(false)
      expect(canAccess('root', area)).toBe(false)
    }
  })
})

describe('roleLabel, roleShortcut', () => {
  it('có nhãn tiếng Việt cho đủ 3 vai trò', () => {
    expect(ROLE_VALUES).toEqual(['customer', 'seller', 'admin'])
    expect(ROLE_VALUES.map(roleLabel)).toEqual(['Khách hàng', 'Người bán', 'Quản trị viên'])
    expect(roleLabel('root')).toBe('Không rõ')
  })

  it('lối tắt chỉ có cho người bán và admin', () => {
    expect(roleShortcut('admin')).toEqual({ to: '/admin', label: 'Quản trị' })
    expect(roleShortcut('seller')).toEqual({ to: '/kenh-nguoi-ban', label: 'Kênh người bán' })
    expect(roleShortcut('customer')).toBeNull()
    expect(roleShortcut(null)).toBeNull()
  })
})
