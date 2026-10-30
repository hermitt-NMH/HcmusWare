# HcmusWare

Sàn bán linh kiện máy tính nhiều người bán, có công cụ **Build PC** tự kiểm tra tương thích.
Đồ án nhóm Yêu Khoa Học Chọn Tự Nhiên – Nhập môn CNTT. Giai đoạn 1: 19/10 – 21/11/2026 (một cửa hàng);
giai đoạn 2: 23/11/2026 – 02/01/2027 (marketplace, phân quyền 3 vai trò, đánh giá – hỏi đáp, sổ địa chỉ, sáng/tối,
gợi ý cấu hình, ước tính FPS, thông báo).

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
| `npm run preview`           | Chạy bản đã build ở http://localhost:4173 (các bộ test giao diện dùng cổng này)                                     |
| `npm run lint`              | Kiểm tra lỗi ESLint                                                                                                 |
| `npm test`                  | Chạy unit test (Vitest)                                                                                             |
| `npm run import-data`       | Đẩy ~120 sản phẩm từ bộ dữ liệu mở lên Supabase                                                                     |
| `npm run fetch-images`      | Tải ảnh thật cho sản phẩm còn thiếu ảnh (`npm run thumbs` tạo lại ảnh thu nhỏ)                                      |
| `npm run gen-price-history` | Sinh lịch sử giá giả lập 6 tháng cho mọi sản phẩm (cần `SUPABASE_SERVICE_ROLE_KEY`, thêm `-- --dry-run` để chỉ xem) |
| `npm run brand-logos`       | Tải logo thương hiệu vào `public/images/brands/`; `brand-logos:apply` ghi đường dẫn vào bảng `brands`               |
| `npm run build-dvhc`        | Tạo lại `public/data/don-vi-hanh-chinh.json` cho ô gợi ý địa chỉ (chỉ khi có nghị quyết mới về đơn vị hành chính)   |
| `npm run db:backup`         | Sao lưu Supabase online ra `backups/` (xem mục Sao lưu)                                                             |

