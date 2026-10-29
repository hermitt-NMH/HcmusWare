import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAsync } from '../../hooks/useAsync'
import { canReview, getProductReviews, saveReview, setReviewHidden } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { MAX_TEXT, formatRating, textLength, ugcErrorMessage, validateReview } from './reviews'
import { StarInput, Stars } from './Stars'

// Mục "Đánh giá" trên trang sản phẩm (F16 – US-16.1, US-16.4, US-16.5).
// Form chỉ hiện cho người đã nhận hàng; DB cũng chặn (guard_review_write), nên ẩn form chỉ để tiện.
export default function ReviewSection({ productId }) {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  // reload: tăng lên sau khi gửi / ẩn để tải lại danh sách và điểm trung bình.
  const [reload, setReload] = useState(0)
  const reviews = useAsync(
    () => getProductReviews(productId),
    [productId, user?.id ?? '', role ?? '', reload],
  )
  const eligible = useAsync(
    () => (user ? canReview(productId) : Promise.resolve(false)),
    [productId, user?.id ?? ''],
  )

  const list = reviews.data ?? []
  // Điểm tính từ đánh giá đang hiện (cùng quy tắc với product_ratings trong DB: bỏ đánh giá bị ẩn).
  const shown = list.filter((r) => !r.hidden)
  const avg = shown.length ? shown.reduce((s, r) => s + r.rating, 0) / shown.length : null
  const summary = formatRating(avg, shown.length)
  const mine = user ? list.find((r) => r.user_id === user.id) : null

  return (
    <section aria-labelledby="reviews-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="reviews-title" className="text-lg font-semibold">
          Đánh giá sản phẩm
        </h2>
        {!reviews.loading && !reviews.error && (
          <p className="text-sm text-slate-600">
            {summary ? (
              <span className="font-semibold text-slate-800">{summary}</span>
            ) : (
              'Chưa có đánh giá'
            )}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-surface p-4">
        {/* Chờ danh sách tải xong mới biết đã có đánh giá của mình chưa (form mới hay form sửa).
            key: vừa gửi đánh giá mới → dựng lại ở dạng thu gọn "Sửa đánh giá của bạn". */}
        {reviews.loading ? (
          <div className="h-6 w-64 animate-pulse rounded bg-slate-100" />
        ) : (
          <ReviewFormArea
            key={mine?.id ?? 'new'}
            productId={productId}
            user={user}
            eligible={eligible}
            mine={mine}
            onSaved={() => setReload((n) => n + 1)}
          />
        )}
      </div>

      {reviews.loading && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
      {reviews.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được đánh giá: {reviews.error.message}
        </p>
      )}
      {!reviews.loading && !reviews.error && list.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
          {list.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              isMine={r.user_id === user?.id}
              isAdmin={isAdmin}
              onChanged={() => setReload((n) => n + 1)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReviewFormArea({ productId, user, eligible, mine, onSaved }) {
  const location = useLocation()
  // Đã đánh giá thì thu gọn thành nút "Sửa đánh giá của bạn".
  const [open, setOpen] = useState(!mine)

  if (!user)
    return (
      <p className="text-sm text-slate-600">
        Chỉ người đã nhận hàng mới đánh giá được.{' '}
        <Link
          to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`}
          className="text-blue-700 underline hover:no-underline dark:text-blue-300"
        >
          Đăng nhập
        </Link>
      </p>
    )
  if (eligible.loading) return <div className="h-6 w-64 animate-pulse rounded bg-slate-100" />
  if (eligible.error)
    return (
      <p className="text-sm text-red-700">
        Không kiểm tra được đơn hàng của bạn: {eligible.error.message}
      </p>
    )
  if (!eligible.data)
    return <p className="text-sm text-slate-600">Chỉ người đã nhận hàng mới đánh giá được.</p>

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
      >
        Sửa đánh giá của bạn
      </button>
    )

  return (
    <ReviewForm
      productId={productId}
      mine={mine}
      onCancel={mine ? () => setOpen(false) : null}
      onSaved={() => {
        setOpen(false)
        onSaved()
      }}
    />
  )
}

function ReviewForm({ productId, mine, onCancel, onSaved }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const { data, errors } = validateReview({ rating, comment })
    setErrors(errors)
    if (Object.keys(errors).length) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveReview(mine?.id ?? null, productId, data)
      onSaved()
    } catch (err) {
      setSaveError(ugcErrorMessage(err))
      setSaving(false)
    }
  }

  const length = textLength(comment)
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <h3 className="font-semibold">{mine ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}</h3>
      <StarInput value={rating} onChange={setRating} />
      {errors.rating && <p className="text-sm text-red-700">{errors.rating}</p>}
      <div>
        <label htmlFor="review-comment" className="mb-1 block text-sm font-medium">
          Nhận xét (không bắt buộc)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm"
          aria-describedby="review-comment-count"
        />
        <p
          id="review-comment-count"
          className={`text-right text-xs ${length > MAX_TEXT ? 'text-red-700' : 'text-slate-500'}`}
        >
          {length}/{MAX_TEXT}
        </p>
        {errors.comment && <p className="text-sm text-red-700">{errors.comment}</p>}
      </div>
      {saveError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Đang gửi…' : mine ? 'Lưu đánh giá' : 'Gửi đánh giá'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  )
}

function ReviewItem({ review, isMine, isAdmin, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function toggleHidden() {
    setBusy(true)
    setError(null)
    try {
      await setReviewHidden(review.id, !review.hidden)
      onChanged()
    } catch (err) {
      setError(ugcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <li className={`space-y-1 p-4 ${review.hidden ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-slate-800">{review.author_name}</span>
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
          Đã mua hàng
        </span>
        {isMine && <span className="text-xs text-slate-500">(bạn)</span>}
        {review.hidden && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
            Đã ẩn
          </span>
        )}
        <span className="text-slate-500">· {formatDate(review.created_at)}</span>
        {review.updated_at && <span className="text-xs text-slate-500">(đã sửa)</span>}
      </div>
      <Stars value={review.rating} />
      {/* Nội dung người dùng: chỉ hiện dạng chữ (React tự thoát HTML), giữ xuống dòng – US-16.5 */}
      {review.comment && (
        <p className="whitespace-pre-line break-words text-sm text-slate-700">{review.comment}</p>
      )}
      {isMine && review.hidden && !isAdmin && (
        <p className="text-xs text-slate-500">
          Đánh giá này đã bị admin ẩn, người khác không thấy.
        </p>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={toggleHidden}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {review.hidden ? 'Hiện lại' : 'Ẩn'}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </li>
  )
}
