import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getUnansweredQuestions } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { CommentForm } from '../../features/reviews/QuestionSection'

// /kenh-nguoi-ban/cau-hoi (US-16.3): câu hỏi trên sản phẩm của shop mình chưa có câu trả lời "Người bán".
// Trả lời xong thì câu hỏi rời khỏi danh sách (DB lọc trong seller_unanswered_questions).
export default function SellerQuestions({ canEdit }) {
  const [reload, setReload] = useState(0)
  const questions = useAsync(() => getUnansweredQuestions(), [reload])

  if (questions.loading) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
  if (questions.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        Không tải được câu hỏi: {questions.error.message}
      </p>
    )
  if (!questions.data.length)
    return (
      <p className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-600">
        Không còn câu hỏi nào chưa trả lời.
      </p>
    )

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {questions.data.length} câu hỏi chưa trả lời. Câu trả lời của bạn có nhãn “Người bán” trên
        trang sản phẩm.
      </p>
      {!canEdit && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Shop đang không hoạt động nên chưa trả lời được.
        </p>
      )}
      <ul className="space-y-3">
        {questions.data.map((q) => (
          <li key={q.id} className="space-y-2 rounded-xl border border-slate-200 bg-surface p-4">
            <Link
              to={`/san-pham/${q.product_id}#questions-title`}
              className="line-clamp-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              {q.product_name}
            </Link>
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{q.author_name}</span> ·{' '}
              {formatDateTime(q.created_at)}
            </p>
            <p className="whitespace-pre-line break-words text-sm text-slate-700">{q.body}</p>
            {canEdit && (
              <CommentForm
                productId={q.product_id}
                parentId={q.id}
                isSeller
                label="Trả lời"
                submitText="Gửi trả lời"
                onSent={() => setReload((n) => n + 1)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
