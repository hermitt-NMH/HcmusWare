import { useEffect, useState } from 'react'

// Chạy một hàm async (thường là truy vấn Supabase) và trả về { data, loading, error }.
// deps giống useEffect: đổi deps thì chạy lại.
export function useAsync(fn, deps = []) {
  // Biến deps thành một chuỗi "khóa" để so sánh giữa các lần render.
  // Lưu ý: JSON.stringify biến undefined, null và hàm đều thành null, nên chỉ truyền deps kiểu nguyên thủy (chuỗi, số, boolean).
  const key = JSON.stringify(deps)
  const [state, setState] = useState({ key, data: null, loading: true, error: null })

  // Nếu deps vừa đổi (vd. sang danh mục khác) thì đặt lại state ngay trong lần render này,
  // để không bị chớp dữ liệu cũ với loading:false trước khi useEffect kịp chạy.
  // (React cho phép gọi setState khi render để "điều chỉnh state theo props".)
  let current = state
  if (state.key !== key) {
    current = { key, data: null, loading: true, error: null }
    setState(current)
  }

  useEffect(() => {
    // cancelled: bỏ qua kết quả của lần gọi cũ nếu deps đã đổi trước khi nó trả về.
    let cancelled = false
    fn()
      .then((data) => !cancelled && setState({ key, data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ key, data: null, loading: false, error }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data: current.data, loading: current.loading, error: current.error }
}
