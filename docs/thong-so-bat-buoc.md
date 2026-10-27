# Thông số bắt buộc khi người bán đăng sản phẩm

Người phụ trách: BA · Dùng cho: Dev3 (form kênh người bán, dùng lại `src/features/admin/productForm.js`),
Test2 (unit test kiểm tra thông số), admin (duyệt sản phẩm).
Phiên bản 1 – Tuần 1 giai đoạn 2. User story: US-14.4, US-14.5 trong [user-story-g2.md](user-story-g2.md).

## Nguyên tắc

- Tên khóa trong `products.specs` **giữ đúng như dữ liệu hiện có** (128 sản phẩm), vì `compatibility.js` và `budget.js` đọc theo các tên này.
  Bảng `specs` trong `skills/ba/SKILL.md` là bản nháp giai đoạn 1, có vài tên khác (`base_ghz`, `form_factors_supported`, `height_mm`...): **file này là bản chính thức**.
- **Bắt buộc** = thiếu thì không lưu được. Mọi thông số mà một quy tắc tương thích (R1–R9) cần đều bắt buộc.
- Giá trị có danh sách cố định thì form dùng ô chọn (không cho gõ tự do), để tránh "AM5" / "am5" / "Socket AM5".
- **Khoảng hợp lệ**: ngoài khoảng thì không lưu được. **Khoảng thường gặp**: ngoài khoảng vẫn lưu được nhưng màn hình duyệt của admin tô vàng để kiểm tra kỹ.
- Số đo nhập bằng số, đơn vị đã ghi trong tên khóa (`_w`, `_mm`, `_gb`, `_mhz`, `_ghz`). Form hiện đơn vị cạnh ô.
- Danh sách giá trị cố định đặt ở **một chỗ trong code** (ví dụ `src/features/seller/specFields.js`). Admin cần thêm giá trị mới (socket mới...) thì sửa file đó qua Pull Request.

## Trường chung (mọi danh mục)

| Trường         | Bắt buộc | Kiểm tra                                                                                                        |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| Danh mục       | Có       | 1 trong 8 danh mục; chọn trước, form thông số đổi theo                                                          |
| Tên sản phẩm   | Có       | 5–200 ký tự; không trùng tên khác trong cùng shop + danh mục                                                    |
| Thương hiệu    | Có       | Chọn từ bảng `brands`; chưa có thì "Thương hiệu khác" + gõ tên, admin tạo khi duyệt (C1 trong user-story-g2.md) |
| Giá (VNĐ)      | Có       | Số nguyên 1.000 – 200.000.000                                                                                   |
| Tồn kho        | Có       | Số nguyên 0 – 9.999                                                                                             |
| Ảnh            | Có       | 1–5 ảnh, JPG/PNG/WebP, mỗi ảnh ≤ 2 MB; ảnh đầu là ảnh đại diện                                                  |
| Mô tả          | Không    | ≤ 5.000 ký tự, hiển thị dạng chữ thường (không HTML)                                                            |
| Link datasheet | Không    | `https://...`                                                                                                   |

## Thông số theo danh mục

Cột **Quy tắc** là quy tắc trong [quy-tac-tuong-thich.md](quy-tac-tuong-thich.md) hoặc hàm dùng thông số đó.

### CPU (`cpu`)

| Khóa              | Nhãn trên form          | Kiểu / giá trị                           | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc         |
| ----------------- | ----------------------- | ---------------------------------------- | -------- | ------------- | ---------- | --------------- |
| `socket`          | Socket                  | Chọn: `AM4`, `AM5`, `LGA1700`, `LGA1851` | Có       | –             | –          | R1, R7, Builder |
| `cores`           | Số nhân                 | Số nguyên                                | Có       | 1–128         | 4–24       | Hiển thị, F10   |
| `threads`         | Số luồng                | Số nguyên ≥ `cores`                      | Không    | 1–256         | 4–32       | Hiển thị        |
| `base_clock_ghz`  | Xung cơ bản (GHz)       | Số thập phân 1 chữ số                    | Có       | 0,5–7         | 2–5        | Hiển thị        |
| `boost_clock_ghz` | Xung tối đa (GHz)       | Số thập phân, ≥ xung cơ bản              | Có       | 0,5–7         | 4–6        | Hiển thị        |
| `tdp_w`           | TDP (W)                 | Số nguyên                                | Có       | 10–500        | 35–170     | R8, W1          |
| `igpu`            | Có nhân đồ họa tích hợp | Có / Không                               | Có       | –             | –          | R9, F10         |

### Mainboard (`mainboard`)

