// Trang chính sách bảo mật: Google yêu cầu link này để bật đăng nhập Google cho người dùng ngoài.
// Sửa nội dung khi web thu thập thêm dữ liệu mới (đơn hàng, cảnh báo giá...).
const sections = [
  {
    title: 'Dữ liệu chúng tôi thu thập',
    items: [
      'Khi đăng ký bằng email: email, mật khẩu (được mã hóa, nhóm không xem được) và họ tên.',
      'Khi đăng nhập bằng Google: email, họ tên và ảnh đại diện mà Google cho phép chia sẻ. Chúng tôi không đọc Gmail, danh bạ hay dữ liệu Google nào khác.',
      'Thông tin bạn tự điền trong trang tài khoản: số điện thoại, địa chỉ nhận hàng.',
    ],
  },
  {
    title: 'Dùng dữ liệu để làm gì',
    items: [
      'Đăng nhập, hiển thị tài khoản và điền sẵn thông tin khi đặt hàng.',
      'Không bán, không cho thuê và không chia sẻ dữ liệu với bên thứ ba vì mục đích quảng cáo.',
    ],
  },
  {
    title: 'Lưu trữ',
    items: [
      'Dữ liệu được lưu trên Supabase; chỉ chính bạn và quản trị viên của nhóm xem được thông tin tài khoản.',
      'Giỏ hàng có thể được lưu trong trình duyệt của bạn (localStorage) và không gửi lên máy chủ.',
    ],
  },
  {
    title: 'Quyền của bạn',
    items: [
      'Sửa thông tin cá nhân bất cứ lúc nào trong trang Tài khoản.',
      'Gửi email về địa chỉ bên dưới để yêu cầu xóa tài khoản và toàn bộ dữ liệu; nhóm xử lý trong 7 ngày.',
    ],
  },
]

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <h1 className="text-2xl font-bold sm:text-3xl">Chính sách bảo mật</h1>
      <p className="mt-2 text-sm text-slate-500">Cập nhật ngày 19/10/2026</p>
      <p className="mt-4 text-slate-700">
        HcmusWare là website đồ án sinh viên môn Nhập môn CNTT. Web không bán hàng thật và không thu
        tiền; thanh toán chỉ là mô phỏng.
      </p>

      {sections.map((s) => (
        <section key={s.title} className="mt-6">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Liên hệ</h2>
        <p className="mt-2 text-slate-700">
          Email:{' '}
          <a href="mailto:hoangbensan@gmail.com" className="text-blue-700 hover:underline">
            hoangbensan@gmail.com
          </a>
        </p>
      </section>
    </article>
  )
}
