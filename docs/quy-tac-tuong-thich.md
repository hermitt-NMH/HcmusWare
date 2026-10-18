# Quy tắc tương thích – Build PC

Người phụ trách: BA · Dùng cho: Dev2 + KTS (`src/features/builder/compatibility.js`), Test1/Test2 (test case).
Phiên bản 1 – 18/10/2026.

## Đầu vào và đầu ra

Hàm `checkCompatibility(build)` nhận cấu hình đang chọn, mỗi linh kiện là một dòng của bảng `products`
(dùng `specs`), linh kiện chưa chọn là `null`:

```js
{ cpu, mainboard, ram, ramQty /* 1–2 kit */, vga, ssd, psu, case, cooler }
```

Trả về:

```js
{
  errors:   [{ rule: 'R1', message: 'CPU socket AM5 không lắp được mainboard socket LGA1700', parts: ['cpu', 'mainboard'] }],
  warnings: [{ rule: 'W2', message: '...', parts: ['psu', 'case'] }],
  totalPowerW: 280,       // công suất ước tính
  recommendedPsuW: 400,   // PSU đề xuất
  complete: false,        // đã chọn đủ linh kiện bắt buộc chưa
}
```

- **Lỗi (error):** lắp không được hoặc máy không chạy. Builder tô đỏ và không cho thêm cấu hình vào giỏ.
- **Cảnh báo (warning):** vẫn mua được nhưng khách nên kiểm tra lại. Builder tô vàng.
- Một quy tắc chỉ chạy khi đã chọn đủ các linh kiện nó cần. Linh kiện chưa chọn thì bỏ qua quy tắc, không báo lỗi.
- Thiếu thông số (giá trị `null`) thì không báo lỗi, chỉ ra cảnh báo W5.

## Quy tắc lỗi

| Mã  | Linh kiện            | Điều kiện hợp lệ                                                | Thông báo khi sai                                                          |
| --- | -------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R1  | CPU – Mainboard      | `cpu.socket === mainboard.socket`                               | CPU socket {cpu.socket} không lắp được mainboard socket {mainboard.socket} |
| R2  | RAM – Mainboard      | `ram.ram_type === mainboard.ram_type`                           | Mainboard chỉ nhận {mainboard.ram_type}, RAM đang chọn là {ram.ram_type}   |
| R3  | RAM – Mainboard      | `ram.modules × ramQty ≤ mainboard.ram_slots`                    | Cần {n} khe RAM nhưng mainboard chỉ có {ram_slots} khe                     |
| R4  | RAM – Mainboard      | `ram.capacity_gb × ramQty ≤ mainboard.max_ram_gb`               | Tổng {n} GB vượt mức tối đa {max_ram_gb} GB của mainboard                  |
| R5  | Mainboard – Case     | `case.form_factors` chứa `mainboard.form_factor`                | Case {case_type} không vừa mainboard {form_factor}                         |
| R6  | VGA – Case           | `vga.length_mm ≤ case.max_gpu_length_mm` (bằng nhau vẫn hợp lệ) | VGA dài {length} mm, case chỉ chứa tối đa {max} mm                         |
| R7  | CPU – Tản nhiệt      | `cooler.sockets` chứa `cpu.socket`                              | Tản nhiệt không hỗ trợ socket {cpu.socket}                                 |
| R8  | PSU – Tổng công suất | `psu.wattage_w ≥ totalPowerW`                                   | Nguồn {wattage} W không đủ, cấu hình cần khoảng {total} W                  |
| R9  | CPU – VGA            | Nếu `cpu.igpu === false` thì phải chọn VGA                      | CPU không có nhân đồ họa, cần chọn VGA để xuất hình                        |

## Quy tắc cảnh báo

| Mã  | Linh kiện        | Khi nào cảnh báo                                                           | Thông báo                                                                     |
| --- | ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| W1  | PSU              | `totalPowerW ≤ psu.wattage_w < recommendedPsuW`                            | Nguồn đủ nhưng sát mức, nên chọn từ {recommended} W                           |
| W2  | PSU – Case       | PSU `SFX` trong case không phải Mini ITX                                   | Nguồn SFX cần thêm bracket chuyển sang ATX                                    |
| W3  | PSU – Case       | PSU `ATX` trong case `Mini ITX Tower`                                      | Kiểm tra case có hỗ trợ nguồn ATX không                                       |
| W4  | Tản nhiệt – Case | `cooler.radiator_mm ≥ 360` và case loại `MicroATX ...` hoặc `Mini ITX ...` | Kiểm tra case có chỗ lắp két nước {radiator} mm không                         |
| W5  | Bất kỳ           | Thông số cần cho R1–R8 là `null`, hoặc nằm trong `specs.estimated`         | Thông số {tên} của {sản phẩm} là ước lượng / chưa có, hãy kiểm tra trang hãng |

## Công suất

```
totalPowerW     = cpu.tdp_w + (vga?.tdp_w ?? 0) + 100      // 100 W: mainboard, RAM, SSD, quạt
recommendedPsuW = làm tròn LÊN bội số 50 của (totalPowerW × 1,3)
```

Ví dụ: Ryzen 5 7600 (65 W) + RTX 4060 (115 W) → total 280 W → 280 × 1,3 = 364 → đề xuất **400 W**.

## Đủ cấu hình (`complete`)

Bắt buộc: CPU, mainboard, RAM, SSD, PSU, case, tản nhiệt. VGA bắt buộc khi CPU không có nhân đồ họa (R9).
Chỉ được thêm cả cấu hình vào giỏ khi `complete === true` và `errors` rỗng.

## Lọc linh kiện trong Builder (chỉ hiện linh kiện hợp lệ)

Khi đã chọn CPU: danh sách mainboard chỉ hiện cùng socket (R1), tản nhiệt chỉ hiện loại hỗ trợ socket đó (R7).
Khi đã chọn mainboard: RAM chỉ hiện đúng chuẩn (R2), case chỉ hiện loại vừa kích thước (R5).
Các quy tắc còn lại vẫn chạy khi chọn để báo lỗi.

## Nguồn thông số và giới hạn

- Thông số lấy từ PC Part Dataset (MIT, cập nhật 3/2024). Socket CPU và chuẩn RAM của mainboard LGA1700 được suy ra từ tên.
- Công suất VGA lấy theo thông số tham chiếu của NVIDIA/AMD/Intel cho từng chipset; bản OC của hãng có thể cao hơn 10–20 W.
- **Đang ước lượng (BA tự ước lượng theo loại sản phẩm; muốn chỉnh riêng sản phẩm nào thì ghi vào `data/overrides.json`):**
  - `case.max_gpu_length_mm`: ước theo loại vỏ (Mini ITX Tower 320, MicroATX Mini Tower 330, MicroATX Mid Tower 350, ATX Mid Tower 360, ATX Full Tower 400 mm).
  - `cooler.sockets`: mặc định AM4/AM5/LGA1700/LGA1851; Noctua đuôi `i` chỉ Intel, đuôi `a` chỉ AMD.
- Ví dụ ghi đè: `"NZXT H3 Flow": { "max_gpu_length_mm": 365 }`. Chạy lại `npm run import-data`, trường đã ghi đè tự hết là "ước lượng".