**DB đang chạy sẵn mà có migration mới:** `npx supabase migration up --local` (giữ dữ liệu), hoặc `npm run db:reset` (xóa sạch, nạp lại).
Sau `db:reset` chạy `npm run gen-price-history` để biểu đồ giá có dữ liệu. Chi tiết ở mục [Chạy migration mới](#chạy-migration-mới).

### Kiểm thử tự động

Các bộ test giao diện mở Edge hoặc Chrome headless có sẵn trên máy, không cần cài thêm. Mỗi bộ tự tạo tài khoản
`@hcmusware.test` (cần `SUPABASE_SERVICE_ROLE_KEY` trong file env) và tự dọn sau khi chạy.

| Lệnh                    | Kiểm tra                                                                                                      | Cần chạy trước      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| `npx vitest run`        | Unit test: tương thích, gợi ý cấu hình, ước tính FPS, gợi ý địa chỉ, email...                                 | –                   |
| `npm run test:rls`      | Quyền trong DB cho 3 vai trò, gọi thẳng API như người cố ý bỏ qua giao diện. **Chạy sau mỗi PR có migration** | `db:start`          |
| `npm run test:roles`    | Menu và chặn trang theo vai trò, đổi vai trò, sáng/tối không nháy, tương phản chữ                             | `build` + `preview` |
| `npm run test:ui`       | Giao diện UI01–UI09 giai đoạn 1                                                                               | `build` + `preview` |
| `npm run test:e2e`      | Mua hàng MH01–MH08, quản trị AD03–AD06 (giai đoạn 1)                                                          | `build` + `preview` |
| `npm run test:e2e:g2t2` | Mở shop → duyệt → đăng sản phẩm → duyệt                                                                       | `build` + `preview` |
| `npm run test:e2e:g2t3` | Giỏ 2 shop tách 2 đơn, người bán xử lý đơn, sổ địa chỉ                                                        | `build` + `preview` |
| `npm run test:e2e:g2t4` | Đánh giá, hỏi đáp, người bán trả lời, admin ẩn                                                                | `build` + `preview` |

Thêm đuôi `:online` (vd `npm run test:rls:online`) để chạy trên Supabase online và bản Vercel, đọc khóa từ `.env.online.local`
(cùng dạng `.env.local` nhưng là khóa project online, KTS gửi riêng). Các bộ này **ghi dữ liệu thật**: chạy `npm run db:backup` trước.
Mã từng ca test nằm trong [docs/test-plan.md](docs/test-plan.md).

## Vai trò và tài khoản mẫu

Quyền được kiểm tra trong DB bằng Row Level Security và hàm `is_admin()`, `is_seller()`; giao diện chỉ ẩn bớt menu.
Component `RoleRoute` chặn trang theo vai trò: chưa đăng nhập → `/dang-nhap` (xong quay lại đúng trang), sai vai trò → báo "Không có quyền truy cập".

| Vai trò    | Được làm                                                                                                                  | Trang riêng                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Khách hàng | Mua hàng, Build PC, đánh giá sản phẩm đã nhận, hỏi đáp, sổ địa chỉ, cảnh báo giá, đăng ký mở shop                         | `/tai-khoan`, `/tai-khoan/dia-chi`, `/tai-khoan/mo-shop`                                        |
| Người bán  | Quyền khách hàng + quản lý sản phẩm và đơn của shop mình, trả lời câu hỏi trên sản phẩm của mình                          | `/kenh-nguoi-ban` (shop, sản phẩm), `/kenh-nguoi-ban/don-hang`, `/kenh-nguoi-ban/cau-hoi`       |
| Admin      | Duyệt / từ chối / khóa shop và sản phẩm, đổi vai trò người dùng, ẩn đánh giá và câu hỏi, quản lý thương hiệu, xem mọi đơn | `/admin/san-pham`, `/admin/duyet`, `/admin/thuong-hieu`, `/admin/don-hang`, `/admin/nguoi-dung` |

Khách thành người bán khi admin **duyệt shop** (không đổi vai trò tay). Sản phẩm người bán đăng ở trạng thái chờ duyệt,
khách chỉ thấy sản phẩm đang bán của shop đang hoạt động. 128 sản phẩm giai đoạn 1 thuộc shop **HcmusWare** do admin sở hữu.

**Tài khoản mẫu trên DB local** (tạo bởi `supabase/seed.sql` khi `db:start` / `db:reset`):

| Vai trò    | Email                    | Mật khẩu    | Ghi chú                         |
| ---------- | ------------------------ | ----------- | ------------------------------- |
| Admin      | `admin@hcmusware.local`  | `admin123`  | Chủ shop HcmusWare              |
| Người bán  | `seller@hcmusware.local` | `seller123` | Shop "Linh Kiện Mẫu" (đã duyệt) |
| Khách hàng | `khach@hcmusware.local`  | `khach123`  |                                 |

Các tài khoản mật khẩu yếu này **chỉ có ở local**, không bao giờ tạo trên online. Tài khoản demo trên
https://hcmusware.vercel.app do KTS tạo, mật khẩu gửi trong nhóm chat (không ghi vào repo, issue hay slide).

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
- Tài khoản mẫu 3 vai trò: xem [Vai trò và tài khoản mẫu](#vai-trò-và-tài-khoản-mẫu).
- `npm run db:reset` xóa sạch DB local, chạy lại migrations + seed. `npm run db:stop` tắt (dữ liệu vẫn giữ).

## Chạy migration mới

Mọi thay đổi bảng, RLS, hàm, trigger nằm trong `supabase/migrations/`, mỗi tuần một file (thêm file riêng khi sửa lỗi QA).
**Không sửa file migration đã merge**, kể cả khi có lỗi: tạo file mới sửa tiếp.

**Viết migration (KTS, trên nhánh riêng):**

1. `npx supabase migration new ten_thay_doi`, viết SQL vào file vừa tạo.
2. Thử trên local: `npx supabase migration up --local` (hoặc `npm run db:reset` để chạy lại từ đầu).
3. `npm run test:rls` phải đạt hết; thêm ca mới vào `scripts/rls-test.js` chứng minh vai trò khác không đọc / sửa được dữ liệu không phải của mình.
4. Mở PR, ghi rõ trong mô tả "có migration".

**Người khác kéo code có migration mới về:** `git pull`, rồi `npx supabase migration up --local`.

**Đưa lên Supabase online (KTS, ngay sau khi merge PR):** Vercel deploy `main` ngay khi merge, còn DB online
không tự đổi, nên web mới có thể gọi bảng / hàm chưa có trên online cho tới khi chạy bước 2.

1. `npm run db:backup` (bắt buộc, migration online từng làm hỏng dữ liệu ngày 22/10).
2. `npx supabase db push`.
3. `npx supabase migration list`: mọi dòng phải có số ở cả cột Local và Remote.
4. Migration có RLS: `npm run test:rls:online`.

Migration giai đoạn 2:

| File             | Nội dung                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `20261123000000` | Vai trò `seller`, `is_seller()`, bảng `shops`, `brands`; `shop_id`, `brand_id`, `status` cho sản phẩm; viết lại RLS |
| `20261130000000` | Duyệt / từ chối / khóa shop và sản phẩm, ảnh sản phẩm (bucket `product-images`, JPG/PNG/WebP ≤ 2 MB, tối đa 5 ảnh)  |
| `20261201000000` | Admin đổi tên thương hiệu thì cập nhật tên trên mọi sản phẩm                                                        |
| `20261207000000` | Đơn tách theo shop, cùng mã thanh toán; người bán xử lý đơn shop mình; sổ địa chỉ                                   |
| `20261214000000` | Đánh giá (chỉ người đã nhận hàng, 1 lần / sản phẩm), hỏi đáp, ẩn nội dung                                           |
| `20261215000000` | Sửa lỗi QA G2T4: "Câu hỏi chưa trả lời" bỏ sản phẩm đã ẩn                                                           |
| `20261221000000` | Bảng `notifications`, trigger tạo thông báo (đơn, giá, shop, câu hỏi)                                               |
| `20261222000000` | Email thông báo, công tắc tắt email, link `/tat-email`                                                              |
| `20261223000000` | Sửa lỗi QA G2T5: mở khóa shop thì báo cảnh báo giá đã đạt                                                           |

## Email thông báo

Thông báo trong web (chuông trên Header) chạy ngay sau khi có migration. Email đi qua Edge Function `send-email` và Brevo (gói Free),
cần đặt khóa trên Supabase online: làm theo [supabase/functions/send-email/README.md](supabase/functions/send-email/README.md).
Chưa đặt khóa (và luôn luôn ở local) thì web vẫn chạy bình thường, email ghi trạng thái `skipped`.

## Đưa lên Supabase online (Kiến trúc sư, khi deploy)

1. Tạo project trên [supabase.com](https://supabase.com) (region Singapore).
2. Đẩy schema: `npx supabase login`, `npx supabase link --project-ref <mã-project>`, rồi `npx supabase db push`.
3. Chạy phần danh mục + sản phẩm mẫu của `supabase/seed.sql` trong SQL Editor (**bỏ khối tài khoản admin local**), tạo admin thật theo hướng dẫn trong file.
4. Đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` của project online trên Vercel (Settings → Environment Variables, nhập tay).
   **Không gắn Supabase qua Vercel Marketplace / Storage / "recommended integrations"**: cách đó tạo thêm một DB Supabase
   riêng mà app không dùng, và Vercel bắt deploy phải chờ DB đó. DB đó bị tạm dừng thì mọi deploy lỗi
   `Resource provisioning failed` trước khi build (đã xảy ra 27/10/2026). Gặp lỗi này: Vercel → Storage → chọn DB → Projects → Disconnect, rồi Redeploy.
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
- [docs/user-story-g2.md](docs/user-story-g2.md) – user story, tiêu chí nghiệm thu và các quyết định đã chốt giai đoạn 2
- [docs/thong-so-bat-buoc.md](docs/thong-so-bat-buoc.md) – thông số bắt buộc theo danh mục khi người bán đăng sản phẩm
- [docs/g2-ba-tuan1.md](docs/g2-ba-tuan1.md) – luồng mở shop, duyệt sản phẩm, nguồn dữ liệu đơn vị hành chính
- [docs/g2-ba-tuan3-hieu-nang.md](docs/g2-ba-tuan3-hieu-nang.md) – bảng điểm hiệu năng và nguồn cho ước tính FPS
- [docs/g2-ba-tuan5-thu-cu.md](docs/g2-ba-tuan5-thu-cu.md) – bảng giá thu cũ đổi mới (F11, **đã cắt sang backlog**, chưa có code)

## Cấu trúc thư mục

```
data/              bộ dữ liệu (raw/ không commit), overrides.json do BA bổ sung
scripts/           script chạy trên máy: import dữ liệu, sao lưu DB, các bộ kiểm thử (rls, roles, ui, e2e)
supabase/          config.toml, migrations/ (bảng + RLS), seed.sql (danh mục, dữ liệu mẫu, 3 tài khoản local),
                   functions/send-email (Edge Function gửi email)
public/data/       đơn vị hành chính 2 cấp cho ô gợi ý địa chỉ
src/lib/           kết nối Supabase, hàm truy vấn (api.js), định dạng giá
src/hooks/         hook dùng chung (useAsync)
src/components/    Header, Footer, ProductCard, RoleRoute...
src/context/       AuthContext, CartContext
src/features/      builder/ (tương thích, gợi ý cấu hình, ước tính FPS), price/, address/, reviews/,
                   seller/, admin/, orders/, cart/, notifications/
src/pages/         các trang; admin/ và seller/ là trang của từng vai trò
```

## Quy trình Git

- Không push thẳng vào `main`. Tạo nhánh từ `main` mới nhất: `git pull` rồi `git checkout -b feature/ten-viec`.
- Commit nhỏ, rõ nghĩa: `feat: them bo loc theo socket`, `fix: sai tong cong suat`.
- Mở Pull Request → Vercel tạo link xem thử → ít nhất 1 người review rồi mới merge.

## Bảo mật

- `.env.local` không bao giờ commit.
- Frontend chỉ dùng anon key; mọi bảng đều bật Row Level Security. Chỉ admin đổi được vai trò (hàm `set_user_role`).
- Đặt hàng đi qua hàm `place_order` trong database: giá và tổng tiền lấy từ DB, không tin số liệu từ trình duyệt.
- Người bán chỉ ghi được ảnh vào thư mục `<shop_id>/` của shop mình trong bucket `product-images`.
- Đánh giá, câu hỏi hiển thị dạng chữ thuần, không chèn được HTML. Thông báo chỉ do trigger trong DB tạo.
- Khóa Brevo và chuỗi bí mật của Edge Function chỉ nằm trong Supabase secrets / Vault.
