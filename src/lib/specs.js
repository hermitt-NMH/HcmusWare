// Nhãn tiếng Việt + đơn vị cho từng thông số trong products.specs, theo từng danh mục.
// Dùng chung cho bảng thông số (trang chi tiết) và bộ lọc (trang danh mục).
// filter: true → hiện thành nhóm ô chọn trong bộ lọc của danh mục đó.
export const SPEC_FIELDS = {
  cpu: [
    { key: 'socket', label: 'Socket', filter: true },
    { key: 'cores', label: 'Số nhân', filter: true },
    { key: 'threads', label: 'Số luồng' },
    { key: 'base_clock_ghz', label: 'Xung cơ bản', unit: 'GHz' },
    { key: 'boost_clock_ghz', label: 'Xung tối đa', unit: 'GHz' },
    { key: 'tdp_w', label: 'Công suất (TDP)', unit: 'W' },
    { key: 'igpu', label: 'Nhân đồ họa tích hợp', filter: true },
  ],
  mainboard: [
    { key: 'socket', label: 'Socket', filter: true },
    { key: 'chipset', label: 'Chipset' },
    { key: 'form_factor', label: 'Kích thước', filter: true },
    { key: 'ram_type', label: 'Chuẩn RAM', filter: true },
    { key: 'ram_slots', label: 'Số khe RAM' },
    { key: 'max_ram_gb', label: 'RAM tối đa', unit: 'GB' },
    { key: 'm2_slots', label: 'Số khe M.2' },
  ],
  ram: [
    { key: 'ram_type', label: 'Chuẩn RAM', filter: true },
    { key: 'capacity_gb', label: 'Dung lượng', unit: 'GB', filter: true },
    { key: 'modules', label: 'Số thanh' },
    { key: 'speed_mhz', label: 'Bus', unit: 'MHz' },
  ],
  vga: [
    { key: 'chipset', label: 'Chipset' },
    { key: 'vram_gb', label: 'Bộ nhớ (VRAM)', unit: 'GB', filter: true },
    { key: 'length_mm', label: 'Chiều dài', unit: 'mm' },
    { key: 'tdp_w', label: 'Công suất (TDP)', unit: 'W' },
    { key: 'recommended_psu_w', label: 'Nguồn khuyến nghị', unit: 'W' },
  ],
  ssd: [
    { key: 'capacity_gb', label: 'Dung lượng', unit: 'GB', filter: true },
    { key: 'interface', label: 'Giao tiếp', filter: true },
    { key: 'form_factor', label: 'Kích thước' },
  ],
  psu: [
    { key: 'wattage_w', label: 'Công suất', unit: 'W', filter: true },
    { key: 'efficiency', label: 'Chuẩn hiệu suất', filter: true },
    { key: 'form_factor', label: 'Kích thước' },
    { key: 'modular', label: 'Dây rời (modular)' },
  ],
  case: [
    { key: 'case_type', label: 'Loại vỏ', filter: true },
    { key: 'form_factors', label: 'Mainboard hỗ trợ' },
    { key: 'max_gpu_length_mm', label: 'VGA dài tối đa', unit: 'mm' },
    { key: 'max_cooler_height_mm', label: 'Tản khí cao tối đa', unit: 'mm' },
  ],
  cooler: [
    { key: 'cooler_type', label: 'Loại tản', filter: true },
    { key: 'sockets', label: 'Socket hỗ trợ' },
    { key: 'radiator_mm', label: 'Kích thước két nước', unit: 'mm' },
    { key: 'height_mm', label: 'Chiều cao', unit: 'mm' },
    { key: 'max_tdp_w', label: 'Tản tối đa', unit: 'W' },
  ],
}

// Một số giá trị gốc (tiếng Anh) đổi sang tiếng Việt cho dễ hiểu.
const VALUE_LABELS = {
  cooler_type: { air: 'Tản khí', liquid: 'Tản nước (AIO)' },
  modular: { No: 'Không', Semi: 'Bán phần', Full: 'Toàn phần' },
}

// Hiển thị một giá trị thông số: true → "Có", mảng → "A, B", 1000 GB → "1 TB".
export function formatSpecValue(field, value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.join(', ')
  const mapped = VALUE_LABELS[field.key]?.[value]
  if (mapped) return mapped
  if (field.unit === 'GB' && value >= 1000) return `${value / 1000} TB`
  return field.unit ? `${value} ${field.unit}` : String(value)
}

// Danh sách thông số để hiện bảng: các trường đã khai báo trước (đúng thứ tự),
// sau đó là các trường lạ chưa có nhãn (để không bị mất thông tin).
export function specRows(categorySlug, specs = {}) {
  const fields = SPEC_FIELDS[categorySlug] ?? []
  const known = new Set(fields.map((f) => f.key))
  const rows = fields
    .filter((f) => specs[f.key] != null)
    .map((f) => ({ key: f.key, label: f.label, value: formatSpecValue(f, specs[f.key]) }))
  for (const [key, value] of Object.entries(specs)) {
    // "estimated" là ghi chú nội bộ của BA, không hiện cho khách.
    if (known.has(key) || key === 'estimated' || value == null) continue
    rows.push({ key, label: key, value: formatSpecValue({ key }, value) })
  }
  return rows
}
