import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteBuild, getMyBuilds } from '../../lib/api'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../lib/format'
import { buildFromItems, shareUrl } from './builder'
import CopyLinkButton from './CopyLinkButton'
import { t } from '../../lib/i18n'

// Danh sách cấu hình đã lưu trong trang tài khoản: mở lại, sao chép link chia sẻ, xóa.
export default function SavedBuilds({ userId }) {
  const builds = useAsync(() => getMyBuilds(userId), [userId])
  const [deleted, setDeleted] = useState([]) // id đã xóa, ẩn ngay không cần tải lại
  const [error, setError] = useState('')

  const remove = async (b) => {
    if (!window.confirm(t('Xóa cấu hình "{name}"? Link chia sẻ cũng sẽ hết hiệu lực.', b))) return
    setError('')
    try {
      await deleteBuild(b.id)
      setDeleted((d) => [...d, b.id])
    } catch (err) {
      setError(t('Không xóa được: {msg}', { msg: t(err.message) }))
    }
  }

  const list = builds.data?.filter((b) => !deleted.includes(b.id)) ?? []

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{t('Cấu hình đã lưu')}</h2>
      {builds.loading && <p className="text-sm text-slate-500">{t('Đang tải…')}</p>}
      {builds.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t('Không tải được: {msg}', { msg: t(builds.error.message) })}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!builds.loading && !builds.error && !list.length && (
        <p className="text-sm text-slate-500">
          {t('Chưa có cấu hình nào.')}{' '}
          <Link to="/build-pc" className="text-blue-700 dark:text-blue-300 hover:underline">
            Build PC
          </Link>{' '}
          {t('rồi bấm "Lưu cấu hình".')}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {list.map((b) => {
          const count = Object.keys(buildFromItems(b.items).ids).length
          return (
            <li key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}</p>
                <p className="text-xs text-slate-500">
                  {t('{n} linh kiện · lưu ngày {date}', {
                    n: count,
                    date: formatDate(b.created_at),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Link
                  to={`/build-pc?cau-hinh=${b.share_code}`}
                  className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t('Mở')}
                </Link>
                <CopyLinkButton url={shareUrl(b.share_code)} />
                <button
                  type="button"
                  onClick={() => remove(b)}
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:text-red-400"
                >
                  {t('Xóa')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
