import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../hooks/useAuth'

// Bọc toàn bộ app (trong main.jsx) để mọi trang biết ai đang đăng nhập.
// Cung cấp: user, profile (bảng profiles: full_name, phone, address, role), loading,
// và các hàm signIn, signUp, signInWithGoogle, signOut, updateProfile.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true) // đang kiểm tra phiên đăng nhập lúc mở web
  const [profile, setProfile] = useState(null)
  // id người dùng của lần tải hồ sơ gần nhất đã xong (thành công hoặc lỗi).
  // Khác userId hiện tại nghĩa là hồ sơ đang tải.
  const [profileFor, setProfileFor] = useState(null)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    // 1. Lấy phiên đã lưu sẵn (Supabase tự lưu trong localStorage).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // 2. Lắng nghe mỗi lần đăng nhập / đăng xuất / làm mới token.
    // Lưu ý: không gọi hàm supabase khác ngay trong callback này (dễ bị treo) – chỉ cập nhật state.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const userId = user?.id

  // Tải hồ sơ mỗi khi đổi người dùng (đăng nhập tài khoản khác hoặc đăng xuất).
  // Lỗi mạng cũng phải đánh dấu "đã tải xong" để trang admin không chờ mãi.
  const [profileReload, setProfileReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    setProfileError(null)
    if (!userId) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name, phone, address, role')
      .eq('id', userId)
      .maybeSingle()
      .then(
        ({ data, error }) => ({ data, error }),
        (error) => ({ data: null, error }),
      )
      .then(({ data, error }) => {
        if (cancelled) return // đã đổi tài khoản trong lúc chờ → bỏ kết quả cũ
        if (error) console.error('Không tải được hồ sơ:', error.message)
        setProfile(data ?? null)
        setProfileError(error ?? null)
        setProfileFor(userId)
      })
    return () => {
      cancelled = true
    }
  }, [userId, profileReload])
  const reloadProfile = useCallback(() => setProfileReload((n) => n + 1), [])
  const profileLoading = Boolean(userId) && profileFor !== userId

  const value = useMemo(
    () => ({
      user,
      // Đang tải hồ sơ của tài khoản khác (vừa đổi tài khoản) thì coi như chưa có hồ sơ.
      profile: profileLoading ? null : profile,
      profileLoading,
      profileError,
      reloadProfile,
      loading,
      isAdmin: !profileLoading && profile?.role === 'admin',

      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),

      // full_name được trigger handle_new_user chép sang bảng profiles.
      signUp: (email, password, fullName) =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        }),

      // Chuyển sang trang Google, đăng nhập xong Google trả về redirectTo.
      // redirectTo phải nằm trong danh sách Redirect URLs của Supabase (xem README).
      signInWithGoogle: (next = '/') =>
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + next },
        }),

      signOut: () => supabase.auth.signOut(),

      // Chỉ được sửa 3 cột này (RLS + quyền cột trong migration). Không gửi role.
      updateProfile: async ({ full_name, phone, address }) => {
        const { data, error } = await supabase
          .from('profiles')
          .update({ full_name, phone, address })
          .eq('id', userId)
          .select('id, full_name, phone, address, role')
          .single()
        if (!error) setProfile(data)
        return { error }
      },
    }),
    [user, profile, profileLoading, profileError, reloadProfile, loading, userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
