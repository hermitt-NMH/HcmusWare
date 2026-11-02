import { useLayoutEffect, useState } from 'react'

// State lấy từ localStorage (giỏ hàng, cấu hình Build PC) mà vẫn hydrate được trang vẽ sẵn lúc build (#115):
// lần render đầu luôn dùng `initial` – giống HTML lúc build, vốn không có localStorage – rồi đọc `load()`
// trong useLayoutEffect, chạy trước khi trình duyệt vẽ nên người dùng không thấy chớp giá trị mặc định.
// Trả về [state, setState, loaded, restored]:
// - loaded = false trong lần render đầu: effect ghi localStorage phải đợi loaded, không thì ghi đè bằng `initial`.
// - restored = true khi localStorage có giá trị khác `initial` (đã thay state).
export function useStoredState(load, initial) {
  const [state, setState] = useState(initial)
  const [status, setStatus] = useState({ loaded: false, restored: false })
  useLayoutEffect(() => {
    const value = load()
    const restored = JSON.stringify(value) !== JSON.stringify(initial)
    if (restored) setState(value)
    setStatus({ loaded: true, restored })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [state, setState, status.loaded, status.restored]
}
