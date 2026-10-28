// Logo của thương hiệu / shop; chưa có logo thì hiện chữ cái đầu của tên.
// size: class Tailwind cho kích thước, vd "h-16 w-16".
export default function LogoBadge({ name, url, size = 'h-14 w-14', text = 'text-xl' }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white`}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
      ) : (
        <span className={`${text} font-bold text-gray-500`} aria-hidden="true">
          {name?.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </div>
  )
}
