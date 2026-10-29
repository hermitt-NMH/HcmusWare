import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAsync } from '../../hooks/useAsync'
import { addComment, getMyShop, getProductComments, setCommentHidden } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import {
  MAX_TEXT,
  QUESTIONS_PAGE,
  canAnswerAsSeller,
  groupThreads,
  textLength,
  ugcErrorMessage,
  validateComment,
} from './reviews'

// Mục "Hỏi đáp" trên trang sản phẩm (F16 – US-16.2, US-16.3, US-16.4, US-16.5).
// shopSlug: shop bán sản phẩm, để biết người đang xem có trả lời với nhãn "Người bán" được không.
export default function QuestionSection({ productId, shopSlug }) {
  const { user, role } = useAuth()
  const location = useLocation()
  const [reload, setReload] = useState(0)
  const [limit, setLimit] = useState(QUESTIONS_PAGE)
  const comments = useAsync(
    () => getProductComments(productId),
    [productId, user?.id ?? '', role ?? '', reload],
  )
  const myShop = useAsync(
    () => (role === 'seller' ? getMyShop(user.id) : Promise.resolve(null)),
    [user?.id ?? '', role ?? ''],
  )
  const asSeller = canAnswerAsSeller({ role, myShop: myShop.data, productShopSlug: shopSlug })
  const refresh = () => setReload((n) => n + 1)

  const threads = groupThreads(comments.data ?? [])
  const visible = threads.slice(0, limit)

  return (
    <section aria-labelledby="questions-title" className="space-y-3">
      <h2 id="questions-title" className="text-lg font-semibold">
        Hỏi đáp {threads.length > 0 && <span className="text-slate-500">({threads.length})</span>}
      </h2>

      <div className="rounded-xl border border-slate-200 bg-surface p-4">
        {user ? (
          <CommentForm
            productId={productId}
            label="Câu hỏi của bạn"
            placeholder="Ví dụ: Sản phẩm này có hỗ trợ mainboard B650 không?"
            submitText="Gửi câu hỏi"
            onSent={() => {
              setLimit(QUESTIONS_PAGE)
              refresh()
            }}
          />
        ) : (
          <Link
            to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`}
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Đăng nhập để hỏi
          </Link>
        )}
      </div>

      {comments.loading && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
      {comments.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được hỏi đáp: {comments.error.message}
        </p>
      )}
      {!comments.loading && !comments.error && threads.length === 0 && (
        <p className="text-sm text-slate-500">Chưa có câu hỏi nào cho sản phẩm này.</p>
      )}
      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((q) => (
            <QuestionItem
              key={q.id}
              question={q}
              productId={productId}
              canReply={Boolean(user) && !q.hidden}
              asSeller={asSeller}
              isAdmin={role === 'admin'}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
      {threads.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + QUESTIONS_PAGE)}
          className="h-11 w-full rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
        >
          Xem thêm {Math.min(QUESTIONS_PAGE, threads.length - limit)} câu hỏi
        </button>
      )}
    </section>
  )
}

function QuestionItem({ question, productId, canReply, asSeller, isAdmin, onChanged }) {
  const [replying, setReplying] = useState(false)
  return (
    <li
      className={`rounded-xl border border-slate-200 bg-surface p-4 ${question.hidden ? 'opacity-60' : ''}`}
    >
      <CommentBody comment={question} isAdmin={isAdmin} onChanged={onChanged} />

      {question.replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3 sm:pl-4">
          {question.replies.map((r) => (
            <li key={r.id} className={r.hidden ? 'opacity-60' : ''}>
              <CommentBody comment={r} isAdmin={isAdmin} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      {canReply &&
        (replying ? (
          <div className="mt-3 border-l-2 border-blue-200 pl-3 sm:pl-4">
            <CommentForm
              productId={productId}
              parentId={question.id}
              isSeller={asSeller}
              label={asSeller ? 'Trả lời với tư cách người bán' : 'Câu trả lời của bạn'}
              submitText="Gửi trả lời"
              autoFocus
              onCancel={() => setReplying(false)}
              onSent={() => {
                setReplying(false)
                onChanged()
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="mt-2 inline-flex h-11 items-center text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
          >
            Trả lời
          </button>
        ))}
    </li>
  )
}

// Tên, nhãn, thời gian, nội dung và nút Ẩn / Hiện lại của admin.
function CommentBody({ comment, isAdmin, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function toggleHidden() {
    setBusy(true)
    setError(null)
    try {
      await setCommentHidden(comment.id, !comment.hidden)
      onChanged()
    } catch (err) {
      setError(ugcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-slate-800">{comment.author_name}</span>
        {comment.is_seller && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
            Người bán
          </span>
        )}
        {comment.hidden && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
            Đã ẩn
          </span>
        )}
        <span className="text-slate-500">· {formatDateTime(comment.created_at)}</span>
      </div>
      {/* Nội dung người dùng: chỉ hiện dạng chữ (React tự thoát HTML), giữ xuống dòng – US-16.5 */}
      <p className="whitespace-pre-line break-words text-sm text-slate-700">{comment.body}</p>
      {isAdmin && (
        <button
          type="button"
          onClick={toggleHidden}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {comment.hidden ? 'Hiện lại' : 'Ẩn'}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}

// Ô nhập câu hỏi / câu trả lời. Dùng lại ở kênh người bán (SellerQuestions).
export function CommentForm({
  productId,
  parentId = null,
  isSeller = false,
  label,
  placeholder,
  submitText,
  autoFocus = false,
  onCancel,
  onSent,
}) {
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const id = `comment-${parentId ?? 'new'}-${productId}`

  async function handleSubmit(e) {
    e.preventDefault()
    const { data, error } = validateComment(body)
    if (error) return setError(error)
    setSending(true)
    setError(null)
    try {
      await addComment({ productId, parentId, body: data, isSeller })
      setBody('')
      setSending(false)
      onSent()
    } catch (err) {
      setError(ugcErrorMessage(err))
      setSending(false)
    }
  }

  const length = textLength(body)
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-describedby={`${id}-count`}
        className="w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={sending}
            className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Đang gửi…' : submitText}
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
        <span
          id={`${id}-count`}
          className={`text-xs ${length > MAX_TEXT ? 'text-red-700' : 'text-slate-500'}`}
        >
          {length}/{MAX_TEXT}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
