# HcmusWare

Website bán linh kiện máy tính có công cụ **Build PC** tự kiểm tra tương thích.
Đồ án nhóm 8 – Nhập môn CNTT (19/10 – 21/11/2026).

**Công nghệ:** React (Vite) · Tailwind CSS v4 · Supabase (database, đăng nhập, lưu ảnh) · Chart.js · Vitest · deploy Vercel.

**Demo:** https://hcmusware.vercel.app

## Chạy dự án trên máy

Cần cài: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com), VS Code (mở dự án sẽ được nhắc cài bộ extension chung).

```powershell
git clone https://github.com/hermitt-NMH/HcmusWare.git
cd HcmusWare
copy .env.example .env.local   # rồi điền khóa Kiến trúc sư gửi trong nhóm chat
npm install
npm run dev                    # mở http://localhost:5173
```

| Lệnh                        | Tác dụng                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Chạy web ở chế độ phát triển                                                                                        |
| `npm run build`             | Build bản production vào `dist/`                                                                                    |
| `npm run lint`              | Kiểm tra lỗi ESLint                                                                                                 |
| `npm test`                  | Chạy unit test (Vitest)                                                                                             |
| `npm run test:ui`           | Kiểm thử giao diện UI01–UI09 (cần `npm run preview` đang chạy)                                                      |
| `npm run import-data`       | Đẩy ~120 sản phẩm từ bộ dữ liệu mở lên Supabase                                                                     |
| `npm run fetch-images`      | Tải ảnh thật cho sản phẩm còn thiếu ảnh                                                                             |
| `npm run gen-price-history` | Sinh lịch sử giá giả lập 6 tháng cho mọi sản phẩm (cần `SUPABASE_SERVICE_ROLE_KEY`, thêm `-- --dry-run` để chỉ xem) |

**DB đang chạy sẵn mà có migration mới** (vd Tuần 5): `npx supabase migration up --local` (giữ dữ liệu), hoặc `npm run db:reset` (xóa sạch, nạp lại).
Sau đó chạy `npm run gen-price-history` để biểu đồ giá có dữ liệu.

## Cơ sở dữ liệu local (Supabase chạy trên máy)

Khi phát triển, mỗi người chạy một Supabase riêng trên máy bằng Docker: có PostgreSQL thật,
đăng nhập, API và trang quản trị Studio, giống hệt bản online.

Cần cài thêm [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows cần WSL2) và mở Docker trước khi chạy.

```powershell
npm run db:start     # lần đầu tải image ~vài phút; tự tạo bảng (migrations/) và nạp seed.sql
npm run db:status    # xem URL, anon key, chuỗi kết nối PostgreSQL
```

- Chép **API URL** và **Publishable / anon key** từ `db:status` vào `.env.local`, rồi chạy `npm run dev`.
- Studio (xem/sửa bảng như pgAdmin): http://127.0.0.1:54323
- Kết nối PostgreSQL bằng pgAdmin/DBeaver: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Tài khoản admin local: `admin@HcmusWare.local` / `admin123`
- `npm run db:reset` xóa sạch DB local, chạy lại migrations + seed. `npm run db:stop` tắt (dữ liệu vẫn giữ).

**Đổi schema:** không sửa file migration cũ đã merge. Tạo file mới bằng
`npx supabase migration new ten_thay_doi`, viết SQL vào đó, chạy `npm run db:reset` để thử.

## Đưa lên Supabase online (Kiến trúc sư, khi deploy)

