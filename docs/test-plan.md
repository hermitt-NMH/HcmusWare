# Test plan – Giai đoạn 1

Người phụ trách: Test1 (kiểm thử tay), Test2 (test tự động). Phiên bản 1 – 18/10/2026.

## Phạm vi và cách làm

| Hạng mục                                                | Cách kiểm thử                                                                     | Khi nào                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Quy tắc tương thích (`compatibility.js`)                | Unit test Vitest theo bảng test case dưới đây (Test2), `npx vitest run` phải xanh | Tuần 3, chạy lại mỗi Pull Request sửa file này |
| Các trang (trang chủ, danh mục, chi tiết, đăng nhập...) | Kiểm thử tay trên bản Vercel preview của Pull Request                             | Tối thứ 6 hằng tuần                            |
| Builder                                                 | Kiểm thử tay theo bảng test case, trên 3 cỡ màn hình                              | Tuần 4                                         |
| Luồng mua hàng end-to-end                               | Kiểm thử tay                                                                      | Tuần 5                                         |
| Hồi quy toàn bộ, Lighthouse Mobile ≥ 85                 | Tay + Lighthouse                                                                  | Tuần 6                                         |

**Thiết bị:** Chrome máy tính (1366 px), Chrome DevTools giả lập 360 px và 768 px, ít nhất 1 điện thoại Android và 1 iPhone thật.
**Ghi lỗi:** GitHub Issues, nhãn `bug` + mức độ `nghiêm trọng` / `trung bình` / `nhẹ`, kèm bước tái hiện, ảnh chụp, link bản Vercel.
**Đạt:** kết quả thực tế giống hệt cột "Kết quả mong đợi"; không có lỗi đỏ trong Console.

## Test case – Quy tắc tương thích

Quy tắc xem tại [quy-tac-tuong-thich.md](quy-tac-tuong-thich.md). Tên sản phẩm đúng như trong DB sau khi chạy `npm run import-data`.

**Cấu hình gốc B0** (8 sản phẩm mẫu trong `supabase/seed.sql`, hợp lệ hoàn toàn):

| Linh kiện | Sản phẩm                                    | Thông số dùng trong test                   |
| --------- | ------------------------------------------- | ------------------------------------------ |
| CPU       | AMD Ryzen 5 7600                            | AM5, 65 W, có iGPU                         |
| Mainboard | MSI PRO B650M-A WIFI                        | AM5, DDR5, Micro ATX, 4 khe, tối đa 192 GB |
| RAM       | Kingston FURY Beast 32GB (2x16GB) DDR5-6000 | DDR5, 2 thanh, 32 GB, ramQty = 1           |
| VGA       | ASUS Dual GeForce RTX 4060 8GB              | dài 227 mm, 115 W                          |
| SSD       | Samsung 990 EVO 1TB                         |                                            |
| PSU       | Corsair RM750e 750W                         | 750 W, ATX                                 |
| Case      | NZXT H5 Flow                                | ATX Mid Tower, VGA tối đa 365 mm           |
| Tản nhiệt | Thermalright Peerless Assassin 120 SE       | AM4, AM5, LGA1700, LGA1851                 |

Mỗi test case là B0 **thay đúng các linh kiện ghi trong cột "Thay đổi"**.

