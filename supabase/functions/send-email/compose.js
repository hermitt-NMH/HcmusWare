// Soạn nội dung email từ một dòng notifications (F12 – US-12.3). Hàm thuần, không dùng API của Deno
// để vitest chạy được (compose.test.js). Email chỉ là chữ: tiêu đề, nội dung, link về web, link tắt email.
// Không đưa địa chỉ nhận hàng hay số điện thoại vào email (thông báo trong DB cũng không chứa).

// Loại thông báo → loại email (dùng ở link tắt email và công tắc trong /tai-khoan).
const KIND = { price_drop: 'gia', order_status: 'don' }
const KIND_LABEL = { gia: 'email cảnh báo giá', don: 'email trạng thái đơn hàng' }

export function emailKind(type) {
  return KIND[type] ?? null
}

// Chỉ ghép link trong web; link lạ thì dẫn về trang chủ.
function absolute(siteUrl, link) {
  const base = String(siteUrl).replace(/\/+$/, '')
  const path =
    typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '/'
  return base + path
}

// notification: { type, title, body, link }; token: profiles.email_token
export function composeEmail(notification, { siteUrl, token }) {
  const kind = emailKind(notification.type)
  if (!kind) throw new Error(`Loại thông báo ${notification.type} không gửi email`)
  const base = String(siteUrl).replace(/\/+$/, '')
  const lines = [
    notification.title,
    '',
    notification.body,
    '',
    `Xem chi tiết: ${absolute(siteUrl, notification.link)}`,
    '',
    '--',
    'HcmusWare – linh kiện máy tính',
    `Không muốn nhận ${KIND_LABEL[kind]} nữa? Tắt tại: ${base}/tat-email?t=${encodeURIComponent(token)}&loai=${kind}`,
  ]
  return {
    subject: `HcmusWare: ${notification.title}`.slice(0, 150),
    text: lines.join('\n'),
  }
}
