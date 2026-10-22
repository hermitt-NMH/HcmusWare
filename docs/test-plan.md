# Test plan – Giai đoạn 1

Người phụ trách: Test1 (kiểm thử tay), Test2 (test tự động). Phiên bản 1 – 18/10/2026.

## Phạm vi và cách làm

| Hạng mục                                                | Cách kiểm thử                                                                     | Khi nào                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Quy tắc tương thích (`compatibility.js`)                | Unit test Vitest theo bảng test case dưới đây (Test2), `npx vitest run` phải xanh | Tuần 3, chạy lại mỗi Pull Request sửa file này |
| Các trang (trang chủ, danh mục, chi tiết, đăng nhập...) | Kiểm thử tay trên bản Vercel preview của Pull Request                             | Tối thứ 6 hằng tuần                            |
| Builder                                                 | Kiểm thử tay theo bảng test case, trên 3 cỡ màn hình                              | Tuần 4                                         |
| Luồng mua hàng end-to-end                               | Kiểm thử tay theo bảng test case Tuần 5                                           | Tuần 5                                         |
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

| Mã   | Bước                                                                                                | Kết quả mong đợi                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| UI01 | Mở trang chủ ở 360 px                                                                               | Không có thanh cuộn ngang; banner, 8 ô danh mục (2 cột), lưới sản phẩm hiển thị đủ                                 |
| UI02 | Mở trang chủ ở 1366 px                                                                              | Danh mục 4 cột; 8 sản phẩm mới nhất có hãng, tên, giá dạng `4.430.000 ₫`, số tồn kho; chưa có ảnh thì hiện logo mờ |
| UI03 | Bấm một ô danh mục, ví dụ "RAM"                                                                     | Sang `/danh-muc/ram`, tiêu đề "RAM", chỉ hiện sản phẩm RAM (16 sản phẩm)                                           |
| UI04 | Bấm "Xem tất cả"                                                                                    | Sang `/san-pham`, hiện 128 sản phẩm                                                                                |
| UI05 | Bấm "Bắt đầu build", "Giỏ hàng", "Đăng nhập"                                                        | Mở đúng trang Build PC (`/build-pc`), Giỏ hàng (`/gio-hang`), Đăng nhập (`/dang-nhap`), không trắng trang          |
| UI06 | Gõ đường dẫn sai `/abc`                                                                             | Hiện trang 404, có link về trang chủ                                                                               |
| UI07 | Chặn API Supabase (DevTools → Network → Block request URL `*/rest/v1/*`) rồi tải lại trang danh mục | Hiện thông báo lỗi tải dữ liệu, không trắng trang                                                                  |
| UI08 | Mở Console của Chrome trên mọi trang                                                                | Không có lỗi màu đỏ                                                                                                |
| UI09 | Tải lại trực tiếp `/danh-muc/cpu` trên bản Vercel                                                   | Trang hiện bình thường (không lỗi 404 của Vercel)                                                                  |

## Test case – Builder và giỏ hàng (Tuần 4)

Chạy trên 3 cỡ màn hình: **360 px** (điện thoại, giao diện từng bước), **768 px** (máy tính bảng, giao diện bảng) và **1366 px** (máy tính, bảng + khung tổng kết bên phải). Trước mỗi ca: xóa localStorage (DevTools → Application → Local Storage → Clear), trừ khi ca ghi "giữ nguyên". Cấu hình **B0** là 8 sản phẩm ở bảng trên, tổng **29.020.000 ₫** với 1 kit RAM.

