// Logic đơn hàng dạng HÀM THUẦN (không đụng React hay mạng) để dễ viết unit test.
// Trang Checkout, OrderDetail, Account, admin dùng chung các hàm/hằng số này.
import { isUnavailable } from '../cart/cart'

// Trạng thái đơn (khớp check constraint trong bảng orders) + màu nhãn.
export const ORDER_STATUS = {
  pending: { label: 'Chờ xác nhận', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800' },
  shipping: { label: 'Đang giao', className: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Hoàn tất', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Đã hủy', className: 'bg-slate-200 text-slate-700' },
}

export const PAYMENT_METHODS = {
  cod: { label: 'Thanh toán khi nhận hàng (COD)', short: 'COD' },
  mock_online: { label: 'Thanh toán online (mô phỏng)', short: 'Online' },
}

// Thứ tự xử lý đơn. Đơn hoàn tất / đã hủy thì không đổi được nữa (DB cũng chặn).
const FLOW = ['pending', 'confirmed', 'shipping', 'completed']

// Các trạng thái admin được chọn tiếp theo cho một đơn (gồm cả trạng thái hiện tại).
// Chỉ đi tới, không lùi; lúc nào chưa xong cũng hủy được.
// awaitingPayment: đơn online chưa thanh toán → chỉ giữ nguyên hoặc hủy (DB cũng chặn, BUG08).
export function nextStatuses(status, awaitingPayment = false) {
  if (status === 'completed' || status === 'cancelled') return [status]
  if (awaitingPayment) return [status, 'cancelled']
  const i = FLOW.indexOf(status)
  return [...FLOW.slice(Math.max(i, 0)), 'cancelled']
}

export function isFinalStatus(status) {
  return status === 'completed' || status === 'cancelled'
}

// Khách còn thanh toán online được không (đơn mock_online, chưa trả, đang chờ).
export function canPayOnline(order) {
  return order?.payment_method === 'mock_online' && !order.paid_at && order.status === 'pending'
}

// Nhãn thanh toán hiện trong lịch sử đơn.
export function paymentStatusLabel(order) {
  // Trả online rồi bị hủy: shop phải hoàn tiền (đồ án chưa có hoàn tiền tự động).
  if (order.paid_at && order.status === 'cancelled') return 'Đã thanh toán – cần hoàn tiền'
  if (order.paid_at) return 'Đã thanh toán'
  if (order.status === 'cancelled') return 'Không thanh toán'
  return order.payment_method === 'cod' ? 'Trả khi nhận hàng' : 'Chưa thanh toán'
}

// Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx (10 số).
export const PHONE_RE = /^(0|\+84)\d{9}$/

// Chuẩn hóa + kiểm tra form thanh toán. Trả { data, errors } – errors rỗng là hợp lệ.
export function validateCheckout(form) {
  const data = {
    name: (form.name ?? '').trim(),
    phone: (form.phone ?? '').replace(/[\s.-]/g, ''), // cho phép gõ "090 123 4567"
    address: (form.address ?? '').trim(),
    note: (form.note ?? '').trim(),
    payment: form.payment,
  }
  const errors = {}
  // Giới hạn độ dài khớp với hàm place_order trong DB (BUG06).
  if (!data.name) errors.name = 'Vui lòng nhập họ tên người nhận.'
  else if (data.name.length > 100) errors.name = 'Họ tên tối đa 100 ký tự.'
  if (!data.phone) errors.phone = 'Vui lòng nhập số điện thoại.'
  else if (!PHONE_RE.test(data.phone)) errors.phone = 'Số điện thoại không hợp lệ (vd 0901234567).'
  if (data.address.length < 10)
    errors.address = 'Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, phường, quận, tỉnh).'
  else if (data.address.length > 300) errors.address = 'Địa chỉ tối đa 300 ký tự.'
  if (data.note.length > 500) errors.note = 'Ghi chú tối đa 500 ký tự.'
  if (!PAYMENT_METHODS[data.payment]) errors.payment = 'Vui lòng chọn phương thức thanh toán.'
  return { data, errors }
}

// Các dòng giỏ mua được → tham số p_items của hàm place_order.
export function cartToOrderItems(items) {
  return items
    .filter((it) => !isUnavailable(it) && it.price != null && it.qty > 0)
    .map((it) => ({ product_id: it.id, quantity: it.qty }))
}

// Lỗi từ place_order / mock_pay_order là câu tiếng Việt do DB raise → hiện thẳng cho khách.
// Lỗi mạng thì báo chung.
export function orderErrorMessage(error) {
  if (!error) return ''
  if (/fetch|network/i.test(error.message)) return 'Mất kết nối mạng, vui lòng thử lại.'
  return error.message
}