| Khóa          | Nhãn            | Kiểu / giá trị                       | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc |
| ------------- | --------------- | ------------------------------------ | -------- | ------------- | ---------- | ------- |
| `socket`      | Socket          | Chọn: như CPU                        | Có       | –             | –          | R1      |
| `ram_type`    | Chuẩn RAM       | Chọn: `DDR4`, `DDR5`                 | Có       | –             | –          | R2      |
| `form_factor` | Kích thước      | Chọn: `ATX`, `Micro ATX`, `Mini ITX` | Có       | –             | –          | R5      |
| `ram_slots`   | Số khe RAM      | Chọn: 2, 4                           | Có       | –             | –          | R3      |
| `max_ram_gb`  | RAM tối đa (GB) | Số nguyên                            | Có       | 8–512         | 64–256     | R4      |

### RAM (`ram`)

| Khóa          | Nhãn                     | Kiểu / giá trị       | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc  |
| ------------- | ------------------------ | -------------------- | -------- | ------------- | ---------- | -------- |
| `ram_type`    | Chuẩn RAM                | Chọn: `DDR4`, `DDR5` | Có       | –             | –          | R2       |
| `capacity_gb` | Tổng dung lượng kit (GB) | Số nguyên            | Có       | 4–256         | 8–64       | R4, F10  |
| `modules`     | Số thanh trong kit       | Chọn: 1, 2, 4        | Có       | –             | –          | R3       |
| `speed_mhz`   | Bus (MHz)                | Số nguyên            | Có       | 1600–10000    | 3000–7200  | Hiển thị |

Lưu ý cho form: "Tổng dung lượng kit" là **cả kit** (kit 2 × 16 GB → `capacity_gb = 32`, `modules = 2`). Ghi rõ dưới ô để người bán không nhập 16.

### VGA (`vga`)

| Khóa        | Nhãn                   | Kiểu / giá trị                                  | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc  |
| ----------- | ---------------------- | ----------------------------------------------- | -------- | ------------- | ---------- | -------- |
| `chipset`   | Chip đồ họa            | Chữ, ví dụ `GeForce RTX 5060`, `Radeon RX 7600` | Có       | 3–60 ký tự    | –          | F10, F09 |
| `vram_gb`   | VRAM (GB)              | Số nguyên                                       | Có       | 1–48          | 4–20       | Hiển thị |
| `length_mm` | Chiều dài card (mm)    | Số nguyên                                       | Có       | 100–450       | 200–360    | R6       |
| `tdp_w`     | Công suất tiêu thụ (W) | Số nguyên                                       | Có       | 20–700        | 100–360    | R8, W1   |

### SSD (`ssd`)

| Khóa          | Nhãn            | Kiểu / giá trị                                                                 | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc  |
| ------------- | --------------- | ------------------------------------------------------------------------------ | -------- | ------------- | ---------- | -------- |
| `interface`   | Giao tiếp       | Chọn: `SATA 6.0 Gb/s`, `M.2 PCIe 3.0 X4`, `M.2 PCIe 4.0 X4`, `M.2 PCIe 5.0 X4` | Có       | –             | –          | Hiển thị |
| `form_factor` | Kiểu            | Chọn: `2.5"`, `M.2-2280`                                                       | Có       | –             | –          | Hiển thị |
| `capacity_gb` | Dung lượng (GB) | Số nguyên (1 TB = 1000)                                                        | Có       | 64–16000      | 256–2000   | F10      |

Ràng buộc chéo: `interface = SATA 6.0 Gb/s` thì `form_factor` có thể là cả hai; `interface` bắt đầu bằng `M.2` thì `form_factor` phải là `M.2-2280`.

### Nguồn (`psu`)

| Khóa          | Nhãn          | Kiểu / giá trị                                                                                  | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc     |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------- | -------- | ------------- | ---------- | ----------- |
| `wattage_w`   | Công suất (W) | Số nguyên                                                                                       | Có       | 200–2000      | 500–1300   | R8, W1, F10 |
| `efficiency`  | Chứng nhận    | Chọn: `80+`, `80+ Bronze`, `80+ Silver`, `80+ Gold`, `80+ Platinum`, `80+ Titanium`, `Không có` | Có       | –             | –          | Hiển thị    |
| `modular`     | Kiểu dây      | Chọn: `No`, `Semi`, `Full` (hiển thị: Liền dây / Bán rời / Rời hoàn toàn)                       | Có       | –             | –          | Hiển thị    |
| `form_factor` | Kích thước    | Chọn: `ATX`, `SFX`                                                                              | Có       | –             | –          | W2, W3, F10 |

### Case (`case`)

| Khóa                | Nhãn                      | Kiểu / giá trị                                                                                         | Bắt buộc | Khoảng hợp lệ | Thường gặp | Quy tắc         |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | -------- | ------------- | ---------- | --------------- |
| `case_type`         | Loại case                 | Chọn: `ATX Full Tower`, `ATX Mid Tower`, `MicroATX Mid Tower`, `MicroATX Mini Tower`, `Mini ITX Tower` | Có       | –             | –          | W2, W3, W4, F10 |
| `form_factors`      | Mainboard lắp được        | Chọn nhiều: `ATX`, `Micro ATX`, `Mini ITX` (ít nhất 1)                                                 | Có       | –             | –          | R5              |
| `max_gpu_length_mm` | Chiều dài VGA tối đa (mm) | Số nguyên                                                                                              | Có       | 150–500       | 260–420    | R6              |