1. Tạo project trên [supabase.com](https://supabase.com) (region Singapore).
2. Đẩy schema: `npx supabase login`, `npx supabase link --project-ref <mã-project>`, rồi `npx supabase db push`.
3. Chạy phần danh mục + sản phẩm mẫu của `supabase/seed.sql` trong SQL Editor (**bỏ khối tài khoản admin local**), tạo admin thật theo hướng dẫn trong file.
4. Đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` của project online trên Vercel.
5. Bật đăng nhập Google (Tuần 3):
   - [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
     Ô _Authorized redirect URIs_ điền `https://<mã-project>.supabase.co/auth/v1/callback`.
   - Supabase → **Authentication → Providers → Google**: bật, dán Client ID và Client Secret.
   - Supabase → **Authentication → URL Configuration**: _Site URL_ là `https://hcmusware.vercel.app`; _Redirect URLs_ thêm
     `http://localhost:5173/**` và `https://*-<tên-nhóm-vercel>.vercel.app/**` (để link preview của Pull Request cũng đăng nhập được).
   - Local chưa cấu hình Google nên nút "Tiếp tục với Google" sẽ báo "chưa được bật" — dùng email để thử.

## Sao lưu và khôi phục Supabase online (Kiến trúc sư)

**Bắt buộc sao lưu trước mỗi lần chạy test ghi dữ liệu** (`npm run test:e2e:online`, thử đặt hàng, đổi giá trên bản thật).

- Kiểm tra migration đã lên online: `npx supabase migration list` — mọi dòng phải có số ở cả cột Local và Remote; thiếu thì `npx supabase db push`.
- Sao lưu dữ liệu: `npm run db:backup` → file `backups/<mã-project>-<ngày-giờ>.json` (mọi bảng public, không cần Docker). Chép file lên drive nhóm; thư mục `backups/` không được commit vì có thông tin khách.
- Sao lưu đầy đủ bằng `pg_dump` (cần Docker Desktop đang chạy):
  `npx supabase db dump --linked -f backups/schema.sql` và `npx supabase db dump --linked --data-only -f backups/data.sql`.
- Khôi phục:
  - Mất vài dòng (ví dụ xóa nhầm sản phẩm): lấy đúng các dòng đó trong file JSON, chèn lại bằng SQL Editor **giữ nguyên `id`** (kèm `price_history` của sản phẩm).
  - Hỏng nhiều: trong SQL Editor xóa dữ liệu các bảng bị hỏng, chạy lại `backups/data.sql` bằng
    `psql "<connection string trong Supabase → Connect>" -f backups/data.sql`.
  - Sau khi chèn dòng có `id` sẵn, chỉnh lại bộ đếm, ví dụ `select setval(pg_get_serial_sequence('products','id'), (select max(id) from products));`.

## Lỗi thường gặp

- `npm.ps1 cannot be loaded because running scripts is disabled`: chạy một lần
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, mở lại terminal.
- `db:start` báo không kết nối được Docker: mở Docker Desktop, đợi biểu tượng cá voi báo "running".

## Import dữ liệu sản phẩm

1. Tải [PC Part Dataset](https://github.com/docyx/pc-part-dataset) (MIT), chép các file trong `data/json/` vào `data/raw/` (thư mục này không được commit).
2. Thêm `SUPABASE_SERVICE_ROLE_KEY` vào `.env.local` (**chỉ dùng cho script, tuyệt đối không dùng trong `src/`**).
3. Chạy thử `node --env-file=.env.local scripts/import-dataset.js --dry-run` – script ghi kết quả vào `data/products.json` và liệt kê thông số còn thiếu / đang ước lượng.
4. BA bổ sung thông số thiếu trong `data/overrides.json` (khóa là tên sản phẩm gốc), rồi chạy `npm run import-data`.

### Ảnh sản phẩm

Ảnh thật của từng sản phẩm nằm trong `public/images/products/`, bảng tên → ảnh ở `data/images.json` (import-data tự điền `image_url` từ đây).
Thêm sản phẩm mới thì chạy `npm run fetch-images` rồi `npm run import-data`. Ảnh sai: `npm run fetch-images -- --redo "Tên SP"` (thêm `--query "từ khóa"` nếu cần),
`npm run fetch-images -- --sheet` tạo trang soát ảnh. Sản phẩm không có ảnh sẽ hiện ảnh minh họa của danh mục.

Tải nhanh 8 file cần dùng (Git Bash):

```bash
mkdir -p data/raw && for f in cpu motherboard memory video-card internal-hard-drive power-supply case cpu-cooler; do
  curl -sSfL -o data/raw/$f.json https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json/$f.json; done
```

Lưu ý: `.env.local` phải lưu dạng UTF-8 **không BOM** (VS Code: góc dưới phải chọn "UTF-8"), nếu không `npm run db:reset` sẽ báo lỗi đọc file.

## Tài liệu nhóm

- [docs/quy-tac-tuong-thich.md](docs/quy-tac-tuong-thich.md) – quy tắc kiểm tra tương thích cho Builder (BA)
- [docs/test-plan.md](docs/test-plan.md) – test plan và test case (Test1, Test2)

## Cấu trúc thư mục

```
data/              bộ dữ liệu (raw/ không commit), overrides.json do BA bổ sung
scripts/           script chạy trên máy: import dữ liệu, sinh lịch sử giá, kiểm thử giao diện
supabase/          config.toml, migrations/ (bảng + RLS), seed.sql (danh mục, dữ liệu mẫu)
src/lib/           kết nối Supabase, hàm truy vấn (api.js), định dạng giá
src/hooks/         hook dùng chung (useAsync)
src/components/    Header, Footer, ProductCard, ProductGrid...
src/context/       AuthContext, CartContext (Tuần 3–4)
src/features/      builder/ (quy tắc tương thích), price/ (lịch sử, cảnh báo giá)
src/pages/         các trang
```

## Quy trình Git

- Không push thẳng vào `main`. Tạo nhánh từ `main` mới nhất: `git pull` rồi `git checkout -b feature/ten-viec`.
- Commit nhỏ, rõ nghĩa: `feat: them bo loc theo socket`, `fix: sai tong cong suat`.
- Mở Pull Request → Vercel tạo link xem thử → ít nhất 1 người review rồi mới merge.

## Bảo mật

- `.env.local` không bao giờ commit.
- Frontend chỉ dùng anon key; mọi bảng đều bật Row Level Security.
- Đặt hàng đi qua hàm `place_order` trong database: giá và tổng tiền lấy từ DB, không tin số liệu từ trình duyệt.
