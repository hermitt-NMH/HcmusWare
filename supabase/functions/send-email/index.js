// Edge Function gửi email cho một thông báo (F12 – US-12.3). Gọi từ trigger notifications_request_email
// (pg_net) với { notification_id } và header x-hook-secret. Không dùng JWT (verify_jwt = false trong config.toml).
//
// Secrets (npx supabase secrets set ..., KHÔNG ghi vào repo): EMAIL_HOOK_SECRET, BREVO_API_KEY, EMAIL_FROM,
// SITE_URL. Thiếu BREVO_API_KEY thì chạy thử: không gửi, ghi email_status = skipped.
// Hướng dẫn cấu hình: README.md cùng thư mục.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { composeEmail } from './compose.js'

const env = (k) => Deno.env.get(k) ?? ''
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (!env('EMAIL_HOOK_SECRET') || req.headers.get('x-hook-secret') !== env('EMAIL_HOOK_SECRET'))
    return json({ error: 'forbidden' }, 403)
  const { notification_id: id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(id)) return json({ error: 'notification_id' }, 400)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  // "Nhận việc": chỉ một lần gọi chuyển được pending → sending, gọi lặp thì bỏ qua (gửi đúng 1 lần).
  const { data: n } = await db
    .from('notifications')
    .update({ email_status: 'sending' })
    .eq('id', id)
    .eq('email_status', 'pending')
    .select('id, user_id, type, title, body, link')
    .maybeSingle()
  if (!n) return json({ skipped: 'không còn chờ gửi' })
  const finish = (fields) => db.from('notifications').update(fields).eq('id', n.id)

  try {
    const { data: profile, error: pErr } = await db
      .from('profiles')
      .select('email_token, email_price_alerts, email_order_status')
      .eq('id', n.user_id)
      .single()
    if (pErr) throw pErr
    // Khách vừa tắt email giữa lúc tạo thông báo và lúc gửi.
    const on = n.type === 'price_drop' ? profile.email_price_alerts : profile.email_order_status
    if (!on) {
      await finish({ email_status: 'skipped', email_error: 'Khách đã tắt loại email này' })
      return json({ skipped: 'tắt email' })
    }
    const { data: u, error: uErr } = await db.auth.admin.getUserById(n.user_id)
    if (uErr || !u?.user?.email) throw uErr ?? new Error('Tài khoản không có email')

    const mail = composeEmail(n, {
      siteUrl: env('SITE_URL') || 'https://hcmusware.vercel.app',
      token: profile.email_token,
    })
    if (!env('BREVO_API_KEY')) {
      console.log(`[chạy thử] tới ${u.user.email}: ${mail.subject}`)
      await finish({ email_status: 'skipped', email_error: 'Chạy thử: chưa có BREVO_API_KEY' })
      return json({ dryRun: true, subject: mail.subject })
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env('BREVO_API_KEY'),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env('EMAIL_FROM'), name: 'HcmusWare' },
        to: [{ email: u.user.email }],
        subject: mail.subject,
        textContent: mail.text,
      }),
    })
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`)
    await finish({ email_status: 'sent', emailed_at: new Date().toISOString(), email_error: null })
    return json({ sent: true })
  } catch (e) {
    // Hết hạn mức, sai địa chỉ...: chỉ ghi lỗi, không thử lại (không gửi trùng).
    await finish({ email_status: 'failed', email_error: String(e?.message ?? e).slice(0, 500) })
    return json({ error: 'gửi lỗi' }, 500)
  }
})