| Mã   | Cỡ màn hình          | Bước                                                                               | Kết quả mong đợi                                                                                                                                                                             |
| ---- | -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BD01 | 768, 1366            | Mở `/build-pc` khi chưa chọn gì                                                    | Bảng 8 dòng: CPU, Mainboard, RAM, VGA (không bắt buộc), SSD, Nguồn, Vỏ máy, Tản nhiệt; mỗi dòng có nút "Chọn"; không cuộn ngang                                                              |
| BD02 | 360                  | Mở `/build-pc` khi chưa chọn gì                                                    | Thanh các bước cuộn ngang + "Bước 1/8: CPU", danh sách 16 CPU; thanh dưới có "Tổng cộng 0 ₫", nút Lùi (mờ) và Bỏ qua; không cuộn ngang                                                       |
| BD03 | 1366                 | Chọn CPU AMD Ryzen 5 7600, rồi bấm "Chọn" ở dòng Mainboard                         | Hộp thoại "Chọn Mainboard" có dòng "Chỉ hiện linh kiện tương thích: Socket AM5 (theo CPU)", chỉ còn 5 mainboard AM5; Esc đóng hộp thoại                                                      |
| BD04 | 1366                 | Tiếp BD03, chọn MSI PRO B650M-A WIFI rồi mở dòng RAM                               | Chỉ còn 7 RAM DDR5; dòng "DDR5 (theo mainboard)"                                                                                                                                             |
| BD05 | 360                  | Chọn CPU AMD Ryzen 5 7600 ở Bước 1                                                 | Tự sang "Bước 2/8: Mainboard", chỉ còn 5 mainboard AM5; nút bước CPU có dấu ✓                                                                                                                |
| BD06 | 360, 768, 1024, 1366 | Chọn đủ B0                                                                         | "✓ Cấu hình tương thích", Tổng cộng 29.020.000 ₫, công suất ~280 W, nguồn đề xuất ≥ 400 W; nút "Thêm cấu hình vào giỏ" bấm được; ở bảng, nút "Đổi" và "✕" của mọi dòng hiện đủ, không bị cắt |
| BD07 | 1366                 | Từ B0, đổi Vỏ máy → Zalman CUBIX, VGA → Zotac GeForce RTX 3080 Ti AMP Extreme Holo | Dòng VGA và Vỏ máy tô đỏ, nhãn "Lỗi"; khung tổng kết "1 lỗi tương thích" (VGA dài hơn case); nút thêm vào giỏ bị khóa                                                                        |
| BD08 | 1366                 | Từ B0, đổi CPU → Intel Core i3-14100F, bỏ VGA                                      | Dòng VGA ghi "Bắt buộc (CPU không có iGPU)"; nút thêm vào giỏ bị khóa, ghi "Còn thiếu: VGA"                                                                                                  |
| BD09 | 1366                 | Từ B0, đổi "Số kit" RAM thành 2                                                    | Giá dòng RAM 5.380.000 ₫; Tổng cộng 31.710.000 ₫                                                                                                                                             |
| BD10 | 1366                 | Chọn đủ B0, tải lại trang (giữ nguyên localStorage)                                | Vẫn còn đủ 8 linh kiện và đúng tổng tiền                                                                                                                                                     |
| BD11 | 1366                 | Từ B0, bấm "Làm lại từ đầu" → OK                                                   | 8 dòng về "Chưa chọn", Tổng cộng 0 ₫                                                                                                                                                         |
| GH01 | 1366                 | Từ B0 (2 kit RAM), bấm "Thêm cấu hình vào giỏ"                                     | Sang `/gio-hang`, tiêu đề "Giỏ hàng (9)", 8 dòng, RAM số lượng 2; tạm tính 31.710.000 ₫; số trên biểu tượng giỏ ở Header là 9                                                                |
| GH02 | 1366                 | Tiếp GH01, bấm "+" ở dòng CPU, rồi bấm "×" xóa dòng SSD                            | Giỏ hàng (9): CPU số lượng 2, không còn SSD; tạm tính 35.010.000 ₫                                                                                                                           |
| GH03 | 1366                 | Tiếp GH02, tải lại trang (giữ nguyên localStorage)                                 | Giỏ giữ nguyên như sau GH02                                                                                                                                                                  |
| GH04 | 1366                 | Bấm "+" liên tục ở một sản phẩm                                                    | Dừng ở min(tồn kho, 10); nút "+" mờ đi                                                                                                                                                       |
| GH05 | 360                  | Mở giỏ có hàng                                                                     | Không cuộn ngang; nút −/+ và nút xóa đủ lớn để bấm (≥ 44 px)                                                                                                                                 |
| GH06 | 1366                 | Bấm "Xóa tất cả" → OK                                                              | Hiện "Giỏ hàng trống" với nút Build PC và Xem sản phẩm                                                                                                                                       |
| GH07 | 1366                 | Ở trang chi tiết một sản phẩm, bấm "Thêm vào giỏ"                                  | Nút đổi thành "✓ Đã thêm vào giỏ", số trên biểu tượng giỏ tăng 1                                                                                                                             |

