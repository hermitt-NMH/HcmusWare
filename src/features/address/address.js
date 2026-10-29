// Sổ địa chỉ và gợi ý đơn vị hành chính (F17) dạng HÀM THUẦN để dễ viết unit test.
// Dữ liệu: public/data/don-vi-hanh-chinh.json – mô hình 2 cấp sau 01/07/2025 (Tỉnh/Thành → Phường/Xã),
// mỗi đơn vị là [mã, tên đầy đủ]. Không có cấp Quận/Huyện.

export const MAX_ADDRESSES = 10
export const MAX_SUGGESTIONS = 8

// Bỏ dấu, đ → d, chữ thường, gộp khoảng trắng: "Thủ  Đức" → "thu duc", "Khánh Hoà" = "Khánh Hòa".
export function normalizeVi(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Tiền tố loại đơn vị (đã bỏ dấu), bỏ đi khi so khớp nhưng vẫn hiện trong gợi ý.
const PREFIX_RE = /^(tinh|thanh pho|phuong|xa|dac khu) /

// Tên dùng để so khớp: "Thành phố Hồ Chí Minh" → "ho chi minh".
export function matchKey(fullName) {
  return normalizeVi(fullName).replace(PREFIX_RE, '')
}

// Tên đã bỏ tiền tố nhưng còn dấu, để xếp A–Z theo tiếng Việt.
const PREFIX_VI_RE = /^(Tỉnh|Thành phố|Phường|Xã|Đặc khu) /

// Chuẩn hóa danh sách một lần cho mỗi mảng (tỉnh, hoặc phường/xã của một tỉnh).
const indexCache = new WeakMap()
function indexOf(units) {
  let index = indexCache.get(units)
  if (!index) {
    index = units.map(([code, name]) => ({
      code,
      name,
      key: matchKey(name),
      sortName: name.replace(PREFIX_VI_RE, ''),
    }))
    indexCache.set(units, index)
  }
  return index
}

// Gợi ý theo chữ đang gõ. units: [[mã, tên], ...]. Trả tối đa `limit` đơn vị dạng [mã, tên].
// Thứ tự: khớp từ đầu tên → khớp đầu một từ → chứa chuỗi; cùng nhóm thì A–Z.
// Gõ cả tiền tố ("phuong ben thanh") vẫn ra như gõ "ben thanh".
export function suggestUnits(units, query, limit = MAX_SUGGESTIONS) {
  const raw = normalizeVi(query)
  if (!raw || !units?.length) return []
  const q = raw.replace(PREFIX_RE, '') || raw
  const ranked = []
  for (const u of indexOf(units)) {
    let rank
    if (u.key.startsWith(q)) rank = 0
    else if (` ${u.key}`.includes(` ${q}`)) rank = 1
    else if (u.key.includes(q)) rank = 2
    else continue
    ranked.push({ u, rank })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.u.sortName.localeCompare(b.u.sortName, 'vi'))
  return ranked.slice(0, limit).map(({ u }) => [u.code, u.name])
}

// Dữ liệu file JSON → danh sách tỉnh [[mã, tên]] và phường/xã theo mã tỉnh.
export function provincesOf(data) {
  return (data?.provinces ?? []).map(([code, name]) => [code, name])
}

export function wardsOf(data, provinceCode) {
  return (data?.provinces ?? []).find(([code]) => code === provinceCode)?.[2] ?? []
}

// Số điện thoại trong sổ địa chỉ: 10 số bắt đầu bằng 0. Cho gõ "090 123 4567", "+84 90..." rồi chuẩn hóa.
export function normalizePhone(phone) {
  const p = String(phone ?? '').replace(/[\s.-]/g, '')
  return p.startsWith('+84') ? '0' + p.slice(3) : p
}

// Form sổ địa chỉ / địa chỉ mới ở trang thanh toán:
// { recipient_name, phone, province: [mã, tên] | null, ward: [mã, tên] | null, street }
// Trả { data, errors } – data đúng tên cột bảng addresses; errors rỗng là hợp lệ.
// Giới hạn khớp check constraint trong DB (migration 20261207000000).
export function validateAddress(form) {
  const data = {
    recipient_name: String(form.recipient_name ?? '').trim(),
    phone: normalizePhone(form.phone),
    province_code: form.province?.[0] ?? null,
    province_name: form.province?.[1] ?? null,
    ward_code: form.ward?.[0] ?? null,
    ward_name: form.ward?.[1] ?? null,
    street: String(form.street ?? '').trim(),
  }
  const errors = {}
  if (!data.recipient_name) errors.recipient_name = 'Vui lòng nhập họ tên người nhận.'
  else if (data.recipient_name.length < 2 || data.recipient_name.length > 60)
    errors.recipient_name = 'Họ tên người nhận từ 2 đến 60 ký tự.'
  if (!data.phone) errors.phone = 'Vui lòng nhập số điện thoại.'
  else if (!/^0\d{9}$/.test(data.phone))
    errors.phone = 'Số điện thoại không hợp lệ (vd 0901234567).'
  if (!data.province_code) errors.province = 'Chọn Tỉnh/Thành trong danh sách gợi ý.'
  if (!data.ward_code) errors.ward = 'Chọn Phường/Xã trong danh sách gợi ý.'
  if (!data.street) errors.street = 'Vui lòng nhập số nhà và tên đường.'
  else if (data.street.length > 200) errors.street = 'Số nhà và đường tối đa 200 ký tự.'
  return { data, errors }
}

// Dòng addresses → form (sửa địa chỉ).
export function addressToForm(a) {
  return {
    recipient_name: a?.recipient_name ?? '',
    phone: a?.phone ?? '',
    province: a?.province_code ? [a.province_code, a.province_name] : null,
    ward: a?.ward_code ? [a.ward_code, a.ward_name] : null,
    street: a?.street ?? '',
  }
}

// Địa chỉ một dòng, lưu vào đơn hàng (orders.shipping_address) và hiện trong sổ.
export function formatAddress(a) {
  return [a.street, a.ward_name, a.province_name].filter(Boolean).join(', ')
}

// Địa chỉ điền sẵn ở trang thanh toán: địa chỉ mặc định, không có thì địa chỉ đầu tiên.
export function defaultAddress(addresses) {
  return addresses?.find((a) => a.is_default) ?? addresses?.[0] ?? null
}
