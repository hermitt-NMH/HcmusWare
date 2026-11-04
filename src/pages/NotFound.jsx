import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-slate-500">{t('Không tìm thấy trang bạn cần.')}</p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center text-blue-700 dark:text-blue-300 hover:underline"
      >
        {t('Về trang chủ')}
      </Link>
    </div>
  )
}
