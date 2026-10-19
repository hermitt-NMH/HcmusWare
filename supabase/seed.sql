-- =====================================================================
-- Dữ liệu khởi tạo.
-- Local: tự chạy sau migration mỗi lần npm run db:start (lần đầu) / npm run db:reset.
-- Online: chạy tay trong SQL Editor, BỎ phần "Tài khoản admin local" ở cuối file.
-- Sản phẩm thật được đẩy lên bằng: npm run import-data
-- =====================================================================

insert into public.categories (name, slug, sort_order) values
  ('CPU – Bộ vi xử lý',   'cpu',       1),
  ('Mainboard',           'mainboard', 2),
  ('RAM',                 'ram',       3),
  ('VGA – Card màn hình', 'vga',       4),
  ('SSD',                 'ssd',       5),
  ('Nguồn (PSU)',         'psu',       6),
  ('Vỏ máy (Case)',       'case',      7),
  ('Tản nhiệt',           'cooler',    8)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Vài sản phẩm mẫu để trang chủ có dữ liệu ngay cả khi chưa import.
-- Ảnh nằm trong public/images/products/ (tải bằng npm run fetch-images).
insert into public.products (category_id, name, brand, price, stock, specs, image_url)
select c.id, p.name, p.brand, p.price, p.stock, p.specs::jsonb, p.image_url
from (values
  ('cpu',       'AMD Ryzen 5 7600',              'AMD',      5490000,  20, '{"socket":"AM5","tdp_w":65,"cores":6,"threads":12,"base_clock_ghz":3.8,"boost_clock_ghz":5.1,"igpu":true}', '/images/products/cpu-amd-ryzen-5-7600.webp'),
  ('mainboard', 'MSI PRO B650M-A WIFI',          'MSI',      4290000,  15, '{"socket":"AM5","ram_type":"DDR5","form_factor":"Micro ATX","ram_slots":4,"max_ram_gb":192}', '/images/products/mainboard-msi-pro-b650m-a-wifi.webp'),
  ('ram',       'Kingston FURY Beast 32GB (2x16GB) DDR5-6000', 'Kingston', 2690000, 30, '{"ram_type":"DDR5","speed_mhz":6000,"modules":2,"capacity_gb":32}', '/images/products/ram-kingston-fury-beast-32gb-2x16gb-ddr5-6000.webp'),
  ('vga',       'ASUS Dual GeForce RTX 4060 8GB', 'ASUS',    8290000,  10, '{"chipset":"GeForce RTX 4060","vram_gb":8,"length_mm":227,"tdp_w":115}', '/images/products/vga-asus-dual-geforce-rtx-4060-8gb.webp'),
  ('ssd',       'Samsung 990 EVO 1TB',           'Samsung',  2190000,  25, '{"capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","form_factor":"M.2-2280"}', '/images/products/ssd-samsung-990-evo-1tb.webp'),
  ('psu',       'Corsair RM750e 750W',           'Corsair',  2790000,  12, '{"wattage_w":750,"efficiency":"80+ Gold","form_factor":"ATX","modular":"Full"}', '/images/products/psu-corsair-rm750e-750w.webp'),
  ('case',      'NZXT H5 Flow',                  'NZXT',     2290000,   8, '{"case_type":"ATX Mid Tower","form_factors":["ATX","Micro ATX","Mini ITX"],"max_gpu_length_mm":365}', '/images/products/case-nzxt-h5-flow.webp'),
  ('cooler',    'Thermalright Peerless Assassin 120 SE', 'Thermalright', 990000, 18, '{"sockets":["AM4","AM5","LGA1700","LGA1851"],"radiator_mm":null,"max_tdp_w":245}', '/images/products/cooler-thermalright-peerless-assassin-120-se.webp')
) as p(slug, name, brand, price, stock, specs, image_url)
join public.categories c on c.slug = p.slug
on conflict (category_id, name) do update set image_url = excluded.image_url;

-- ---------- Tài khoản admin trên Supabase online ----------
-- 1. Vào Authentication → Users → Add user, tạo tài khoản admin (mật khẩu mạnh).
-- 2. Chạy: update public.profiles set role = 'admin'
--          where id = (select id from auth.users where email = '<email admin>');

-- ---------- Tài khoản admin local (CHỈ dùng trên máy, không chạy trên online) ----------
-- Đăng nhập: admin@HcmusWare.local / admin123 (Supabase lưu email chữ thường)
do $$
declare
  v_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@hcmusware.local') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'admin@hcmusware.local', extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Quản trị viên"}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', 'admin@hcmusware.local', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- profile đã được trigger handle_new_user tạo, chỉ cần nâng quyền
  update public.profiles set role = 'admin' where id = v_id;
end;
$$;
