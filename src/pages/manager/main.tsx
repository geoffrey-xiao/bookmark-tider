import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { runtimeAdapter } from '../../chrome/runtimeAdapter'
import { MESSAGE_VERSION, type ScanSummary } from '../../types/messages'
import '../shared.css'

export function Manager() {
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = async () => {
    setLoading(true)
    setError(null)
    const response = await runtimeAdapter.send<ScanSummary>({ version: MESSAGE_VERSION, type: 'SCAN_BOOKMARKS' })
    if (response.ok) setSummary(response.data)
    else setError(response.error.message)
    setLoading(false)
  }

  return (
    <main className="shell">
      <span className="eyebrow">Dashboard</span>
      <h1>Bookmark Tidy</h1>
      <p>Scanning is read-only. No bookmark changes happen without a review and confirmation.</p>
      <section className="card">
        <h2>Library overview</h2>
        {summary ? (
          <div className="stats">
            <div className="stat"><strong>{summary.bookmarks}</strong>Bookmarks</div>
            <div className="stat"><strong>{summary.folders}</strong>Folders</div>
          </div>
        ) : <p>Run the first scan to see your library summary.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" onClick={scan} disabled={loading}>
          {loading ? 'Scanning…' : 'Scan bookmarks'}
        </button>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Manager /></StrictMode>,
)
