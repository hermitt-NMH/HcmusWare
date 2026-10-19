// Đường dẫn quay lại sau khi đăng nhập (?next=...).
// Chỉ cho quay về trang trong web (bắt đầu bằng "/", không phải "//" hay "/\")
// để kẻ xấu không gửi link ?next=https://trang-gia.com lừa người dùng.
// Trình duyệt coi "\" giống "/", nên "/\trang-gia.com" cũng là sang trang khác → chặn mọi "\".
export function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/'
}
