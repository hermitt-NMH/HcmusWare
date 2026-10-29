# BA – Giai đoạn 2, Tuần 5: bảng giá thu cũ đổi mới (F11)

Người phụ trách: BA · Dùng cho: Dev2 (F11, #108), Test2 (unit test giá thu), admin (nhận hàng cũ khi giao).
Phiên bản 1 – áp dụng từ 21/12/2026. User story: US-11.1 … US-11.3 trong [user-story-g2.md](user-story-g2.md).

## 1. Cách định giá

```
Giá thu 1 linh kiện = Giá gốc (bảng mục 3) × Hệ số tình trạng × Hệ số bảo hành, làm tròn XUỐNG tới 10.000 ₫
Số tiền trừ vào đơn = min(Tổng giá thu, 50% tiền hàng của shop HcmusWare trong đơn)
```

| Hệ số                    | Giá trị | Khi nào                                                                                    |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| Tình trạng **Tốt**       | 1,00    | Chạy ổn định, không trầy xước rõ, đủ phụ kiện đi kèm (VGA: đủ ốc, CPU: không bám keo cứng) |
| Tình trạng **Trầy xước** | 0,80    | Chạy ổn định nhưng trầy, ố, móp vỏ tản nhiệt, thiếu hộp                                    |
| **Còn bảo hành** hãng    | 1,00    | Tem bảo hành còn, hạn bảo hành còn **từ 3 tháng** trở lên tính tới ngày đặt hàng           |
| **Hết bảo hành**         | 0,75    | Hết hạn, còn dưới 3 tháng, hoặc không chứng minh được                                      |

**Không nhận** (giao diện không cho chọn, nhân viên từ chối khi nhận):

- Không lên hình / không khởi động, lỗi chập chờn, cháy xém.
- CPU cong hoặc gãy chân; mainboard cong chân socket.
- Đã sửa chữa, thay chip, thay nhớ VGA, mod BIOS; mất tem hoặc tem bị can thiệp.
- Linh kiện **không có trong bảng** mục 3 (đời quá cũ, hàng laptop, hàng OEM không rõ nguồn).

Vì sao chỉ 2 mức tình trạng: khách tự khai trên web, không có kỹ thuật viên kiểm tra tại chỗ. Càng nhiều mức càng dễ khai sai rồi bị tính lại khi giao hàng.

## 2. Phạm vi

| Danh mục                 | Nhận? | Lý do                                                                                                |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------- |
| CPU, VGA, Mainboard, RAM | Có    | Giữ giá tốt, dễ kiểm tra nhanh; cũng là 4 nhóm các cửa hàng lớn đang thu (GearVN, Hoàng Hà PC)       |
| SSD                      | Không | Còn dữ liệu cá nhân của khách; độ hao mòn (TBW) phải đo bằng phần mềm, không kiểm khi giao hàng được |
| Nguồn (PSU)              | Không | Rủi ro an toàn điện; hư tụ không thấy bằng mắt                                                       |
| Vỏ case, tản nhiệt       | Không | Giá trị thấp, cồng kềnh khi shipper mang về                                                          |

- Chỉ **shop HcmusWare** thu cũ (nền tảng mua lại). Shop người bán khác không tham gia, vì giai đoạn 2 chưa có chia tiền tự động cho người bán.
  Giỏ có hàng nhiều shop: giá thu chỉ trừ vào **đơn của shop HcmusWare**.
- Chỉ áp dụng khi **thanh toán khi nhận hàng (COD)**: nhân viên giao hàng kiểm tra linh kiện cũ, khách trả phần chênh lệch tại chỗ. Thanh toán online đã trả trước, nếu linh kiện không đạt sẽ không có cách thu thêm tiền.
- Chỉ đổi lên đời, **không mua lại riêng** (như GearVN): giá thu không vượt 50% tiền hàng HcmusWare trong đơn, không đổi ra tiền mặt.
- Tối đa **4 linh kiện** cũ mỗi đơn.

## 3. Bảng giá gốc (tình trạng Tốt, còn bảo hành)

Giá gốc ≈ 55–65% giá bán hàng cũ đang rao (mục 5), tức khoảng 30–50% giá hàng mới cùng đời.
Đời càng cũ thì tỷ lệ càng thấp. Đơn vị: nghìn đồng (RAM ghi rõ đồng/GB).

### CPU

| Mã         | Dòng                                                        | Giá gốc |
| ---------- | ----------------------------------------------------------- | ------: |
| `i-8-i3`   | Intel Core i3 đời 8–9 (LGA1151v2)                           |     200 |
| `i-8-i5`   | Intel Core i5 đời 8–9                                       |     500 |
| `i-8-i7`   | Intel Core i7 đời 8–9                                       |     900 |
| `i-8-i9`   | Intel Core i9 đời 9                                         |   1.200 |
| `i-10-i3`  | Intel Core i3 đời 10–11 (LGA1200)                           |     350 |
| `i-10-i5`  | Intel Core i5 đời 10–11                                     |     800 |
| `i-10-i7`  | Intel Core i7 đời 10–11                                     |   1.800 |
| `i-10-i9`  | Intel Core i9 đời 10–11                                     |   2.500 |
| `i-12-i3`  | Intel Core i3 đời 12–14 (LGA1700)                           |     900 |
| `i-12-i5`  | Intel Core i5 đời 12–14, bản không K (12400, 13400, 14400…) |   1.600 |
| `i-12-i5k` | Intel Core i5 đời 12–14, bản K/KF (12600K, 13600K, 14600K…) |   2.200 |
| `i-12-i7`  | Intel Core i7 đời 12–14                                     |   3.000 |
| `i-12-i9`  | Intel Core i9 đời 12–14                                     |   4.500 |
| `i-u-5`    | Intel Core Ultra 5 (200S, LGA1851)                          |   2.500 |
| `i-u-7`    | Intel Core Ultra 7 (200S)                                   |   4.000 |
| `i-u-9`    | Intel Core Ultra 9 (200S)                                   |   6.000 |
| `a-3-r3`   | AMD Ryzen 3 3000 (gồm 3200G, 3300X; AM4)                    |     300 |
| `a-3-r5`   | AMD Ryzen 5 3000 (3600, 3600X…)                             |     700 |
| `a-3-r7`   | AMD Ryzen 7 3000                                            |   1.100 |
| `a-3-r9`   | AMD Ryzen 9 3000                                            |   1.800 |
| `a-5-r5`   | AMD Ryzen 5 5000 (AM4)                                      |   1.100 |
| `a-5-r7`   | AMD Ryzen 7 5000 (trừ X3D)                                  |   1.900 |
| `a-5-x3d`  | AMD Ryzen 7 5700X3D / 5800X3D                               |   2.800 |
| `a-5-r9`   | AMD Ryzen 9 5000                                            |   3.000 |
| `a-7-r5`   | AMD Ryzen 5 7000 (AM5, gồm 7600X3D)                         |   1.900 |
| `a-7-r7`   | AMD Ryzen 7 7000 (trừ X3D)                                  |   3.000 |
| `a-7-x3d`  | AMD Ryzen 7 7800X3D                                         |   4.500 |
| `a-7-r9`   | AMD Ryzen 9 7000 (gồm X3D)                                  |   4.500 |
| `a-9-r5`   | AMD Ryzen 5 9000 (AM5)                                      |   2.600 |
| `a-9-r7`   | AMD Ryzen 7 9000 (trừ X3D)                                  |   3.800 |
| `a-9-x3d`  | AMD Ryzen 7 9800X3D                                         |   6.500 |
| `a-9-r9`   | AMD Ryzen 9 9000 (gồm X3D)                                  |   6.000 |

### VGA (theo chip, mọi hãng sản xuất card)

| Mã           | Chip                               | Giá gốc |
| ------------ | ---------------------------------- | ------: |
| `gtx-1650`   | GTX 1650                           |     900 |
| `gtx-1660`   | GTX 1660 / 1660 Super / 1660 Ti    |   1.300 |
| `rtx-3050`   | RTX 3050                           |   1.800 |
| `rtx-3060`   | RTX 3060                           |   3.000 |
| `rtx-3060ti` | RTX 3060 Ti                        |   4.000 |
| `rtx-3070`   | RTX 3070                           |   4.500 |
| `rtx-3070ti` | RTX 3070 Ti                        |   5.000 |
| `rtx-3080`   | RTX 3080                           |   6.000 |
| `rtx-3080ti` | RTX 3080 Ti                        |   7.000 |
| `rtx-3090`   | RTX 3090 / 3090 Ti                 |   9.000 |
| `rtx-4060`   | RTX 4060                           |   4.000 |
| `rtx-4060ti` | RTX 4060 Ti (8 GB và 16 GB)        |   5.500 |
| `rtx-4070`   | RTX 4070                           |   7.000 |
| `rtx-4070s`  | RTX 4070 Super                     |   8.000 |
| `rtx-4070ti` | RTX 4070 Ti / 4070 Ti Super        |   9.500 |
| `rtx-4080`   | RTX 4080 / 4080 Super              |  16.000 |
| `rtx-4090`   | RTX 4090                           |  30.000 |
| `rtx-5050`   | RTX 5050                           |   3.500 |
| `rtx-5060`   | RTX 5060                           |   4.500 |
| `rtx-5060ti` | RTX 5060 Ti (8 GB và 16 GB)        |   6.000 |
| `rtx-5070`   | RTX 5070                           |   8.500 |
| `rtx-5070ti` | RTX 5070 Ti                        |  12.000 |
| `rtx-5080`   | RTX 5080                           |  16.000 |
| `rtx-5090`   | RTX 5090                           |  40.000 |
| `rx-6500xt`  | Radeon RX 6500 XT                  |   1.000 |
| `rx-6600`    | Radeon RX 6600 / 6600 XT / 6650 XT |   2.000 |
| `rx-6700xt`  | Radeon RX 6700 XT / 6750 XT        |   3.000 |
| `rx-6800`    | Radeon RX 6800 / 6800 XT           |   4.500 |
| `rx-6900`    | Radeon RX 6900 XT / 6950 XT        |   5.500 |
| `rx-7600`    | Radeon RX 7600 / 7600 XT           |   3.000 |
| `rx-7700xt`  | Radeon RX 7700 XT                  |   4.500 |
| `rx-7800xt`  | Radeon RX 7800 XT / 7900 GRE       |   6.000 |
| `rx-7900xt`  | Radeon RX 7900 XT                  |   9.000 |
| `rx-7900xtx` | Radeon RX 7900 XTX                 |  12.000 |
| `rx-9060xt`  | Radeon RX 9060 XT                  |   4.500 |
| `rx-9070`    | Radeon RX 9070                     |   8.500 |
| `rx-9070xt`  | Radeon RX 9070 XT                  |  10.000 |

Không nhận: GTX 10 trở về trước, RX 500 trở về trước, card Quadro / dòng chuyên dụng.

### Mainboard (theo chipset; chỉ Gigabyte, MSI, ASUS, ASRock như GearVN)

| Mã          | Chipset                              | Giá gốc |
| ----------- | ------------------------------------ | ------: |
| `m-300-low` | Intel H310 / B360 / B365 (LGA1151v2) |     300 |
| `m-300-z`   | Intel Z370 / Z390                    |     500 |
| `m-500-low` | Intel H410 / H510 (LGA1200)          |     400 |
| `m-500-b`   | Intel B460 / B560                    |     700 |
| `m-500-z`   | Intel Z490 / Z590                    |   1.100 |
| `m-700-h`   | Intel H610 (LGA1700)                 |     800 |
| `m-700-b`   | Intel B660 / B760                    |   1.300 |
| `m-700-z`   | Intel Z690 / Z790                    |   2.200 |
| `m-800-h`   | Intel H810 (LGA1851)                 |   1.000 |
| `m-800-b`   | Intel B860                           |   1.800 |
| `m-800-z`   | Intel Z890                           |   3.000 |
| `m-am4-a`   | AMD A320 / A520 (AM4)                |     400 |
| `m-am4-b`   | AMD B450 / B550                      |     800 |
| `m-am4-x`   | AMD X570                             |   1.300 |
| `m-am5-a`   | AMD A620 (AM5)                       |     900 |
| `m-am5-b`   | AMD B650                             |   1.600 |
| `m-am5-b8`  | AMD B850                             |   2.000 |
| `m-am5-x`   | AMD X670 / X870                      |   2.800 |

### RAM (máy bàn, tính theo tổng dung lượng)

| Mã     | Loại      | Giá gốc mỗi GB | Ví dụ                      |
| ------ | --------- | -------------: | -------------------------- |
| `ddr4` | DDR4 DIMM |       30.000 ₫ | 16 GB (2×8) → 480.000 ₫    |
| `ddr5` | DDR5 DIMM |       45.000 ₫ | 32 GB (2×16) → 1.440.000 ₫ |

- Dung lượng khách chọn: 8, 16, 32, 48, 64 GB (tổng của bộ). Mỗi thanh ≥ 8 GB.
- Không nhận: DDR3 trở về trước, RAM laptop (SO-DIMM), thanh không cùng bộ khác bus / khác hãng.

## 4. Ví dụ để viết unit test (Test2, Dev2)

| #   | Khai báo                                                 | Tính                               | Kết quả                    |
| --- | -------------------------------------------------------- | ---------------------------------- | -------------------------- |
| 1   | RTX 3060, Tốt, còn BH                                    | 3.000.000 × 1 × 1                  | 3.000.000 ₫                |
| 2   | RTX 3060, Trầy xước, hết BH                              | 3.000.000 × 0,8 × 0,75             | 1.800.000 ₫                |
| 3   | Core i5 đời 12–14 không K, Trầy xước, còn BH             | 1.600.000 × 0,8                    | 1.280.000 ₫                |
| 4   | DDR5 32 GB, Tốt, hết BH                                  | 32 × 45.000 × 0,75 = 1.080.000     | 1.080.000 ₫                |
| 5   | DDR4 48 GB, Trầy xước, hết BH                            | 48 × 30.000 × 0,8 × 0,75 = 864.000 | 860.000 ₫ (làm tròn xuống) |
| 6   | Ryzen 5 3000, Trầy xước, hết BH                          | 700.000 × 0,6 = 420.000            | 420.000 ₫                  |
| 7   | Giỏ: hàng HcmusWare 5.000.000 ₫; thu RTX 3060 Tốt còn BH | min(3.000.000; 50% × 5.000.000)    | Trừ 2.500.000 ₫            |
| 8   | Giỏ chỉ có hàng shop khác                                | Không có đơn HcmusWare             | Không cho thu cũ           |
| 9   | Khai 5 linh kiện                                         | Tối đa 4                           | Báo lỗi                    |
| 10  | Chọn thanh toán online                                   | Chỉ COD                            | Ẩn thu cũ / báo lỗi        |

## 5. Nguồn tham khảo

Không cửa hàng nào công bố bảng giá thu dạng chữ (GearVN để bảng trong ảnh, các nơi khác báo giá sau khi xem máy).
Bảng trên là **giá nhóm tự đặt cho đồ án**, dựa trên:

- Điều kiện nhận / không nhận, nhóm linh kiện thu (CPU, VGA, Mainboard; mainboard chỉ Gigabyte, MSI, Asus, ASRock), chỉ áp dụng khi lên đời:
  [GearVN – Chính sách & bảng giá thu sản phẩm đã qua sử dụng](https://gearvn.com/pages/gearvn-chinh-sach-bang-gia-thu-vga-qua-su-dung),
  [GearVN – Thu cũ đổi mới](https://www.gearvn.com/pages/thu-cu-doi-moi),
  [GearVN – Thu cũ đổi mới nâng cấp VGA](https://gearvn.com/pages/thu-cu-doi-moi-nang-cap-vga).
- Yêu cầu còn bảo hành, còn tem, không sửa chữa; giá thu trừ thẳng vào sản phẩm mới:
  [Hoàng Hà PC – Quy trình thu cũ đổi mới nâng cấp PC](https://hoanghapc.vn/quy-trinh-thu-cu-doi-moi-nang-cap-pc).
- Giá bán hàng cũ (để đặt giá thu ≈ 55–65%), xem ngày 29/10/2026 trên [hangcu.gearvn.com](https://hangcu.gearvn.com/):
  i5-12400F 2.500.000 ₫, i3-12100 1.990.000 ₫, i7-10700K 3.490.000 ₫, i7-9700 1.990.000 ₫,
  RTX 3060 Ti 6.990.000 ₫, RTX 3080 10.490.000 ₫, B560M 1.490.000 ₫, B360M 890.000 ₫.
- Giá hàng mới: giá trong catalog HcmusWare và [Hacom – i5-12400F](https://hacom.vn/cpu-intel-core-i5-12400f) (3.599.000 ₫).

Cập nhật bảng: admin/BA sửa file dữ liệu trong code qua Pull Request (giống `specFields.js`), ghi ngày áp dụng mới ở đầu file này.
Giá thu đã chốt trong đơn **không đổi** khi bảng được cập nhật sau đó.
