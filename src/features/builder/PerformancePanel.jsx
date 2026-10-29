import { useState } from 'react'
import { PERF_DATA } from './perfData'
import { RESOLUTIONS, RESOLUTION_LABELS, estimatePerformance, fpsLevel } from './performance'

// F09 – Ước tính FPS trong Builder (Giai đoạn 2 – Tuần 4). Chỉ gọi estimatePerformance và hiển thị,
// không tính lại trong component. Theo C8 (docs/g2-ba-tuan3-hieu-nang.md mục 6):
// chỉ cảnh báo CPU giữ chân VGA, màu vàng như cảnh báo tương thích; ghi rõ "Ước tính" và hiện nguồn.

const LEVEL_CLASS = {
  smooth: 'bg-green-50 text-green-800',
  playable: 'bg-amber-50 text-amber-900',
  low: 'bg-red-50 text-red-800',
}

export default function PerformancePanel({ build }) {
  const [res, setRes] = useState('1080p')
  const perf = estimatePerformance(build, PERF_DATA)

  return (
    <section
      aria-labelledby="perf-title"
      className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="perf-title" className="text-base font-semibold">
          FPS khi chơi game
        </h2>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
          Ước tính
        </span>
      </div>

      {perf.status === 'no-data' && (
        <p className="text-sm text-slate-500">Chưa có số liệu ước tính.</p>
      )}
      {perf.status === 'need-parts' && (
        <p className="text-sm text-slate-500">
          {perf.missing.includes('vga') && build.cpu
            ? 'Chọn VGA rời để xem FPS dự kiến (chưa ước tính cho đồ họa tích hợp).'
            : 'Chọn CPU và VGA để xem FPS dự kiến của 10 game phổ biến.'}
        </p>
      )}
      {perf.status === 'unknown-part' && (
        <p className="text-sm text-slate-500">
          Chưa có số liệu ước tính cho {perf.unknown.join(' và ')}.
        </p>
      )}

      {perf.status === 'ok' && (
        <>
          {perf.bottleneck && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              {perf.bottleneck.message}
            </p>
          )}

          <div role="group" aria-label="Độ phân giải" className="flex gap-1">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === res}
                onClick={() => setRes(r)}
                className={`h-11 flex-1 rounded-lg border text-sm font-medium sm:flex-none sm:px-4 ${
                  r === res
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {RESOLUTION_LABELS[r]}
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">
              FPS dự kiến ở {RESOLUTION_LABELS[res]}, mức đồ họa cao nhất
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2 font-medium">
                  Game
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  FPS
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-medium">
                  Mức
                </th>
              </tr>
            </thead>
            <tbody>
              {perf.games.map((g) => {
                const r = g.results[res]
                const level = r && fpsLevel(r.fps)
                return (
                  <tr key={g.id} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-800">
                      {g.name}
                      {r?.limitedBy === 'cpu' && (
                        <span className="block text-xs text-slate-500">CPU giới hạn</span>
                      )}
                    </th>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {r ? `~${r.fps}` : '–'}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      {level ? (
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_CLASS[level.key]}`}
                        >
                          {level.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Chưa có số liệu</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="text-xs text-slate-500">
            Ước tính ở mức đồ họa cao nhất, không DLSS/FSR, quy đổi từ benchmark công khai theo điểm
            CPU và VGA. FPS thực tế còn phụ thuộc RAM, driver, nhiệt độ và thiết lập game.
          </p>
          <details className="text-xs text-slate-500">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-slate-600">
              Nguồn tham khảo ({perf.sources.length})
            </summary>
            <ul className="list-disc space-y-1 pl-5">
              {perf.sources.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:no-underline dark:text-blue-300"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
