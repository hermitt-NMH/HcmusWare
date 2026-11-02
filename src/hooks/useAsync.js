import { use, useContext, useEffect, useId, useState } from 'react'
import { SsrDataContext, readSnapshot } from '../lib/ssrData'

// Chạy một hàm async (thường là truy vấn Supabase) và trả về { data, loading, error }.
// deps giống useEffect: đổi deps thì chạy lại.
// Trang vẽ sẵn lúc build (#115): lần đầu dùng dữ liệu đã chụp (không hiện "đang tải"), rồi vẫn gọi lại
// để lấy dữ liệu mới nhất – xem lib/ssrData.js.
export function useAsync(fn, deps = []) {
  // Biến deps thành một chuỗi "khóa" để so sánh giữa các lần render.
  // Lưu ý: JSON.stringify biến undefined, null và hàm đều thành null, nên chỉ truyền deps kiểu nguyên thủy (chuỗi, số, boolean).
  const key = JSON.stringify(deps)
  const id = useId()
  const ssr = useContext(SsrDataContext)
  const [state, setState] = useState(() => {
    const snap = readSnapshot(id, key)
    return snap
      ? { key, data: snap.d, loading: false, error: null }
      : { key, data: null, loading: true, error: null }
  })

  // Nếu deps vừa đổi (vd. sang danh mục khác) thì đặt lại state ngay trong lần render này,
  // để không bị chớp dữ liệu cũ với loading:false trước khi useEffect kịp chạy.
  // (React cho phép gọi setState khi render để "điều chỉnh state theo props".)
  let current = state
  if (!ssr && state.key !== key) {
    current = { key, data: null, loading: true, error: null }
    setState(current)
  }

  useEffect(() => {
    // cancelled: bỏ qua kết quả của lần gọi cũ nếu deps đã đổi trước khi nó trả về.
    let cancelled = false
    fn()
      .then((data) => !cancelled && setState({ key, data, loading: false, error: null }))
      .catch(
        (error) =>
          !cancelled &&
          // Đang hiện dữ liệu vẽ sẵn mà gọi lại lỗi (mất mạng) thì giữ dữ liệu đó, không báo lỗi
          setState((s) =>
            s.key === key && !s.loading && !s.error
              ? s
              : { key, data: null, loading: false, error },
          ),
      )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Lúc build: chờ dữ liệu (React vẽ lại khi có). Gọi lỗi thì vẽ trạng thái "đang tải" như trình duyệt.
  if (ssr) {
    const r = use(ssr.load(id, key, fn))
    return r.ok
      ? { data: r.data, loading: false, error: null }
      : { data: null, loading: true, error: null }
  }

  return { data: current.data, loading: current.loading, error: current.error }
}
