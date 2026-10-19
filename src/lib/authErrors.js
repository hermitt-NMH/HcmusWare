// Đổi thông báo lỗi tiếng Anh của Supabase Auth sang tiếng Việt dễ hiểu.
// Supabase trả về error.code (bản mới) và error.message; so cả hai cho chắc.
const MESSAGES = [
  [/invalid_credentials|invalid login credentials/i, 'Email hoặc mật khẩu không đúng.'],
  [/user_already_exists|already registered/i, 'Email này đã được đăng ký. Hãy đăng nhập.'],
  [
    /email_not_confirmed|email not confirmed/i,
    'Email chưa được xác nhận. Hãy mở hộp thư và bấm link xác nhận.',
  ],
  [/weak_password|password should be/i, 'Mật khẩu quá yếu, cần ít nhất 6 ký tự.'],
  [/email_address_invalid|invalid.*email|unable to validate email/i, 'Email không hợp lệ.'],
  [
    /over_email_send_rate_limit|over_request_rate_limit|rate limit/i,
    'Thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  ],
  [/provider is not enabled|unsupported provider/i, 'Đăng nhập Google chưa được bật trên máy chủ.'],
  [/signup.*disabled/i, 'Hệ thống đang tạm khóa đăng ký.'],
  [/failed to fetch|network/i, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'],
]

export function authErrorMessage(error) {
  if (!error) return ''
  const text = `${error.code ?? ''} ${error.message ?? ''}`
  const found = MESSAGES.find(([pattern]) => pattern.test(text))
  return found ? found[1] : `Có lỗi xảy ra: ${error.message}`
}
