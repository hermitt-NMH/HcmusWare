import { Link } from 'react-router-dom'

export default function ComingSoon({ title }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-500">Trang này đang được xây dựng.</p>
      <Link to="/" className="mt-4 inline-block text-blue-700 hover:underline">
        Về trang chủ
      </Link>
    </div>
  )
}