Chạy tự động UI01–UI09, BD01–BD11, GH01–GH07: `npm run build && npm run preview`, rồi ở terminal khác `npm run test:ui` (bản Vercel: đặt `BASE_URL=<link Vercel>`). Ảnh chụp lưu ở `ui-test-output/`. Script không thay thế việc thử trên điện thoại thật, Safari iOS và Cốc Cốc.

### Kết quả lần chạy 20/10/2026 (bản build local + Supabase local)

35/35 ca tự động đạt sau khi sửa lỗi dưới đây. Cần chép lỗi sang GitHub Issues.

| Lỗi   | Mức độ     | Mô tả                                                                                                                                                                                                                                 | Trạng thái                                                                                                                                                         |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BUG01 | Trung bình | Builder ở 768–1279 px: bảng rộng 777 px, tràn khung (719 px ở 768, 639 px ở 1024) và bị `overflow-hidden` cắt mất cột nút → không thấy nút "✕" để bỏ linh kiện. Nguyên nhân: dòng thông số `truncate` làm cột "Đã chọn" không co được | Đã sửa: bảng `table-fixed`, khung tổng kết chỉ nằm bên phải từ 1280 px (`xl`), thông số bị cắt có `title` để xem đủ. BD06 thêm kiểm tra "nút bị cắt" ở 768/1024 px |

## Test case – Mua hàng, lịch sử giá, quản trị (Tuần 5)

Chuẩn bị: Supabase local đã chạy migration `20261022000000_tuan5_don_hang_admin.sql` và `npm run gen-price-history`. Dùng một tài khoản khách mới và tài khoản admin `admin@hcmusware.local`.

