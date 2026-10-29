// Số liệu cho F09 – ước tính hiệu năng (dùng bởi performance.js). BA nhập Tuần 3 giai đoạn 2:
// "bảng điểm hiệu năng CPU và GPU cho 10 game từ nguồn công khai, ghi nguồn".
//
// Cách điền (mọi số phải có nguồn trong `sources`; không tự ước lượng):
// - reference: CPU và VGA của cấu hình đo trong bài benchmark dùng làm gốc (điểm = 100).
// - cpus / gpus: điểm chơi game TƯƠNG ĐỐI so với linh kiện tham chiếu (vd 7600X nhanh hơn 7600 8% → 108).
//   Khóa CPU = tên sản phẩm bỏ "AMD"/"Intel" (cpuKey), khóa VGA = chipset bỏ "GeForce"/"Radeon" và
//   dung lượng (chipKey) – phải khớp tên sản phẩm trên web, không khớp thì Builder báo "chưa có số liệu".
// - games: 10 game; fps = FPS trung bình của cấu hình tham chiếu ở từng độ phân giải (cùng mức đồ họa,
//   ghi rõ trong preset); cpuFps = FPS CPU tham chiếu đạt được khi VGA không giới hạn (bài test CPU ở 1080p
//   với VGA rất mạnh). source = id trong sources.
//
// Ví dụ một dòng game (số minh họa, KHÔNG phải số đo):
//   { id: 'cs2', name: 'Counter-Strike 2', preset: 'High', source: 's1',
//     fps: { '1080p': 0, '1440p': 0, '4k': 0 }, cpuFps: 0 }
//
// Bảng còn trống thì Builder hiện "Chưa có số liệu ước tính" (estimatePerformance trả status 'no-data').
export const PERF_DATA = {
  reference: { cpu: '', gpu: '' },
  sources: [],
  cpus: {},
  gpus: {},
  games: [],
}
