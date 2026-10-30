# BA – Giai đoạn 2, Tuần 6: cho 5 bạn thử vai người bán đăng 1 sản phẩm

Người phụ trách: BA · Dùng cho: PM (số liệu slide bảo vệ, #123), Dev (lỗi tìm được, #118). Issue #121.
Phiên bản 1 – kịch bản và phiếu ghi. Hạn chạy: **T5 31/12** trên `hcmusware.vercel.app` (bản sau code freeze).
Kết quả ghi vào mục 5 của file này rồi mới đóng #121.

## 1. Câu hỏi cần trả lời

**Người chưa từng dùng HcmusWare có tự mở shop và đăng được 1 sản phẩm đúng thông số không, nếu không ai chỉ?**

Số đưa vào slide: **"X/5 bạn tự đăng xong"**, kèm thời gian trung vị và bước nhiều người kẹt nhất.
Đây là phép thử nhỏ (5 người) để tìm chỗ khó dùng, không phải số liệu thống kê; slide ghi rõ "5 bạn", không đổi ra phần trăm.

## 2. Người thử và chuẩn bị

- 5 bạn **ngoài nhóm**, chưa mở HcmusWare bao giờ; ít nhất 2 bạn làm trên điện thoại (US-14 phải dùng được ở 360 px).
- Mỗi bạn tự đăng ký 1 tài khoản mới bằng email của mình (không dùng tài khoản mẫu).
- BA làm người quan sát; một bạn trong nhóm đăng nhập **admin** trên máy khác để duyệt shop (bước 3).
- Gửi trước cho mỗi bạn file ảnh `public/images/products/ram-corsair-vengeance-rgb-pro-32-gb-2x16gb-ddr4-3600.webp`
  (lưu vào máy hoặc điện thoại để chọn khi đăng).
- Bấm giờ bằng điện thoại; mỗi bạn khoảng 15 phút kể cả hỏi sau buổi.

## 3. Kịch bản

Đọc cho bạn thử đúng đoạn sau, không giải thích thêm:

> "Bạn có mấy thanh RAM cũ muốn bán online. Hãy vào hcmusware.vercel.app, mở một shop tên tùy bạn, rồi đăng bán sản phẩm trong thẻ này. Cứ làm như bạn nghĩ; nếu bí thì nói to bạn đang tìm gì."

Thẻ sản phẩm (in hoặc gửi ảnh chụp):

| Ô trên form | Nội dung                                          |
| ----------- | ------------------------------------------------- |
| Tên         | Corsair Vengeance RGB Pro 32GB (2x16GB) DDR4-3600 |
| Danh mục    | RAM                                               |
| Thương hiệu | Corsair                                           |
| Giá         | 2.450.000 ₫                                       |
| Tồn kho     | 3                                                 |
| Ảnh         | file đã gửi trước                                 |
| Thông số    | DDR4 · kit **2 thanh × 16 GB** · bus 3600 MHz     |

Thẻ cố ý ghi "2 thanh × 16 GB" thay vì "32 GB": ô "Tổng dung lượng kit" là chỗ BA đoán dễ nhập sai nhất ([thong-so-bat-buoc.md](thong-so-bat-buoc.md), mục RAM).

Các bước bạn thử phải đi qua (người quan sát chỉ dùng để ghi, **không** đọc cho bạn thử):

| Bước | Việc                                                     | Trang                               |
| ---- | -------------------------------------------------------- | ----------------------------------- |
| 1    | Đăng ký, đăng nhập                                       | `/dang-ky`                          |
| 2    | Tìm chỗ mở shop, điền tên shop, gửi đăng ký              | `/tai-khoan` → `/tai-khoan/mo-shop` |
| 3    | (Admin duyệt shop ở `/admin/duyet` – **không tính giờ**) | –                                   |
| 4    | Vào Kênh người bán, bấm "+ Đăng sản phẩm"                | `/kenh-nguoi-ban`                   |
| 5    | Điền form, tải ảnh, nhập thông số                        | `/kenh-nguoi-ban/san-pham/moi`      |
| 6    | Bấm "Đăng và gửi duyệt", thấy sản phẩm nhãn "Chờ duyệt"  | `/kenh-nguoi-ban`                   |

Sau bước 2, nếu bạn thử hỏi "giờ làm gì?", trả lời "shop đang chờ duyệt, bạn đợi một chút" rồi admin duyệt ngay. Bước 3 trừ khỏi thời gian vì lúc demo thật admin không duyệt tức thì.

## 4. Tiêu chí "tự làm xong"

Một bạn được tính **tự làm xong** khi đủ cả 4 điều:

1. Sản phẩm hiện trong Kênh người bán với nhãn **"Chờ duyệt"**.
2. Thông số đúng thẻ: `DDR4`, Tổng dung lượng kit **32**, Số thanh **2**, Bus **3600**; danh mục RAM, thương hiệu Corsair, giá và tồn kho đúng.
3. Tổng thời gian bước 1–2 và 4–6 **không quá 10 phút**.
4. Người quan sát **không** chỉ cách lần nào.

Quy tắc cho người quan sát:

- Không chỉ, không gật đầu khi bạn thử sắp bấm đúng. Bạn hỏi thì đáp: "Bạn thử làm như bạn nghĩ."
- Kẹt ở một bước quá **3 phút** thì mới gợi ý (ghi lại gợi ý gì, ở bước nào). Có gợi ý → không tính tự làm xong, nhưng vẫn cho làm tiếp để xem các bước sau.
- Form báo lỗi đỏ rồi bạn tự sửa được thì **vẫn** tính tự làm xong; ghi lại ô nào báo lỗi.
- Nhập sai thông số mà form không báo (vd nhập 16 vào "Tổng dung lượng kit") → không tính tự làm xong, ghi vào cột "Sai".

Sau mỗi người hỏi 2 câu, ghi nguyên văn:

- "Chỗ nào làm bạn phải dừng lại suy nghĩ lâu nhất?"
- "Nếu bán thật, bạn có muốn đăng tiếp sản phẩm thứ 2 ở đây không? Vì sao?"

## 5. Kết quả

_Chưa chạy. BA điền sau buổi thử T5 31/12; không điền ước đoán._

| Bạn | Thiết bị | Bước 1–2 (phút) | Bước 4–6 (phút) | Gợi ý (bước, nội dung) | Ô báo lỗi | Sai | Tự làm xong |
| --- | -------- | --------------- | --------------- | ---------------------- | --------- | --- | ----------- |
| 1   |          |                 |                 |                        |           |     |             |
| 2   |          |                 |                 |                        |           |     |             |
| 3   |          |                 |                 |                        |           |     |             |
| 4   |          |                 |                 |                        |           |     |             |
| 5   |          |                 |                 |                        |           |     |             |

**Tổng:** \_/5 bạn tự làm xong · thời gian trung vị \_ phút · bước kẹt nhiều nhất: \_

Trả lời câu hỏi sau buổi:

| Bạn | Dừng lâu nhất ở đâu | Có đăng tiếp không, vì sao |
| --- | ------------------- | -------------------------- |
| 1   |                     |                            |
| 2   |                     |                            |
| 3   |                     |                            |
| 4   |                     |                            |
| 5   |                     |                            |

Dòng cho slide (PM, #123): "X/5 bạn chưa dùng HcmusWare tự mở shop và đăng 1 sản phẩm RAM, trung vị Y phút; chỗ khó nhất: Z."

## 6. Sau buổi thử

- **Lỗi** (form không cho lưu dữ liệu đúng, trang vỡ ở 360 px, mất dữ liệu): mở Issue nhãn `bug` ngay trong buổi, ghi bạn số mấy, thiết bị, bước. Vì đã qua code freeze, chỉ lỗi **Nghiêm trọng** được sửa trước bảo vệ (#118); còn lại ghi backlog.
- **Khó dùng nhưng không phải lỗi** (tìm mãi không thấy nút "Mở shop", hiểu nhầm ô thông số): ghi vào mục 5, đưa vào backlog sau giai đoạn 2, không sửa trước bảo vệ.
- **Dọn dữ liệu trên DB online**: admin **không duyệt** 5 sản phẩm thử; vào `/admin/duyet` bấm "Trả lại" với lý do "Sản phẩm thử – #121" để khách không thấy. Giữ 5 shop thử (không xóa được do `owner_id`), khóa shop ở `/admin` nếu PM muốn danh sách shop gọn lúc demo.