| Mã    | Quy tắc   | Thay đổi so với B0                                                                                                         | Kết quả mong đợi                                                                |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| TC01  | Tất cả    | Không đổi                                                                                                                  | errors rỗng, warnings rỗng, totalPowerW 280, recommendedPsuW 400, complete true |
| TC02  | R1        | CPU → Intel Core i5-12400                                                                                                  | errors = [R1]                                                                   |
| TC03  | R1        | CPU → Intel Core i5-12400; Mainboard → Gigabyte B760 DS3H AX                                                               | errors rỗng (LGA1700 khớp, case H5 nhận ATX)                                    |
| TC04  | R2        | RAM → Corsair Vengeance RGB Pro 32 GB (2x16GB) DDR4-3600                                                                   | errors = [R2]                                                                   |
| TC05  | R3        | Mainboard → Asus PRIME B650M-K; ramQty = 2                                                                                 | errors = [R3] (cần 4 khe, có 2)                                                 |
| TC06  | R3, R4    | Mainboard → Asus PRIME B650M-K; RAM → Corsair Vengeance RGB 64 GB (2x32GB) DDR5-6000; ramQty = 2                           | errors = [R3, R4] (128 GB > 96 GB)                                              |
| TC07  | R5        | CPU → Intel Core i5-12400; Mainboard → Gigabyte B760 DS3H AX; Case → Zalman CUBIX                                          | errors = [R5]                                                                   |
| TC08  | R6 biên   | Case → Silverstone RV05B; VGA → ASRock Radeon RX 7900 XT Creator 20GB                                                      | errors rỗng (312 = 312 mm); totalPowerW 480, recommendedPsuW 650; warnings rỗng |
| TC09  | R6        | Case → Zalman CUBIX; VGA → Zotac GeForce RTX 3080 Ti AMP Extreme Holo 12GB                                                 | errors = [R6] (356 > 260 mm)                                                    |
| TC10  | R7        | CPU → Intel Core Ultra 5 235; Mainboard → Gigabyte B860M D3HP; Tản → tản giả chỉ có AM4, AM5 (dữ liệu giả trong unit test) | errors = [R7] (tản không hỗ trợ LGA1851)                                        |
| TC10b | R7        | CPU → Intel Core Ultra 5 235; Mainboard → Gigabyte B860M D3HP                                                              | errors rỗng (tản LGA1700 lắp được LGA1851)                                      |
| TC11  | R8        | VGA → Gigabyte GeForce RTX 5080 WINDFORCE OC SFF 16GB; PSU → Thermaltake Smart                                             | errors = [R8]; totalPowerW 525 > 500 W                                          |
| TC12  | W1        | VGA → Gigabyte GeForce RTX 5080 WINDFORCE OC SFF 16GB; PSU → SeaSonic G12 GC                                               | errors rỗng; warnings = [W1]; recommendedPsuW 700                               |
| TC13  | R9        | CPU → Intel Core i3-14100F; Mainboard → Gigabyte B760 DS3H AX; VGA → không chọn                                            | errors = [R9]; complete false                                                   |
| TC14  | R9        | CPU → Intel Core i5-12400; Mainboard → Gigabyte B760 DS3H AX; VGA → không chọn                                             | errors rỗng; complete true; totalPowerW 165, recommendedPsuW 250                |
| TC15  | W2        | PSU → Silverstone SFX                                                                                                      | errors rỗng; warnings = [W2]                                                    |
| TC16  | W4        | Case → Zalman CUBIX; Tản → Thermalright Mjolnir Vision 360 ARGB                                                            | errors rỗng; warnings = [W4]                                                    |
| TC17  | W5        | VGA có `length_mm = null` (dữ liệu giả trong unit test)                                                                    | không có R6; warnings = [W5]                                                    |
| TC18  | Bỏ qua    | Chỉ chọn CPU, các linh kiện khác null                                                                                      | errors rỗng; complete false                                                     |
| TC19  | Công suất | Dữ liệu giả: cpu 100 W + vga 250 W                                                                                         | totalPowerW 450, recommendedPsuW 600 (450 × 1,3 = 585 → 600)                    |
| TC20  | Công suất | Dữ liệu giả: cpu 50 W + vga 0 W (không chọn VGA, CPU có iGPU)                                                              | totalPowerW 150, recommendedPsuW 200 (195 → 200)                                |

## Test case – Giao diện Tuần 2 (trang chủ, danh sách sản phẩm)

| Mã   | Bước                                                     | Kết quả mong đợi                                                                                                   |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| UI01 | Mở trang chủ ở 360 px                                    | Không có thanh cuộn ngang; banner, 8 ô danh mục (2 cột), lưới sản phẩm hiển thị đủ                                 |
| UI02 | Mở trang chủ ở 1366 px                                   | Danh mục 4 cột; 8 sản phẩm mới nhất có hãng, tên, giá dạng `4.430.000 ₫`, số tồn kho; chưa có ảnh thì hiện logo mờ |
| UI03 | Bấm một ô danh mục, ví dụ "RAM"                          | Sang `/danh-muc/ram`, tiêu đề "RAM", chỉ hiện sản phẩm RAM (16 sản phẩm)                                           |
| UI04 | Bấm "Xem tất cả"                                         | Sang `/san-pham`, hiện 128 sản phẩm                                                                                |
| UI05 | Bấm "Bắt đầu build", "Giỏ hàng", "Đăng nhập"             | Hiện trang "đang phát triển", không trắng trang                                                                    |
| UI06 | Gõ đường dẫn sai `/abc`                                  | Hiện trang 404, có link về trang chủ                                                                               |
| UI07 | Tắt mạng (DevTools → Offline) rồi tải lại trang danh mục | Hiện thông báo lỗi tải dữ liệu, không trắng trang                                                                  |
| UI08 | Mở Console của Chrome trên mọi trang                     | Không có lỗi màu đỏ                                                                                                |
| UI09 | Tải lại trực tiếp `/danh-muc/cpu` trên bản Vercel        | Trang hiện bình thường (không lỗi 404 của Vercel)                                                                  |
