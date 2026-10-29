// Số liệu cho F09 – ước tính hiệu năng (dùng bởi performance.js). BA nhập Tuần 3 giai đoạn 2:
// "bảng điểm hiệu năng CPU và GPU cho 10 game từ nguồn công khai, ghi nguồn".
// Giải thích cách chọn số, linh kiện còn thiếu và cách cập nhật: docs/g2-ba-tuan3-hieu-nang.md.
//
// Cách điền (mọi số phải có nguồn trong `sources`; không tự ước lượng):
// - reference: CPU và VGA của cấu hình đo trong bài benchmark dùng làm gốc (điểm = 100).
// - cpus / gpus: điểm chơi game TƯƠNG ĐỐI so với linh kiện tham chiếu (vd 7600X nhanh hơn 7600 8% → 108).
//   Khóa CPU = tên sản phẩm bỏ "AMD"/"Intel" (cpuKey), khóa VGA = chipset bỏ "GeForce"/"Radeon" và
//   dung lượng (chipKey) – phải khớp tên sản phẩm trên web, không khớp thì Builder báo "chưa có số liệu".
// - games: 10 game; fps = FPS trung bình của cấu hình tham chiếu ở từng độ phân giải (cùng mức đồ họa,
//   ghi rõ trong preset); cpuFps = FPS CPU tham chiếu đạt được khi VGA không giới hạn (bài test CPU ở 720p
//   với VGA rất mạnh). source = nguồn của fps, cpuSource = nguồn của cpuFps (id trong sources).
//
// Bảng còn trống thì Builder hiện "Chưa có số liệu ước tính" (estimatePerformance trả status 'no-data').
export const PERF_DATA = {
  // Hệ thống test VGA của TechPowerUp (GPU 2025.2): Ryzen 7 9800X3D + DDR5-6200.
  // VGA gốc là RTX 5060 Ti 16 GB (không phải RTX 5060 8 GB): bản 8 GB thiếu VRAM ở 4K (Stalker 2 chỉ 4 FPS),
  // lấy làm gốc thì mọi VGA khác bị nhân theo con số sụt đó.
  reference: { cpu: 'Ryzen 7 9800X3D', gpu: 'RTX 5060 Ti' },
  sources: [
    {
      id: 's1',
      name: 'TechPowerUp – MSI GeForce RTX 5060 Gaming OC Review (07/2025)',
      url: 'https://www.techpowerup.com/review/msi-geforce-rtx-5060-gaming-oc/',
      note: 'FPS từng game của RTX 5060 Ti 16 GB; điểm VGA theo biểu đồ Relative Performance 2560x1440',
    },
    {
      id: 's2',
      name: 'TechPowerUp – AMD Ryzen 7 9800X3D Review (11/2024)',
      url: 'https://www.techpowerup.com/review/amd-ryzen-7-9800x3d/',
      note: 'Điểm CPU theo Relative Performance Games 1280x720 (RTX 4090); FPS CPU Hogwarts Legacy, Elden Ring',
    },
    {
      id: 's3',
      name: 'TechPowerUp – AMD Ryzen 9 9950X3D Review (03/2025)',
      url: 'https://www.techpowerup.com/review/amd-ryzen-9-9950x3d/',
      note: 'Điểm Ryzen 9 9950X3D so với 9800X3D (Games 1280x720, RTX 5090)',
    },
    {
      id: 's4',
      name: 'TechPowerUp – Intel Core Ultra 5 250K Plus Review (2026)',
      url: 'https://www.techpowerup.com/review/intel-core-ultra-5-250k-plus/',
      note: 'FPS CPU của Ryzen 7 9800X3D ở 1280x720 cho 8 game',
    },
    {
      id: 's5',
      name: 'TechPowerUp – NVIDIA GeForce RTX 4070 Founders Edition Review (04/2023)',
      url: 'https://www.techpowerup.com/review/nvidia-geforce-rtx-4070-founders-edition/',
      note: 'RTX 3080 Ti, RX 6600 XT, RX 6500 XT (s1 không có), quy đổi qua RTX 3080 và RTX 3060 12 GB',
    },
    {
      id: 's6',
      name: 'TechPowerUp News – Ryzen 5 7600X3D Beats Ryzen 7 9700X at Gaming (09/2024, số liệu PCGH)',
      url: 'https://www.techpowerup.com/326342/amd-ryzen-5-7600x3d-beats-ryzen-7-9700x-zen-5-at-gaming',
      note: '7600X3D chậm hơn 7800X3D khoảng 9% trong game',
    },
  ],
  // Gốc: Ryzen 7 9800X3D = 100 (s2). Bản F/KF dùng số của bản cùng chip trong bài test (xem tài liệu).
  cpus: {
    'Ryzen 7 9800X3D': 100,
    'Ryzen 9 9950X3D': 94, // s3: 100 / 106,8
    'Core i9-13900F': 87, // = Core i9-13900K (87,0), xung tối đa thấp hơn 200 MHz
    'Ryzen 7 9700X': 84,
    'Ryzen 5 7600X3D': 84, // s6: 7800X3D (92,7) × 0,91
    'Ryzen 5 7600X': 78,
    'Core i5-13600KF': 78, // = Core i5-13600K
    'Core i9-12900F': 78, // = Core i9-12900K (77,7), xung tối đa thấp hơn 100 MHz
    'Core Ultra 5 245KF': 77, // = Core Ultra 5 245K
    'Ryzen 5 7600': 76,
    'Core i5-12600KF': 69, // = Core i5-12600K
    'Core i5-12400': 64, // = Core i5-12400F
    'Core i3-14100F': 60, // = Core i3-14100
    'Ryzen 5 3600X': 50, // = Ryzen 5 3600 (50,4), xung tối đa cao hơn 200 MHz
  },
  // Gốc: RTX 5060 Ti 16 GB = 117% trong biểu đồ 1440p của s1 → điểm = % / 117 × 100.
  gpus: {
    'RTX 5080': 190,
    'RTX 5070 Ti': 170,
    'RX 9070 XT': 164,
    'RX 7900 XT': 150,
    'RTX 5070': 138,
    'RTX 3080 Ti': 130, // s5: 1,11 × RTX 3080
    'RTX 3080': 117,
    'RTX 5060 Ti': 100,
    'RTX 4060 Ti': 86, // bản 8 GB
    'RTX 5060': 83,
    'RTX 4060': 66,
    'RX 6600 XT': 62, // s5: 54 / 52 × RTX 3060
    'RTX 3060': 60, // bản 12 GB; bản 8 GB chậm hơn nhưng cùng khóa chipKey
    'RX 6500 XT': 23, // s5: 20 / 52 × RTX 3060
  },
  // fps: RTX 5060 Ti 16 GB + 9800X3D, mức đồ họa cao nhất, không DLSS/FSR, không ray tracing (s1).
  games: [
    {
      id: 'cs2',
      name: 'Counter-Strike 2',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 303.7, '1440p': 204.1, '4k': 106.8 },
      cpuFps: 760.3,
    },
    {
      id: 'cyberpunk-2077',
      name: 'Cyberpunk 2077',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 114.1, '1440p': 76.8, '4k': 35.1 },
      cpuFps: 255.6,
    },
    {
      id: 'elden-ring',
      name: 'Elden Ring',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's2',
      fps: { '1080p': 146.7, '1440p': 109.5, '4k': 61.7 },
      cpuFps: 205.3,
    },
    {
      id: 'baldurs-gate-3',
      name: "Baldur's Gate 3",
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 136.7, '1440p': 100.0, '4k': 52.8 },
      cpuFps: 209.5,
    },
    {
      id: 'hogwarts-legacy',
      name: 'Hogwarts Legacy',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's2',
      fps: { '1080p': 84.6, '1440p': 60.5, '4k': 33.6 },
      cpuFps: 369.2,
    },
    {
      id: 'spider-man-2',
      name: "Marvel's Spider-Man 2",
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 104.1, '1440p': 73.0, '4k': 38.9 },
      cpuFps: 223.1,
    },
    {
      id: 'kingdom-come-2',
      name: 'Kingdom Come: Deliverance II',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 104.2, '1440p': 71.8, '4k': 37.6 },
      cpuFps: 264.8,
    },
    {
      id: 'alan-wake-2',
      name: 'Alan Wake 2',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 75.0, '1440p': 54.1, '4k': 30.5 },
      cpuFps: 229.2,
    },
    {
      id: 'starfield',
      name: 'Starfield',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 73.6, '1440p': 57.8, '4k': 35.4 },
      cpuFps: 203.1,
    },
    {
      id: 'stalker-2',
      name: 'S.T.A.L.K.E.R. 2',
      preset: 'Cao nhất',
      source: 's1',
      cpuSource: 's4',
      fps: { '1080p': 69.1, '1440p': 49.6, '4k': 27.8 },
      cpuFps: 102.2,
    },
  ],
}