| Mã   | Cỡ màn hình | Bước                                                                       | Kết quả mong đợi                                                                                                                                          |
| ---- | ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MH01 | 360         | Giỏ có 2 sản phẩm, bấm "Thanh toán" khi chưa đăng nhập                     | Sang trang đăng nhập; đăng nhập xong quay lại `/thanh-toan`; không cuộn ngang                                                                             |
| MH02 | 360         | Xóa họ tên, nhập số điện thoại "123", bấm "Đặt hàng"                       | Báo "Vui lòng nhập họ tên người nhận", "Số điện thoại không hợp lệ"; không tạo đơn                                                                        |
| MH03 | 360         | Điền đủ, chọn "Thanh toán online (mô phỏng)", bấm "Đặt hàng và thanh toán" | Sang cổng "HcmusPay" đúng số tiền; giỏ không còn các món đã đặt; tồn kho giảm đúng số lượng                                                               |
| MH04 | 360         | Ở cổng mô phỏng bấm "Thanh toán …"                                         | Trang đơn: "Đặt hàng thành công", trạng thái "Đã xác nhận", "Đã thanh toán"                                                                               |
| MH05 | 1366        | Đặt hàng COD                                                               | Form điền sẵn thông tin đã lưu ở MH03; trang đơn ghi "Chờ xác nhận", "Trả khi nhận hàng"                                                                  |
| MH06 | 1366        | Mở `/tai-khoan`                                                            | Mục "Đơn hàng của tôi" có 2 đơn, mới nhất trước, đúng trạng thái và tổng tiền; bấm vào mở chi tiết                                                        |
| MH07 | 1366        | Mở `/don-hang/<id đơn của người khác>`                                     | Trang 404 (RLS không trả đơn của người khác)                                                                                                              |
| MH08 | 1366        | Chọn online, ở cổng bấm "Để sau", rồi mở đơn trong tài khoản               | Đơn "Chờ xác nhận", "Chưa thanh toán", có nút "Thanh toán ngay"                                                                                           |
| GIA1 | 1366, 360   | Mở trang một sản phẩm                                                      | Mục "Lịch sử giá 6 tháng": thấp nhất, cao nhất, % thay đổi, biểu đồ bậc thang kết thúc ở giá hiện tại; "Xem dạng bảng" hiện bảng; 360 px không cuộn ngang |
| GIA2 | 1366        | Chưa đăng nhập                                                             | Khung "Báo tôi khi giá giảm" chỉ có nút "Đăng nhập để đặt cảnh báo"                                                                                       |
| GIA3 | 1366        | Nhập giá mong muốn cao hơn giá hiện tại                                    | Báo "Giá mong muốn phải thấp hơn giá hiện tại."                                                                                                           |
| GIA4 | 1366        | Nhập giá thấp hơn giá hiện tại 20.000 ₫, bấm "Đặt cảnh báo"                | Hiện "Giá mong muốn: …"; biểu đồ có đường ngang nét đứt xanh lá                                                                                           |
| GIA5 | 1366        | Admin giảm giá sản phẩm đó 50.000 ₫; khách mở lại web                      | Thanh xanh dưới Header: "Giá đã giảm tới mức bạn mong muốn!" kèm tên sản phẩm, giá mới                                                                    |
| GIA6 | 1366        | Bấm "Đã xem", chuyển trang                                                 | Thanh thông báo không hiện lại                                                                                                                            |
| CH01 | 1366        | Build PC đã chọn CPU, bấm "Lưu cấu hình & chia sẻ" → "Lưu"                 | Hiện "✓ Đã lưu" và link `/build-pc?cau-hinh=<mã>`; nút "Sao chép link"                                                                                    |
| CH02 | 360         | Đăng xuất, xóa localStorage, mở link ở CH01                                | Builder nạp đúng cấu hình, báo "Đã mở cấu hình …"; URL còn `/build-pc`                                                                                    |
| CH03 | 1366        | Đang build cấu hình khác, mở link ở CH01                                   | Hỏi "Thay cấu hình đang build…?"; bấm Hủy thì giữ cấu hình cũ                                                                                             |
| CH04 | 1366        | Mở `/build-pc?cau-hinh=khongco1`                                           | Báo "Link chia sẻ không đúng hoặc cấu hình đã bị xóa."                                                                                                    |
| CH05 | 1366        | `/tai-khoan` → "Cấu hình đã lưu": bấm "Mở", "Sao chép link", "Xóa"         | Mở đúng cấu hình; xóa xong thì link cũ báo lỗi như CH04                                                                                                   |
| AD01 | 1366        | Khách thường mở `/admin`                                                   | "Không có quyền truy cập"                                                                                                                                 |
| AD02 | 1366        | Admin mở `/admin/san-pham`, tìm theo tên, "Sửa" đổi giá → Lưu              | Báo "Giá mới đã được ghi vào lịch sử giá"; biểu đồ trang sản phẩm có thêm bậc giá mới                                                                     |
| AD03 | 1366        | "+ Thêm sản phẩm" với thông số `{socket: AM5}` (sai JSON)                  | Báo lỗi ở ô Thông số, không lưu                                                                                                                           |
| AD04 | 1366        | Xóa một sản phẩm đã có trong đơn hàng                                      | Báo "Sản phẩm đã nằm trong đơn hàng nên không xóa được…"                                                                                                  |
| AD05 | 1366, 360   | `/admin/don-hang`: đổi Chờ xác nhận → Đang giao → Hoàn tất                 | Nhãn đổi theo; ô trạng thái chỉ cho đi tới; đơn hoàn tất bị khóa; COD hoàn tất ghi "Đã thanh toán"                                                        |
| AD06 | 1366        | Hủy một đơn                                                                | Hỏi xác nhận; tồn kho các sản phẩm trong đơn được cộng lại; đơn bị khóa; đơn đã trả online ghi "cần hoàn tiền"                                            |

### Kết quả lần chạy 22/10/2026 (bản build local + Supabase local)