Ràng buộc chéo: `case_type` bắt đầu bằng `Mini ITX` thì `form_factors` chỉ được là `Mini ITX`; bắt đầu bằng `MicroATX` thì không được có `ATX`.

### Tản nhiệt (`cooler`)

| Khóa          | Nhãn                     | Kiểu / giá trị                                 | Bắt buộc                      | Khoảng hợp lệ | Thường gặp | Quy tắc |
| ------------- | ------------------------ | ---------------------------------------------- | ----------------------------- | ------------- | ---------- | ------- |
| `cooler_type` | Loại                     | Chọn: `air` (Tản khí), `liquid` (Tản nước AIO) | Có                            | –             | –          | W4      |
| `sockets`     | Socket hỗ trợ            | Chọn nhiều: như CPU (ít nhất 1)                | Có                            | –             | –          | R7, F10 |
| `radiator_mm` | Kích thước két nước (mm) | Chọn: 120, 240, 280, 360, 420                  | Có khi `liquid`, ẩn khi `air` | –             | –          | W4      |
| `max_tdp_w`   | TDP tối đa tản được (W)  | Số nguyên                                      | Không                         | 50–400        | 150–300    | F10     |

## Lỗi dữ liệu hiện có cần sửa (phát hiện khi rà)

8 sản phẩm mẫu trong `supabase/seed.sql` có định dạng hơi khác 120 sản phẩm import:

| Sản phẩm (id DB online)                   | Hiện tại                                    | Cần sửa thành                                 |
| ----------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Samsung 990 EVO 1TB (5)                   | `interface: "M.2 PCIe 4.0 x4"` (x thường)   | `"M.2 PCIe 4.0 X4"` cho khớp ô chọn và bộ lọc |
| Thermalright Peerless Assassin 120 SE (8) | thiếu `cooler_type`, có `radiator_mm: null` | thêm `cooler_type: "air"`, bỏ `radiator_mm`   |

Không ảnh hưởng quy tắc R1–R9 hiện tại, nhưng bộ lọc "Giao tiếp" trên trang danh mục đang hiện 2 lựa chọn gần giống nhau cho SSD, và form người bán (ô chọn cố định) sẽ không mở được 2 sản phẩm này để sửa. Sửa `seed.sql` và chạy cập nhật trên DB online (nhớ `npm run db:backup` trước). Test1 kiểm lại test case B0 sau khi sửa.

## Gợi ý cho Test2 (unit test hàm kiểm tra thông số)

| #   | Danh mục  | Dữ liệu                                                  | Kết quả mong đợi                                 |
| --- | --------- | -------------------------------------------------------- | ------------------------------------------------ |
| 1   | cpu       | đủ 6 khóa bắt buộc, giá trị trong khoảng                 | Hợp lệ                                           |
| 2   | cpu       | thiếu `socket`                                           | Lỗi ở `socket`                                   |
| 3   | cpu       | `boost_clock_ghz` < `base_clock_ghz`                     | Lỗi ở `boost_clock_ghz`                          |
| 4   | cpu       | `tdp_w = 600`                                            | Lỗi ở `tdp_w` (ngoài khoảng hợp lệ)              |
| 5   | cpu       | `tdp_w = 250`                                            | Hợp lệ, có cảnh báo cho admin (ngoài thường gặp) |
| 6   | mainboard | `socket = "am5"`                                         | Lỗi (không nằm trong danh sách)                  |
| 7   | ram       | `modules = 3`                                            | Lỗi                                              |
| 8   | ssd       | `interface = "M.2 PCIe 4.0 X4"`, `form_factor = "2.5\""` | Lỗi ràng buộc chéo                               |
| 9   | case      | `case_type = "Mini ITX Tower"`, `form_factors = ["ATX"]` | Lỗi ràng buộc chéo                               |
| 10  | case      | `form_factors = []`                                      | Lỗi (ít nhất 1)                                  |
| 11  | cooler    | `cooler_type = "liquid"`, thiếu `radiator_mm`            | Lỗi ở `radiator_mm`                              |
| 12  | cooler    | `cooler_type = "air"`, không có `radiator_mm`            | Hợp lệ                                           |
| 13  | vga       | `length_mm = "300"` (chuỗi)                              | Form đổi sang số 300 rồi mới kiểm, hợp lệ        |
| 14  | bất kỳ    | có khóa lạ không thuộc danh mục (ví dụ `rgb: true`)      | Bỏ khóa lạ khi lưu, không báo lỗi                |
