# Edge Function `send-email` (F12 – US-12.3)

Gửi email cho thông báo **giá xuống tới giá mong muốn** và **đơn chuyển Đang giao / Hoàn tất / Đã hủy**.
Thông báo được tạo trong DB (migration `20261221000000`, `20261222000000`). Trigger `notifications_request_email`
gọi function này qua `pg_net` sau khi transaction commit, nên lỗi gửi email không làm hỏng việc đổi trạng thái đơn.

Trạng thái gửi nằm ở `notifications.email_status`:

| Giá trị   | Nghĩa                                                                                |
| --------- | ------------------------------------------------------------------------------------ |
| `null`    | Thông báo không cần email (loại khác, Đã xác nhận, hoặc khách đã tắt loại email này) |
| `pending` | Chờ function nhận                                                                    |
| `sending` | Function đang gửi                                                                    |
| `sent`    | Brevo đã nhận thư                                                                    |
| `failed`  | Lỗi, xem `email_error` (hết hạn mức, sai địa chỉ, sai khóa API...). Không tự gửi lại |
| `skipped` | Không gửi: chưa cấu hình (vault / `BREVO_API_KEY`), hoặc khách vừa tắt email         |

Tra nhanh: `select email_status, email_error, count(*) from notifications group by 1, 2;`

## Dịch vụ email: Brevo (gói Free)

- 300 email/ngày, không mất phí, có API gửi email giao dịch.
- Chỉ cần **xác minh 1 địa chỉ người gửi** (Gmail của nhóm), không cần tên miền riêng.
  (Resend gói Free khi chưa có tên miền chỉ gửi được tới email của chủ tài khoản → không dùng được.)
- Hạn mức tính theo ngày UTC. Demo + test không vượt 300.

Các bước (KTS):

1. Tạo tài khoản tại brevo.com → **Senders, Domains & Dedicated IPs → Senders → Add a sender**, nhập Gmail của nhóm, bấm link xác minh trong thư.
2. **SMTP & API → API keys → Generate a new API key**. Chép khóa, **không** dán vào code, issue hay chat nhóm.

## Cấu hình trên Supabase online

```bash
# 1. Secrets của function (chỉ nằm trên Supabase, không vào repo)
npx supabase secrets set BREVO_API_KEY=<khóa> EMAIL_FROM=<gmail đã xác minh> \
  SITE_URL=https://hcmusware.vercel.app EMAIL_HOOK_SECRET=<chuỗi ngẫu nhiên>
# Chuỗi ngẫu nhiên: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# 2. Đưa function lên
npx supabase functions deploy send-email
```

3. Cho DB biết gọi function ở đâu: SQL Editor trên dashboard (cùng chuỗi ngẫu nhiên ở bước 1):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-email', 'email_function_url');
select vault.create_secret('<chuỗi ngẫu nhiên>', 'email_hook_secret');
```

Đổi lại sau này: `select vault.update_secret(id, '<giá trị mới>') from vault.secrets where name = 'email_hook_secret';`

Thứ tự: `npm run db:backup` → `npx supabase db push` (migration) → bước 1–3. Chưa làm bước 3 thì web vẫn chạy, email ghi `skipped`.

## Chạy trên máy (local)

Không có `BREVO_API_KEY` thì function **chạy thử**: không gửi, in tiêu đề ra log và ghi `skipped`.

```bash
# File env ngoài repo, vd C:\tmp\functions.env:
#   EMAIL_HOOK_SECRET=<chuỗi ngẫu nhiên>
#   SITE_URL=http://localhost:5173
npx supabase functions serve --env-file C:\tmp\functions.env
```

Vault local (DB gọi function qua mạng Docker nội bộ):

```sql
select vault.create_secret('http://supabase_kong_hcmusware:8000/functions/v1/send-email', 'email_function_url');
select vault.create_secret('<cùng chuỗi ngẫu nhiên>', 'email_hook_secret');
```

## Nội dung email

Soạn ở `compose.js` (có unit test `compose.test.js`): chỉ là chữ, gồm tiêu đề thông báo, nội dung, link về web
và link tắt email `/tat-email?t=<email_token>&loai=gia|don`. Không chứa địa chỉ nhận hàng hay số điện thoại.
