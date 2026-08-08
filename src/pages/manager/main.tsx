import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { runtimeAdapter } from '../../chrome/runtimeAdapter'
import type { BookmarkItem, BookmarkNode, BookmarkScanResult, CleanupSuggestion } from '../../types/bookmarks'
import { MESSAGE_VERSION, type ScanResponse } from '../../types/messages'
import '../shared.css'

function fullPath(node: BookmarkNode): string {
  return [...node.path, node.title || '(untitled)'].join(' / ')
}

function IssueCard({ suggestion, result }: { suggestion: CleanupSuggestion; result: BookmarkScanResult }) {
  const keeper = suggestion.keepId
    ? result.nodes[result.indexes.byId[suggestion.keepId]]
    : null

  return (
    <article className="issue-card">
      <div className="issue-heading">
        <span className={`badge ${suggestion.duplicateType === 'normalized' ? 'badge-caution' : ''}`}>
          {suggestion.kind === 'delete-empty-folder'
            ? 'Empty folder'
            : suggestion.duplicateType === 'exact' ? 'Exact duplicate' : 'Normalized duplicate'}
        </span>
        <span className="confidence">{Math.round(suggestion.confidence * 100)}% confidence</span>
      </div>
      <strong>{suggestion.before.title || '(untitled)'}</strong>
      <span className="path">{fullPath(suggestion.before)}</span>
      {suggestion.before.type === 'bookmark' && <code>{suggestion.before.url}</code>}
      {keeper && <p className="keeper">Keep: {fullPath(keeper)}</p>}
      <p>{suggestion.reasons[0]}</p>
    </article>
  )
}

function BookmarkRow({ bookmark }: { bookmark: BookmarkItem }) {
  return (
    <li className="bookmark-row">
      <div>
        <strong>{bookmark.title || '(untitled)'}</strong>
        <span className="path">{fullPath(bookmark)}</span>
      </div>
      <a href={bookmark.url} target="_blank" rel="noreferrer">{bookmark.domain || bookmark.url}</a>
    </li>
  )
}

export function Manager() {
  const [result, setResult] = useState<BookmarkScanResult | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bookmarks = useMemo(() => {
    if (!result) return []
    const normalizedQuery = query.trim().toLowerCase()
    return result.nodes.filter((node): node is BookmarkItem => {
      if (node.type !== 'bookmark') return false
      if (!normalizedQuery) return true
      return [node.title, node.url, node.domain, node.path.join(' ')]
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [query, result])

  const duplicateSuggestions = result?.suggestions.filter((item) => item.kind === 'delete-duplicate') ?? []
  const emptyFolderSuggestions = result?.suggestions.filter((item) => item.kind === 'delete-empty-folder') ?? []

  const scan = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await runtimeAdapter.send<ScanResponse>({ version: MESSAGE_VERSION, type: 'SCAN_BOOKMARKS' })
      if (response.ok) setResult(response.data)
      else setError(response.error.message)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The extension worker is unavailable. Reload and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Day 1 · Read-only analysis</span>
          <h1>Bookmark Tidy</h1>
          <p>Scan your library and review potential issues. This version cannot modify bookmarks.</p>
        </div>
        <button type="button" onClick={scan} disabled={loading}>
          {loading ? 'Scanning…' : result ? 'Scan again' : 'Scan bookmarks'}
        </button>
      </header>

      {error && <p className="alert error" role="alert">{error}</p>}

      {!result ? (
        <section className="card empty-state">
          <div className="empty-icon" aria-hidden="true">✓</div>
          <h2>Analysis stays separate from changes</h2>
          <p>The scanner only reads your bookmark tree. Cleanup actions will require a separate review step.</p>
        </section>
      ) : (
        <>
          <section className="stats" aria-label="Library overview">
            <div className="stat"><strong>{result.summary.bookmarks}</strong><span>Bookmarks</span></div>
            <div className="stat"><strong>{result.summary.folders}</strong><span>Folders</span></div>
            <div className="stat stat-accent"><strong>{result.summary.duplicateGroups}</strong><span>Duplicate groups</span></div>
            <div className="stat stat-accent"><strong>{result.summary.emptyFolders}</strong><span>Empty folders</span></div>
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Cleanup findings</span>
                <h2>{result.suggestions.length} suggestions to review</h2>
              </div>
              <span className="read-only-pill">Read only</span>
            </div>

            {result.suggestions.length === 0 ? (
              <p>No duplicates or empty folders found.</p>
            ) : (
              <div className="issues-grid">
                {duplicateSuggestions.map((suggestion) => (
                  <IssueCard key={suggestion.id} suggestion={suggestion} result={result} />
                ))}
                {emptyFolderSuggestions.map((suggestion) => (
                  <IssueCard key={suggestion.id} suggestion={suggestion} result={result} />
                ))}
              </div>
            )}
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">All bookmarks</span>
                <h2>Search the scanned library</h2>
              </div>
              <span className="result-count">{bookmarks.length} results</span>
            </div>
            <label className="search-field">
              <span className="sr-only">Search bookmarks</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, URL, domain, or path…"
              />
            </label>
            {bookmarks.length ? (
              <ul className="bookmark-list">
                {bookmarks.map((bookmark) => <BookmarkRow key={bookmark.id} bookmark={bookmark} />)}
              </ul>
            ) : <p>No bookmarks match this search.</p>}
          </section>
        </>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Manager /></StrictMode>,
)