- Tầng DB (gọi Supabase JS bằng tài khoản khách/admin): 18/18 đạt – tổng tiền do DB tính, khách không sửa được đơn/giá, admin chỉ sửa được cột `status`, không trả tiền 2 lần, hủy đơn trả kho, đơn đã hủy bị khóa, đổi giá ghi `price_history`, link chia sẻ không lộ `user_id`.
- Giao diện (Edge headless, 360 và 1366 px): 25/25 đạt, Console không lỗi đỏ. Chưa thử điện thoại thật.

| Lỗi   | Mức độ       | Mô tả                                                                                                                                                                          | Trạng thái                                           |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| BUG02 | Nghiêm trọng | Đặt hàng xong bị đưa về `/gio-hang` (trống) thay vì trang đơn hàng, dù đơn đã tạo. React Router v7 chuyển trang dạng transition, chạy sau lần xóa giỏ → Checkout thấy giỏ rỗng | Đã sửa: Checkout ghi nhận "đã đặt" trước khi xóa giỏ |

### Kết quả lần chạy 22/10/2026 sau khi merge PR #42 và đưa migration lên Supabase online

| Môi trường                     | Bộ test                                                                                                                                                        | Kết quả                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Local (build + Supabase local) | Unit test Vitest                                                                                                                                               | 96/96 đạt                   |
| Local                          | UI01–UI09, BD01–BD11, GH01–GH07 (`npm run test:ui`)                                                                                                            | 35/35 đạt                   |
| Local                          | Tuần 5: MH01, MH03, MH07, MH08, GIA1–GIA6, CH01–CH05, AD01–AD06                                                                                                | 37/37 đạt sau khi sửa BUG03 |
| Vercel (hcmusware.vercel.app)  | `BASE_URL=https://hcmusware.vercel.app npm run test:ui`                                                                                                        | 35/35 đạt                   |
| Vercel                         | Tuần 5 chỉ đọc: GIA1 (3 sản phẩm, bảng giá, 360 px), GIA2, CH04, chưa đăng nhập vào `/thanh-toan`, `/don-hang/1`, `/admin`, cổng thanh toán → chuyển đăng nhập | 13/13 đạt                   |

Trên bản Vercel **không** chạy các ca ghi dữ liệu (đặt hàng, đổi giá, hủy đơn) để DB thật không có đơn rác trước buổi demo. Test1 chạy tay các ca này trên điện thoại thật với tài khoản test riêng, rồi admin hủy các đơn thử.

| Lỗi   | Mức độ | Mô tả                                                                                                                          | Trạng thái                                               |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| BUG03 | Nhẹ    | Admin xóa sản phẩm đã có trong đơn: web vẫn báo đúng "không xóa được" nhưng Console có lỗi đỏ 409 (vi phạm Definition of Done) | Đã sửa: kiểm tra `order_items` trước, không gửi lệnh xóa |
| BUG04 | Nhẹ    | Trang sản phẩm 360 px: ô "Thấp nhất / Cao nhất" rớt chữ "₫" xuống dòng                                                         | Đã sửa: không xuống dòng, chữ 13 px ở điện thoại         |

### Kết quả lần chạy 22/10/2026 – kiểm thử thăm dò API và RLS (Supabase local)

Gọi thẳng REST/RPC bằng 2 tài khoản thử A, B (bỏ qua giao diện) để xem DB có tự bảo vệ không.

| Ca            | Nội dung                                                                             | Kết quả                   |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| API05–06      | B / khách chưa đăng nhập đọc đơn và `order_items` của A                              | Đạt: không thấy           |
| API07         | B thanh toán đơn của A                                                               | Đạt: "Không tìm thấy đơn" |
| API08–10      | A tự đổi `status`, `total` đơn mình; tự nâng `role = admin`                          | Đạt: bị chặn              |
| API11–14      | A tạo cảnh báo giá cho B, insert đơn thẳng vào bảng, sửa giá, liệt kê `saved_builds` | Đạt: bị chặn              |
| API01         | Đặt 1 sản phẩm bằng 2 dòng 10 + 10 chiếc                                             | **Lỗi → BUG05**           |
| API02, 03, 17 | Phương thức thanh toán null, SĐT "abc", họ tên 100.000 ký tự                         | **Lỗi → BUG06**           |
| API18         | Admin xác nhận đơn online chưa thanh toán                                            | **Lỗi → BUG08**           |

