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
- Bộ dữ liệu không có chiều dài VGA tối đa của case và socket tản nhiệt hỗ trợ. **15 case và 15 tản nhiệt đang bán đã được BA điền số đo hãng công bố** trong `data/overrides.json` (bảng dưới, kiểm tra 18/10/2026), nên không còn trường ước lượng.
- Sản phẩm mới thêm sau này chưa có trong `overrides.json` sẽ quay về giá trị ước lượng (case theo loại vỏ: Mini ITX Tower 320, MicroATX Mini Tower 330, MicroATX Mid Tower 350, ATX Mid Tower 360, ATX Full Tower 400 mm; tản mặc định AM4/AM5/LGA1700/LGA1851) và hiện cảnh báo W5. Cách ghi đè: `"NZXT H3 Flow": { "max_gpu_length_mm": 365 }`, khóa là tên sản phẩm gốc, rồi chạy lại `npm run import-data`.
- **LGA1851 dùng chung ngàm tản với LGA1700** (Intel giữ nguyên lỗ bắt tản). Tản hãng chỉ ghi LGA1700 vì ra đời trước Core Ultra 200 vẫn được tính là hỗ trợ LGA1851.

### Số đo hãng công bố

Chiều dài VGA tối đa của case (mm). Con số tính khi lắp đủ quạt mặc định trừ khi có ghi chú.

| Case                            | VGA tối đa | Ghi chú                                   |
| ------------------------------- | ---------- | ----------------------------------------- |
| Zalman CUBIX                    | 260        | Không nhầm với CUBIX-G (280 mm)           |
| Zalman i4                       | 320        |                                           |
| Zalman Z7 NEO                   | 355        |                                           |
| Montech AIR 100 LITE            | 330        |                                           |
| Silverstone FARA H1M            | 320        | Khi không lắp quạt trước                  |
| Antec C3 ARGB                   | 415        |                                           |
| be quiet! Pure Base 501 Airflow | 368        |                                           |
| Silverstone RV05B               | 312        | Hãng ghi 12,3 inch                        |
| Lian Li LANCOOL 217             | 380        |                                           |
| Silverstone SETA A1             | 350        |                                           |
| Cougar Gemini M                 | 330        | Theo brochure của hãng                    |
| be quiet! Light Base 600 LX     | 400        |                                           |
| NZXT H7 Elite (2022)            | 400        | Khi không lắp quạt/két nước mặt trước     |
| Cougar MX660-T RGB              | 350        | Bản Iron RGB / Mesh RGB-L là 410 mm, khác |
| HYTE Y70 Silver Wolf            | 422        | VGA luôn lắp dựng đứng (riser có sẵn)     |

Socket tản nhiệt hỗ trợ (chỉ ghi các socket web đang bán: AM4, AM5, LGA1700, LGA1851).

| Tản nhiệt                                       | Socket                     | Ghi chú                                                        |
| ----------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| ARCTIC Freezer 36                               | AM4, AM5, LGA1700, LGA1851 | Thay Deepcool THETA 20 PWM (19/10/2026), theo arctic.de        |
| Cooler Master Hyper 212 Halo                    | AM4, AM5, LGA1700, LGA1851 | Thay Hyper 212 EVO bản gốc (19/10/2026), theo coolermaster.com |
| Thermalright Burst Assassin 120 SE ARGB         | AM4, AM5, LGA1700, LGA1851 |                                                                |
| APNX AP1-V                                      | AM4, AM5, LGA1700, LGA1851 | Hãng ghi LGA1700                                               |
| Thermalright Peerless Assassin 120 SE ARGB      | AM4, AM5, LGA1700, LGA1851 | LGA1851 có trong bản V2                                        |
| Thermalright Peerless Assassin 120 Digital ARGB | AM4, AM5, LGA1700, LGA1851 |                                                                |
| Jonsbo CR-1000 V2 Color                         | AM4, AM5, LGA1700, LGA1851 |                                                                |
| Mars Gaming MCPU-XT                             | AM4, AM5, LGA1700, LGA1851 | Hãng ghi LGA1700                                               |
| Xilence M906                                    | AM4, AM5, LGA1700, LGA1851 |                                                                |
| GAMDIAS CHIONE E4                               | AM4, AM5, LGA1700, LGA1851 |                                                                |
| Thermalright Mjolnir Vision 360 ARGB            | AM4, AM5, LGA1700, LGA1851 |                                                                |
| Cooler Master Hyper H410R RGB                   | AM4, AM5, LGA1700, LGA1851 | Bao bì mới (RR-H410-20PC-R1) mới kèm kit LGA1700/AM5           |
| Enermax LIQMAX III 360 ARGB                     | AM4, AM5, LGA1700, LGA1851 | Hãng ghi LGA1700                                               |
| Corsair iCUE LINK TITAN 360 RX RGB              | AM4, AM5, LGA1700, LGA1851 |                                                                |
| Cooler Master MasterLiquid 360 Ion              | AM4, AM5, LGA1700, LGA1851 | Hãng ghi LGA1700                                               |

Deepcool THETA 20 PWM (chỉ LGA115x/1200) và Cooler Master Hyper 212 EVO bản gốc (LGA775–2011, AM2–AM3+) không lắp được CPU nào web bán nên đã bỏ khỏi danh sách ngày 19/10/2026.

## Datasheet

Link "Tải datasheet" ở trang chi tiết lấy từ `data/datasheets.json` (tên sản phẩm → link). Chỉ ghi link **trên web chính hãng**, đã mở thử và thấy đúng model; ưu tiên file PDF thông số, không có thì dùng trang thông số của hãng. Không lấy link trang bán lẻ, không tự đoán link.

- RAM và SSD: tên trong bộ dữ liệu không ghi mã kit, nên khi không xác định được đúng mã thì dùng trang dòng sản phẩm của hãng (có bảng thông số mọi dung lượng/bus).
- CPU AMD Ryzen 3000 (3200G, 3600X): AMD đã chuyển trang thông số sang trang hỗ trợ, link trỏ tới đó.
- XFX RX 9070 XT Mercury OC Magnetic Air RGB: trang hãng không ghi "V2", cần BA đối chiếu lại tên trong bộ dữ liệu.
- Chưa có datasheet (hãng không có trang chính thức hoặc đã gỡ): G.Skill Ripjaws 16 GB DDR4-3000 (dữ liệu không ghi là Ripjaws V hay 4), Antec NE1000G/NE1300G M ATX3.0 (link PDF trên web Antec bị hỏng, trang hãng chỉ còn bản ATX 3.1), Zalman CUBIX, Zalman i4, APNX AP1-V, Cooler Master Hyper H410R RGB (đã ngừng bán).
