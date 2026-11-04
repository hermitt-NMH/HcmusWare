// Nhãn tiếng Việt + đơn vị cho từng thông số trong products.specs, theo từng danh mục.
// Dùng chung cho bảng thông số (trang chi tiết) và bộ lọc (trang danh mục).
// filter: true → hiện thành nhóm ô chọn trong bộ lọc của danh mục đó.
import { t, tKey } from './i18n'

export const SPEC_FIELDS = {
  cpu: [
    { key: 'socket', label: 'Socket', filter: true },
    { key: 'cores', label: tKey('Số nhân'), filter: true },
    { key: 'threads', label: tKey('Số luồng') },
    { key: 'base_clock_ghz', label: tKey('Xung cơ bản'), unit: 'GHz' },
    { key: 'boost_clock_ghz', label: tKey('Xung tối đa'), unit: 'GHz' },
    { key: 'tdp_w', label: tKey('Công suất (TDP)'), unit: 'W' },
    { key: 'igpu', label: tKey('Nhân đồ họa tích hợp'), filter: true },
  ],
  mainboard: [
    { key: 'socket', label: 'Socket', filter: true },
    { key: 'chipset', label: 'Chipset' },
    { key: 'form_factor', label: tKey('Kích thước'), filter: true },
    { key: 'ram_type', label: tKey('Chuẩn RAM'), filter: true },
    { key: 'ram_slots', label: tKey('Số khe RAM') },
    { key: 'max_ram_gb', label: tKey('RAM tối đa'), unit: 'GB' },
    { key: 'm2_slots', label: tKey('Số khe M.2') },
  ],
  ram: [
    { key: 'ram_type', label: tKey('Chuẩn RAM'), filter: true },
    { key: 'capacity_gb', label: tKey('Dung lượng'), unit: 'GB', filter: true },
    { key: 'modules', label: tKey('Số thanh') },
    { key: 'speed_mhz', label: 'Bus', unit: 'MHz' },
  ],
  vga: [
    { key: 'chipset', label: 'Chipset' },
    { key: 'vram_gb', label: tKey('Bộ nhớ (VRAM)'), unit: 'GB', filter: true },
    { key: 'length_mm', label: tKey('Chiều dài'), unit: 'mm' },
    { key: 'tdp_w', label: tKey('Công suất (TDP)'), unit: 'W' },
    { key: 'recommended_psu_w', label: tKey('Nguồn khuyến nghị'), unit: 'W' },
  ],
  ssd: [
    { key: 'capacity_gb', label: tKey('Dung lượng'), unit: 'GB', filter: true },
    { key: 'interface', label: tKey('Giao tiếp'), filter: true },
    { key: 'form_factor', label: tKey('Kích thước') },
  ],
  psu: [
    { key: 'wattage_w', label: tKey('Công suất'), unit: 'W', filter: true },
    { key: 'efficiency', label: tKey('Chuẩn hiệu suất'), filter: true },
    { key: 'form_factor', label: tKey('Kích thước') },
    { key: 'modular', label: tKey('Dây rời (modular)') },
  ],
  case: [
    { key: 'case_type', label: tKey('Loại vỏ'), filter: true },
    { key: 'form_factors', label: tKey('Mainboard hỗ trợ') },
    { key: 'max_gpu_length_mm', label: tKey('VGA dài tối đa'), unit: 'mm' },
    { key: 'max_cooler_height_mm', label: tKey('Tản khí cao tối đa'), unit: 'mm' },
  ],
  cooler: [
    { key: 'cooler_type', label: tKey('Loại tản'), filter: true },
    { key: 'sockets', label: tKey('Socket hỗ trợ') },
    { key: 'radiator_mm', label: tKey('Kích thước két nước'), unit: 'mm' },
    { key: 'height_mm', label: tKey('Chiều cao'), unit: 'mm' },
    { key: 'max_tdp_w', label: tKey('Tản tối đa'), unit: 'W' },
  ],
}

// Một số giá trị gốc (tiếng Anh) đổi sang tiếng Việt cho dễ hiểu.
const VALUE_LABELS = {
  cooler_type: { air: tKey('Tản khí'), liquid: tKey('Tản nước (AIO)') },
  modular: { No: tKey('Không'), Semi: tKey('Bán phần'), Full: tKey('Toàn phần') },
}

// Hiển thị một giá trị thông số: true → "Có", mảng → "A, B", 1000 GB → "1 TB".
export function formatSpecValue(field, value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? t('Có') : t('Không')
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
