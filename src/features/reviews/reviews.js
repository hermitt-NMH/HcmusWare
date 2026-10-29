// Đánh giá và hỏi đáp (F16), dạng HÀM THUẦN để test. Quy tắc độ dài, gộp dòng trống trùng với DB
// (clean_ugc, guard_review_write, guard_comment_write trong migration 20261214000000).
// Nội dung người dùng chỉ hiện bằng {text} của React (tự thoát HTML), không dùng dangerouslySetInnerHTML.

export const MAX_TEXT = 1000

// Bỏ \r, nhiều dòng trống liên tiếp gộp còn 1 dòng trống, bỏ khoảng trắng 2 đầu (US-16.5).
export function cleanText(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}

// Đếm theo ký tự thật (emoji 1 ký tự) để khớp length() của PostgreSQL.
export const textLength = (text) => [...cleanText(text)].length

// 4.6, 12 → "4,6 ★ (12)". Chưa có lượt nào → null (nơi gọi tự ghi "Chưa có đánh giá").
export function formatRating(avg, count) {
  if (!count) return null
  const value = Number(avg).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${value} ★ (${count})`
}

// Trả { data, errors } giống các form khác. Số sao bắt buộc, nhận xét không bắt buộc.
export function validateReview({ rating, comment }) {
  const errors = {}
  const r = Number(rating)
  if (!Number.isInteger(r) || r < 1 || r > 5) errors.rating = 'Chọn số sao từ 1 đến 5.'
  const text = cleanText(comment)
  if (textLength(text) > MAX_TEXT) errors.comment = `Nhận xét tối đa ${MAX_TEXT} ký tự.`
  return { data: { rating: r, comment: text || null }, errors }
}

// Câu hỏi / câu trả lời: 1–1000 ký tự, khoảng trắng không tính.
export function validateComment(body) {
  const text = cleanText(body)
  if (!text) return { data: text, error: 'Nhập nội dung trước khi gửi.' }
  if (textLength(text) > MAX_TEXT) return { data: text, error: `Tối đa ${MAX_TEXT} ký tự.` }
  return { data: text, error: null }
}

// Danh sách bình luận phẳng → câu hỏi mới nhất trước, mỗi câu kèm các câu trả lời cũ → mới.
// Câu trả lời của câu hỏi không có trong danh sách (đã ẩn) thì bỏ.
export function groupThreads(comments) {
  const byTime = (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id
  const questions = comments
    .filter((c) => c.parent_id == null)
    .sort((a, b) => byTime(b, a))
    .map((q) => ({ ...q, replies: [] }))
  const byId = new Map(questions.map((q) => [q.id, q]))
  for (const c of [...comments].sort(byTime)) {
    if (c.parent_id != null) byId.get(c.parent_id)?.replies.push(c)
  }
  return questions
}

// Lỗi từ DB đã là câu tiếng Việt (raise exception trong trigger); còn lại thì ghi chung.
export function ugcErrorMessage(error) {
  if (error?.code === '42501') return 'Bạn không có quyền thực hiện thao tác này.'
  return error?.message || 'Lỗi không xác định.'
}

// Có được trả lời với nhãn "Người bán" không (chỉ để hiện đúng nút; DB kiểm tra lại trong guard_comment_write):
// người bán của shop đang hoạt động bán sản phẩm này, hoặc admin trên sản phẩm shop HcmusWare (C5).
export function canAnswerAsSeller({ role, myShop, productShopSlug }) {
  if (!productShopSlug) return false
  if (role === 'admin') return productShopSlug === 'hcmusware'
  return role === 'seller' && myShop?.status === 'active' && myShop.slug === productShopSlug
}

// Số câu hỏi hiện mỗi lần ("Xem thêm" hiện thêm chừng này) – US-16.2.
export const QUESTIONS_PAGE = 10
