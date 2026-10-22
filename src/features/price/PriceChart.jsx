import { Chart as ChartJS, Filler, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { formatDate, formatPrice } from '../../lib/format'

// Chỉ đăng ký phần Chart.js cần dùng để file nhẹ hơn.
ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Filler)

const BLUE = '#2563eb' // blue-600, cùng màu nút chính của web
const GRID = '#e2e8f0' // slate-200
const TICK = '#64748b' // slate-500

// "5,49 tr" cho trục Y gọn trên điện thoại.
function shortPrice(v) {
  return v >= 1e6
    ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr`
    : `${Math.round(v / 1000)}k`
}

// Biểu đồ giá theo thời gian. points: [{ price, recorded_at }] cũ → mới.
// Trục X là số mili-giây (trục "linear") nên khoảng cách đúng theo ngày thật mà không cần
// cài thêm thư viện ngày tháng. Đường bậc thang: giá giữ nguyên cho tới lần đổi tiếp theo.
// targetPrice: vẽ thêm đường ngang nét đứt "giá mong muốn" nếu khách đã đặt.
export default function PriceChart({ points, targetPrice }) {
  const data = points.map((p) => ({ x: Date.parse(p.recorded_at), y: p.price }))
  const datasets = [
    {
      label: 'Giá',
      data,
      stepped: 'after',
      borderColor: BLUE,
      borderWidth: 2,
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      fill: 'start',
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHitRadius: 12,
      pointHoverBackgroundColor: BLUE,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    },
  ]
  if (targetPrice && data.length) {
    datasets.push({
      label: 'Giá mong muốn',
      data: [
        { x: data[0].x, y: targetPrice },
        { x: data[data.length - 1].x, y: targetPrice },
      ],
      borderColor: '#16a34a', // green-600
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      pointHitRadius: 0,
      fill: false,
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    // Rê chuột/chạm ở đâu cũng hiện giá tại thời điểm gần nhất (không cần trúng điểm).
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: {
        type: 'linear',
        // Trục "linear" tự làm tròn hai đầu làm dư khoảng trống → ép đúng ngày đầu/cuối.
        min: data[0]?.x,
        max: data[data.length - 1]?.x,
        grid: { display: false },
        border: { color: GRID },
        ticks: {
          color: TICK,
          maxTicksLimit: 6,
          maxRotation: 0,
          callback: (v) =>
            new Date(v).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        },
      },
      y: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: TICK, maxTicksLimit: 5, callback: shortPrice },
        grace: '5%',
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (item) => item.datasetIndex === 0,
        displayColors: false,
        callbacks: {
          title: (items) => formatDate(items[0].parsed.x),
          label: (item) => formatPrice(item.parsed.y),
        },
      },
    },
  }

  return (
    <div className="h-56 sm:h-64">
      <Line
        data={{ datasets }}
        options={options}
        role="img"
        aria-label="Biểu đồ giá 6 tháng gần nhất"
      />
    </div>
  )
}
