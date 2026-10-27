# BA – Giai đoạn 2, Tuần 1: đơn vị hành chính và Zalo OA

Người phụ trách: BA · Dùng cho: Dev1 (F17 sổ địa chỉ, Tuần 3), KTS + PM (quyết định F12).
Phiên bản 1 – Tuần 1 giai đoạn 2.

## 1. Bộ dữ liệu đơn vị hành chính 2 cấp (F17)

### Đã chọn

**[vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database)**, bản **v5.2.0**, theo nghị quyết mới nhất **388/NQ-UBTVQH16** (bộ dữ liệu sinh ngày 20/09/2026).

- 34 tỉnh/thành, 3.321 đơn vị cấp xã (709 phường, 2.599 xã, 13 đặc khu); không còn cấp Quận/Huyện.
- Mã tỉnh và mã xã là **mã chính thức của Tổng cục Thống kê** (ví dụ Hà Nội `01`, Phường Ba Đình `00004`), nên lưu mã vào DB là ổn định, không phụ thuộc cách viết tên.
- Giấy phép **MIT** (© 2021 Thang Le Quoc): dùng tự do, chỉ cần giữ ghi chú bản quyền; đã ghi trong file dữ liệu.
- Có sẵn bản JSON; cập nhật khi có nghị quyết mới.

### Các nguồn đã so sánh

| Nguồn                                                                                                               | Kết luận                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database)           | **Chọn.** MIT, mã TCTK, cập nhật đến 2026, có JSON                                           |
| [vietmap-company/vietnam_administrative_address](https://github.com/vietmap-company/vietnam_administrative_address) | Đủ 34/3.321 nhưng giấy phép riêng của VietMap, không ghi rõ có mã TCTK                       |
| [zuydd/vn-geo](https://github.com/zuydd/vn-geo)                                                                     | Repo tự ghi là dữ liệu không chính thức, lấy từ một bài báo                                  |
| [provinces.open-api.vn](https://provinces.open-api.vn/) (API v2)                                                    | Là API, cần mạng mỗi lần gõ; kế hoạch yêu cầu gợi ý chạy trên máy, không phụ thuộc API ngoài |

### File trong repo

`public/data/don-vi-hanh-chinh.json`: **98 KB** (khoảng 27 KB khi Vercel nén gzip), tải một lần khi mở form địa chỉ.
Chỉ giữ mã và tên đầy đủ, xếp A–Z theo tiếng Việt:

```json
{
  "source": "https://github.com/thanglequoc/vietnamese-provinces-database",
  "license": "MIT © 2021 Thang Le Quoc",
  "version": "v5.2.0",
  "decree": "388/NQ-UBTVQH16",
  "provinces": [
    ["01", "Thành phố Hà Nội", [["00004", "Phường Ba Đình"], ["00008", "Phường Ngọc Hà"], "..."]],
    "..."
  ]
}
```

Gợi ý cho Dev1 (F17):

- Bảng `addresses` lưu `province_code` và `ward_code` (mã), **và** lưu kèm tên tại thời điểm lưu, để đơn cũ vẫn đọc được nếu sau này đơn vị hành chính đổi tên.
- Tên trong dữ liệu dùng kiểu đặt dấu cũ ở vài chỗ ("Khánh Hoà", "Thanh Hoá", "Phường Hiệp Hoà"). Hàm bỏ dấu dùng `normalize('NFD')` rồi xóa dấu, đổi `đ` → `d`, thì "hoa", "hòa", "hoà" đều khớp.
- Ví dụ test cho hàm gợi ý: xem US-17.2 trong [user-story-g2.md](user-story-g2.md).

### Cập nhật khi có nghị quyết mới

1. Tải bản mới: trang Releases của repo nguồn, file `vn_provinces_json_dataset_<phiên bản>.zip` (khoảng 100 MB vì có kèm GeoJSON), giải nén ra ngoài repo.
2. `npm run build-dvhc -- <đường dẫn>/json/full_json_generated_data_vn_units.json <phiên bản> <nghị quyết>`
3. Kiểm tra số tỉnh/xã script in ra, mở form địa chỉ thử vài tên, rồi tạo Pull Request.

## 2. Nhóm có đăng ký được Zalo OA không? (F12)

### Kết luận: **Không đăng ký được OA đủ tính năng cho F12. Đề xuất bỏ F12** (đúng phương án trong bảng rủi ro của kế hoạch).

| F12 cần                                         | Điều kiện của Zalo                                                                                                                                            | Nhóm có không |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| OA nhắn tin được cho khách                      | OA phải **xác thực** bằng Giấy chứng nhận đăng ký kinh doanh (doanh nghiệp hoặc hộ kinh doanh); tên OA phải theo tên trên giấy ĐKKD hoặc nhãn hiệu đã đăng ký | Không có ĐKKD |
| Không có ĐKKD thì sao                           | Chỉ tạo được loại "hồ sơ" để chạy quảng cáo: **không** dùng được Nhắn tin, Broadcast, Chatbot, Gọi thoại                                                      | –             |
| Gửi cảnh báo giá, trạng thái đơn chủ động (ZNS) | ZNS chỉ dành cho OA đã xác thực, mẫu tin phải được Zalo duyệt, **tính phí theo tin**                                                                          | Không         |
| Tin tư vấn qua API (miễn phí)                   | Chỉ trả lời được khi khách vừa nhắn cho OA trong khoảng thời gian giới hạn; không hợp để báo giá giảm sau vài ngày                                            | Không phù hợp |

Nguồn:
[Zalo Ads – Hướng dẫn tạo Zalo Official Account](https://ads.zalo.me/business/huong-dan-tao-zalo-official-account/) (trang chính thức của Zalo),
[Mobihome – Hướng dẫn khởi tạo Zalo OA](https://mobihome.vn/huong-dan/huong-dan-khoi-tao-zalo-official-account/),
[CGV Telecom – ZNS là gì, quy trình đăng ký](https://cgvtelecom.vn/zalo-notification-service-zns-la-gi-quy-trinh-dang-ky-luu-y-quan-trong-cho-doanh-nghiep/).

Lưu ý: kết luận dựa trên tài liệu công khai, chưa ai trong nhóm thử đăng ký thật. Nếu PM muốn chắc chắn, một bạn dùng số điện thoại của mình vào [oa.zalo.me](https://oa.zalo.me) thử tạo OA (mất khoảng 10 phút) và chụp màn hình bước yêu cầu giấy ĐKKD để đưa vào slide báo cáo.

### Thay thế đề xuất (không bắt buộc, PM quyết định)

- Giữ thông báo **trong web** đã có từ giai đoạn 1 (`PriceAlertNotifier`), mở rộng thêm thông báo đổi trạng thái đơn.
- Nếu Tuần 5 còn thời gian: gửi **email** cảnh báo giá và trạng thái đơn qua Supabase Edge Function (đã nằm trong mục "nếu dư thời gian" của giai đoạn 1). Không cần giấy tờ, có gói miễn phí.

Việc tiếp theo: PM cập nhật bảng GitHub Projects (bỏ thẻ F12 của KTS ở Tuần 5 hoặc đổi sang email), báo lý do ở buổi báo cáo.