| Lỗi   | Mức độ     | Mô tả                                                                                                                                               | Trạng thái                                                                                                          |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| BUG05 | Trung bình | `place_order` kiểm tra tối đa 10 chiếc theo từng dòng, không cộng các dòng cùng sản phẩm → một tài khoản gửi 10 + 10 + … giữ hết tồn kho            | Đã sửa: migration `20261023000000` gom số lượng theo sản phẩm trước khi kiểm tra, khóa sản phẩm theo thứ tự id      |
| BUG06 | Thấp       | Gọi thẳng `place_order` bỏ qua kiểm tra của form: SĐT sai, tên/địa chỉ dài vô hạn; thanh toán null báo lỗi tiếng Anh "violates not-null constraint" | Đã sửa: DB kiểm tra SĐT, độ dài (tên ≤ 100, địa chỉ 10–300, ghi chú ≤ 500); form thêm giới hạn tên/địa chỉ cho khớp |
| BUG07 | Thấp       | Trang thanh toán: hồ sơ tải xong sau khi form hiện → form bị dựng lại, mất chữ khách đã gõ và phương thức thanh toán quay về COD                    | Đã sửa: hồ sơ về chỉ điền vào ô còn trống, giữ nguyên lựa chọn của khách                                            |
| BUG08 | Thấp       | Admin chuyển được đơn online chưa thanh toán sang "Đã xác nhận"/"Đang giao" → khách mất nút thanh toán, hoàn tất thì bị ghi là đã thu tiền          | Đã sửa: DB chặn (chỉ được hủy), ô chọn trạng thái ở admin chỉ còn "Chờ xác nhận" và "Đã hủy"                        |

Sau khi sửa: API01–API20 đạt 22/22, Vitest 98/98, lint sạch, `npm run test:ui` 35/35 (ca BD06 @1024px chập chờn 1/3 lần do script đọc trang trước khi Builder tải xong – Test2 cần tăng thời gian chờ, không phải lỗi web).
**Cần làm trước demo:** đưa migration `20261023000000_qa_tuan5_kiem_tra_don.sql` lên Supabase online (`npx supabase db push`), rồi Test1 chạy tay lại MH01–MH08, AD03–AD06 trên Vercel.

### Kết quả lần chạy 22/10/2026 – end-to-end Tuần 5 tự động (`npm run test:e2e`)

Script `scripts/e2e-tuan5.js` chạy MH01–MH08, AD03–AD06 bằng trình duyệt headless với tài khoản test riêng (`@hcmusware.test`), cuối cùng hủy hết đơn thử (trả kho) và xóa admin test.

| Môi trường                     | Kết quả                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Local (build + Supabase local) | 13/13 đạt (MH01–MH08, AD03–AD06, Console)                                                                                 |
| Vercel + Supabase online       | 11/13 ở lần chạy thử bằng bản nháp script: MH08 đọc trang trước khi tải xong; AD04 xóa nhầm sản phẩm (xem sự cố bên dưới) |
| Local, `npm run test:ui`       | 35/35 đạt 4 lần liên tiếp sau khi BD06 chờ Builder tải xong                                                               |

**Sự cố 22/10:** bản nháp script ở ca AD04 tìm dòng sản phẩm theo tên bằng "chứa chuỗi" nên tên "AMD Ryzen 5 7600" khớp nhầm "AMD Ryzen 5 7600X" và "7600X3D" → xóa 2 sản phẩm thật (id 9, 21) trên Supabase online (chưa nằm trong đơn nào nên DB cho xóa). Đã sửa script: chỉ bấm "Xóa" khi có đúng 1 dòng mang mã `#id` của sản phẩm đã nằm trong đơn. Khôi phục: chèn lại 2 sản phẩm đúng id cũ và sinh lại lịch sử giá (cùng seed, cùng thời điểm `2026-10-22 12:49:09.901`), cần chạy bằng SQL Editor của Supabase.
