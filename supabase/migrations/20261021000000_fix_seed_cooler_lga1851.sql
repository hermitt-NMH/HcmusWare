-- =====================================================================
-- BUG-QA3-03: tản mẫu "Thermalright Peerless Assassin 120 SE" trong seed.sql
-- thiếu socket LGA1851, trái với quy tắc BA (docs/quy-tac-tuong-thich.md):
-- tản ghi LGA1700 vẫn lắp được LGA1851 (chung lỗ bắt tản).
-- Hậu quả: Builder báo sai R7 khi chọn CPU Intel Core Ultra (LGA1851) với tản này.
-- seed.sql chỉ cập nhật image_url khi trùng tên nên DB đã có dữ liệu cần sửa bằng migration này.
-- DB mới (db reset) chạy migration trước seed → câu lệnh không đổi gì, seed.sql đã đúng.
-- =====================================================================

update public.products
set specs = jsonb_set(specs, '{sockets}', specs -> 'sockets' || '["LGA1851"]'::jsonb)
where name = 'Thermalright Peerless Assassin 120 SE'
  and not (specs -> 'sockets') ? 'LGA1851';
