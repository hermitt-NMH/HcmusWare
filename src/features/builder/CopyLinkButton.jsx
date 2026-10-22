import { useEffect, useState } from 'react'

// Nút sao chép link chia sẻ. Trình duyệt chặn clipboard (http, webview cũ...) thì hiện
// hộp prompt có sẵn link để khách tự chép.
export default function CopyLinkButton({ url, className = '' }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Sao chép link chia sẻ:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}
    >
      {copied ? '✓ Đã sao chép' : 'Sao chép link'}
    </button>
  )
}
