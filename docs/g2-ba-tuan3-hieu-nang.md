# BA – Giai đoạn 2, Tuần 3: bảng điểm hiệu năng CPU và GPU (F09)

Người phụ trách: BA · Dùng cho: Dev2 (F09 ước tính FPS, giao diện ở Tuần 4), Test2 (unit test F09).
Phiên bản 1 – Tuần 3 giai đoạn 2. Số liệu nằm ở `src/features/builder/perfData.js`.

## 1. Nguồn đã chọn

Toàn bộ số liệu lấy từ **TechPowerUp** (techpowerup.com). Lý do chọn:

- Một hệ thống test cố định cho mọi VGA (Ryzen 7 9800X3D, DDR5-6200), đo bằng cảnh chơi tự chọn, không dùng benchmark có sẵn trong game.
- Mỗi bài có FPS **từng game** ở 1080p, 1440p, 4K và biểu đồ hiệu năng tương đối, đúng thứ mô hình F09 cần.
- Bài test CPU đo ở 720p với VGA mạnh nhất, nên ra được FPS khi VGA không giới hạn (`cpuFps`).

| Id  | Bài                                                                                                                                                                                       | Lấy gì                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| s1  | [MSI GeForce RTX 5060 Gaming OC Review](https://www.techpowerup.com/review/msi-geforce-rtx-5060-gaming-oc/) (07/2025)                                                                     | FPS 10 game của VGA gốc; điểm VGA (Relative Performance 2560x1440)                             |
| s2  | [AMD Ryzen 7 9800X3D Review](https://www.techpowerup.com/review/amd-ryzen-7-9800x3d/) (11/2024)                                                                                           | Điểm CPU (Relative Performance Games 1280x720, RTX 4090); `cpuFps` Hogwarts Legacy, Elden Ring |
| s3  | [AMD Ryzen 9 9950X3D Review](https://www.techpowerup.com/review/amd-ryzen-9-9950x3d/) (03/2025)                                                                                           | Ryzen 9 9950X3D so với 9800X3D                                                                 |
| s4  | [Intel Core Ultra 5 250K Plus Review](https://www.techpowerup.com/review/intel-core-ultra-5-250k-plus/) (2026)                                                                            | `cpuFps` của 9800X3D ở 720p cho 8 game còn lại                                                 |
| s5  | [NVIDIA GeForce RTX 4070 Founders Edition Review](https://www.techpowerup.com/review/nvidia-geforce-rtx-4070-founders-edition/) (04/2023)                                                 | RTX 3080 Ti, RX 6600 XT, RX 6500 XT (s1 không có)                                              |
| s6  | [TechPowerUp News: Ryzen 5 7600X3D Beats Ryzen 7 9700X at Gaming](https://www.techpowerup.com/326342/amd-ryzen-5-7600x3d-beats-ryzen-7-9700x-zen-5-at-gaming) (09/2024, số liệu của PCGH) | Ryzen 5 7600X3D chậm hơn 7800X3D khoảng 9%                                                     |

## 2. Cấu hình gốc

**Ryzen 7 9800X3D + RTX 5060 Ti 16 GB**, mức đồ họa cao nhất, không DLSS/FSR, không ray tracing.

Không lấy RTX 5060 8 GB làm gốc dù web đang bán nó: ở 4K bản 8 GB thiếu VRAM, Stalker 2 chỉ còn 4 FPS
(RTX 5060 Ti 16 GB được 27,8 FPS). Mô hình nhân FPS gốc với điểm VGA, nên một con số sụt như vậy sẽ kéo sai
mọi VGA khác. RTX 5060 Ti 16 GB nằm trong cùng biểu đồ, cùng hệ thống test.

## 3. 10 game

| Game                         | 1080p | 1440p | 4K    | `cpuFps` (9800X3D, 720p) |
| ---------------------------- | ----- | ----- | ----- | ------------------------ |
| Counter-Strike 2             | 303,7 | 204,1 | 106,8 | 760,3 (s4)               |
| Cyberpunk 2077               | 114,1 | 76,8  | 35,1  | 255,6 (s4)               |
| Elden Ring                   | 146,7 | 109,5 | 61,7  | 205,3 (s2)               |
| Baldur's Gate 3              | 136,7 | 100,0 | 52,8  | 209,5 (s4)               |
| Hogwarts Legacy              | 84,6  | 60,5  | 33,6  | 369,2 (s2)               |
| Marvel's Spider-Man 2        | 104,1 | 73,0  | 38,9  | 223,1 (s4)               |
| Kingdom Come: Deliverance II | 104,2 | 71,8  | 37,6  | 264,8 (s4)               |
| Alan Wake 2                  | 75,0  | 54,1  | 30,5  | 229,2 (s4)               |
| Starfield                    | 73,6  | 57,8  | 35,4  | 203,1 (s4)               |
| S.T.A.L.K.E.R. 2             | 69,1  | 49,6  | 27,8  | 102,2 (s4)               |

Cột FPS lấy từ s1. Chọn 10 game có mặt ở **cả** bài test VGA và bài test CPU, ưu tiên game phổ biến
(CS2, Cyberpunk, Elden Ring...) và có cả game nặng CPU (Stalker 2, Baldur's Gate 3) để cảnh báo nghẽn có ý nghĩa.

## 4. Điểm linh kiện

### VGA (RTX 5060 Ti 16 GB = 100)

Điểm = % trong biểu đồ 1440p của s1 ÷ 117 × 100. Dùng 1440p chứ không dùng 1080p vì ở 1080p các VGA mạnh
đã bị CPU giữ lại (RTX 5090 chỉ hơn RTX 5060 khoảng 2,5 lần), điểm sẽ thấp hơn sức thật.

| VGA         | Điểm | Ghi chú                        |
| ----------- | ---- | ------------------------------ |
| RTX 5080    | 190  |                                |
| RTX 5070 Ti | 170  |                                |
| RX 9070 XT  | 164  |                                |
| RX 7900 XT  | 150  |                                |
| RTX 5070    | 138  |                                |
| RTX 3080 Ti | 130  | s5: nhanh hơn RTX 3080 11%     |
| RTX 3080    | 117  |                                |
| RTX 4060 Ti | 86   | bản 8 GB                       |
| RTX 5060    | 83   |                                |
| RTX 4060    | 66   |                                |
| RX 6600 XT  | 62   | s5: quy đổi qua RTX 3060 12 GB |
| RTX 3060    | 60   | bản 12 GB                      |
| RX 6500 XT  | 23   | s5: quy đổi qua RTX 3060 12 GB |

### CPU (Ryzen 7 9800X3D = 100)

Lấy từ biểu đồ Games 1280x720 của s2, trừ chỗ ghi khác.

| CPU                | Điểm | Ghi chú                             |
| ------------------ | ---- | ----------------------------------- |
| Ryzen 9 9950X3D    | 94   | s3                                  |
| Core i9-13900F     | 87   | **dùng số i9-13900K**, xem mục 5    |
| Ryzen 7 9700X      | 84   |                                     |
| Ryzen 5 7600X3D    | 84   | s6: 7800X3D (92,7) × 0,91           |
| Ryzen 5 7600X      | 78   |                                     |
| Core i5-13600KF    | 78   | = i5-13600K                         |
| Core i9-12900F     | 78   | **dùng số i9-12900K**, xem mục 5    |
| Core Ultra 5 245KF | 77   | = Ultra 5 245K                      |
| Ryzen 5 7600       | 76   |                                     |
| Core i5-12600KF    | 69   | = i5-12600K                         |
| Core i5-12400      | 64   | = i5-12400F                         |
| Core i3-14100F     | 60   | = i3-14100                          |
| Ryzen 5 3600X      | 50   | **dùng số Ryzen 5 3600**, xem mục 5 |

Bản KF/F và bản có iGPU (12400 / 12400F, 14100 / 14100F) là cùng một chip, chỉ khác có hay không có
nhân đồ họa, nên dùng chung số.

## 5. Giới hạn cần biết

**Số thay thế (gần đúng).** Ba CPU không có trong bài test nào, dùng số của bản cùng chip:
i9-13900F ← i9-13900K (xung tối đa thấp hơn 200 MHz), i9-12900F ← i9-12900K (thấp hơn 100 MHz),
Ryzen 5 3600X ← Ryzen 5 3600 (cao hơn 200 MHz). Sai số dự kiến vài %, nhỏ hơn nhiều so với sai số của chính mô hình.

**Chưa có số liệu** (Builder hiện "chưa có số liệu" khi chọn): **Core i5-14500, Core Ultra 5 235, Ryzen 3 3200G**.
TechPowerUp không test 3 mẫu này và không có bản cùng chip trong bài test. Không tự đoán.

**7600X3D:** các nguồn chênh nhau, chậm hơn 7800X3D từ 3% đến 9% tùy bộ game (Tom's Hardware đo 4,5%).
Bảng lấy 9% (thận trọng); nếu theo Tom's Hardware thì điểm là 89.

**Các điểm khác:**

- VRAM: mô hình không tính VRAM. VGA 8 GB ở 4K có thể thấp hơn số ước tính nhiều (xem Stalker 2 ở mục 2).
- Starfield ở 720p mọi CPU đều quanh 203 FPS (VGA đã là giới hạn), nên `cpuFps` của game này là mức tối thiểu; Builder có thể báo nghẽn CPU ở Starfield nhiều hơn thực tế.
- Elden Ring bản gốc khóa 60 FPS; TechPowerUp đo với khóa đã gỡ. Giao diện nên ghi chú điều này.
- RTX 3060 8 GB và 12 GB cùng khóa `RTX 3060` (hàm `chipKey` bỏ dung lượng), nên bản 8 GB đang dùng điểm bản 12 GB và sẽ được ước tính cao hơn thực tế.
- Kiểm tra nhanh: Ryzen 5 7600 + RTX 4060 ra Cyberpunk 2077 1080p = 75 FPS; TechPowerUp đo RTX 4060 với 9800X3D được 77,8 FPS.

**Gợi ý cho Dev2 (Tuần 4):** cấu hình phổ thông Ryzen 5 7600 + RTX 4060 đang bị báo "VGA yếu so với CPU,
59% sức mạnh CPU không dùng tới". Về số liệu thì đúng, nhưng đây là cặp hợp lý cho 1080p; nên cân nhắc nới
ngưỡng `GPU_BOTTLENECK_BELOW` hoặc đổi câu chữ để khách không hiểu là cấu hình bị sai.

## 6. Cập nhật khi có linh kiện mới

1. Tìm linh kiện trong biểu đồ Relative Performance của bài s1 (VGA) hoặc s2 (CPU). Không có thì tìm bài review TechPowerUp mới hơn có cả linh kiện đó **và** một linh kiện đã có trong bảng, rồi quy đổi qua linh kiện chung.
2. Thêm vào `cpus` / `gpus` trong `perfData.js` với khóa đúng tên trên web (bỏ "AMD"/"Intel", bỏ "GeForce"/"Radeon" và dung lượng), ghi nguồn bằng chú thích; nguồn mới thì thêm vào `sources`.
3. Chạy `npx vitest run src/features/builder` rồi tạo Pull Request.
