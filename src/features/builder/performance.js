// F09 – Ước tính hiệu năng (Giai đoạn 2). HÀM THUẦN: không gọi mạng, không đọc state React.
// Vào: CPU + VGA đang chọn trong Builder và bảng số liệu (perfData.js, BA thu thập từ nguồn công khai).
// Ra: FPS DỰ KIẾN cho từng game ở 1080p / 1440p / 4K và cảnh báo nghẽn cổ chai CPU–GPU.
// Mọi con số là ƯỚC TÍNH (giao diện phải ghi rõ và hiện nguồn tham khảo – data.sources).
//
// Mô hình (đơn giản, giải thích được khi bảo vệ):
// - Mỗi game có FPS đo được với cấu hình tham chiếu (data.reference) ở từng độ phân giải: game.fps,
//   và FPS tối đa CPU tham chiếu đẩy được khi VGA không giới hạn (đo ở độ phân giải thấp): game.cpuFps.
// - Linh kiện khác được quy đổi theo điểm tương đối (linh kiện tham chiếu = 100):
//     giới hạn của VGA = game.fps[res] × điểm VGA / 100
//     giới hạn của CPU = game.cpuFps    × điểm CPU / 100   (gần như không đổi theo độ phân giải)
//   FPS dự kiến = giới hạn nhỏ hơn; linh kiện cho giới hạn nhỏ hơn là linh kiện "giữ chân" khung hình.

import { chipKey } from './budget'

export const RESOLUTIONS = ['1080p', '1440p', '4k']
export const RESOLUTION_LABELS = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// Ngưỡng cảnh báo nghẽn ở 1080p (độ phân giải CPU dễ nghẽn nhất):
// CPU chỉ cho VGA chạy dưới 85% sức → cảnh báo CPU.
// Không báo "VGA yếu" (BUG-G2T3-03): cpuFps đo ở 720p không giới hạn VGA nên gần như mọi cấu hình
// đều có VGA là giới hạn – đó là trạng thái bình thường khi chơi game, kể cả cấu hình gốc 9800X3D + 5060 Ti.
export const CPU_BOTTLENECK_BELOW = 0.85

// "AMD Ryzen 5 7600X" → "Ryzen 5 7600X", "Intel Core i5-12400F" → "Core i5-12400F".
export function cpuKey(name = '') {
  return name
    .replace(/^(AMD|Intel)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Điểm của linh kiện trong bảng (kind: 'cpu' | 'vga'). Không có → null
// (không đoán: thà báo "chưa có số liệu" còn hơn hiện số sai).
export function partScore(data, part, kind) {
  if (!part) return null
  if (kind === 'vga') return data?.gpus?.[chipKey(part.specs?.chipset ?? '')] ?? null
  return data?.cpus?.[cpuKey(part.name)] ?? null
}

// Ước tính một game ở một độ phân giải. Thiếu số liệu độ phân giải đó → null.
export function estimateGameFps(game, cpuScore, gpuScore, res) {
  const base = game.fps?.[res]
  if (!(base > 0) || !(game.cpuFps > 0)) return null
  const gpuLimit = (base * gpuScore) / 100
  const cpuLimit = (game.cpuFps * cpuScore) / 100
  return {
    fps: Math.round(Math.min(gpuLimit, cpuLimit)),
    gpuLimit,
    cpuLimit,
    limitedBy: cpuLimit < gpuLimit ? 'cpu' : 'gpu',
  }
}

// Mức trải nghiệm theo FPS để tô màu trên giao diện.
export function fpsLevel(fps) {
  if (fps >= 60) return { key: 'smooth', label: 'Mượt' }
  if (fps >= 30) return { key: 'playable', label: 'Chơi được' }
  return { key: 'low', label: 'Giật' }
}

// Nghẽn cổ chai từ kết quả 1080p của mọi game: trung bình tỉ lệ (giới hạn nhỏ / giới hạn lớn).
// Trả null nếu không có nghẽn CPU.
export function detectBottleneck(results1080) {
  const rows = results1080.filter(Boolean)
  if (!rows.length) return null
  const avg = (f) => rows.reduce((sum, r) => sum + f(r), 0) / rows.length
  const gpuUsed = avg((r) => Math.min(1, r.cpuLimit / r.gpuLimit))
  if (gpuUsed < CPU_BOTTLENECK_BELOW) {
    const lost = Math.round((1 - gpuUsed) * 100)
    return {
      part: 'cpu',
      percent: lost,
      message: `CPU giữ chân VGA: ở 1080p VGA mất khoảng ${lost}% sức mạnh. Ở 1440p/4K ảnh hưởng ít hơn; muốn chơi 1080p nên chọn CPU mạnh hơn.`,
    }
  }
  return null
}

// Ước tính cho cả cấu hình. build: { cpu, vga } (sản phẩm có name, specs, categories.slug).
// Trả { status, ... }:
//   'no-data'  – bảng số liệu chưa có game nào (BA chưa nhập)
//   'need-parts' – chưa chọn CPU hoặc VGA (missing: ['cpu'] / ['vga'])
//   'unknown-part' – linh kiện chưa có trong bảng (unknown: tên linh kiện)
//   'ok' – games: [{ id, name, results: { '1080p': {...} | null, ... } }], bottleneck, sources
export function estimatePerformance(build, data) {
  if (!data?.games?.length) return { status: 'no-data' }
  const missing = ['cpu', 'vga'].filter((slot) => !build?.[slot])
  if (missing.length) return { status: 'need-parts', missing }

  const cpuScore = partScore(data, build.cpu, 'cpu')
  const gpuScore = partScore(data, build.vga, 'vga')
  const unknown = [
    cpuScore == null && build.cpu.name,
    gpuScore == null && (build.vga.specs?.chipset ?? build.vga.name),
  ].filter(Boolean)
  if (unknown.length) return { status: 'unknown-part', unknown }

  const games = data.games.map((g) => ({
    id: g.id,
    name: g.name,
    source: g.source ?? null,
    results: Object.fromEntries(
      RESOLUTIONS.map((res) => [res, estimateGameFps(g, cpuScore, gpuScore, res)]),
    ),
  }))
  return {
    status: 'ok',
    games,
    bottleneck: detectBottleneck(games.map((g) => g.results['1080p'])),
    sources: data.sources ?? [],
  }
}
