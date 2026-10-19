// Đường dẫn quay lại sau khi đăng nhập (?next=...).
// Chỉ cho quay về trang trong web (bắt đầu bằng "/", không phải "//" hay "/\")
// để kẻ xấu không gửi link ?next=https://trang-gia.com lừa người dùng.
// Trình duyệt coi "\" giống "/", nên "/\trang-gia.com" cũng là sang trang khác → chặn mọi "\".
// Trình duyệt cũng tự xóa ký tự tab/xuống dòng trong URL: "/<tab>/trang-gia.com" thành "//trang-gia.com"
// → chặn mọi ký tự điều khiển (mã 0–31 và 127).
export function safeNext(value) {
  return value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : '/'
}
