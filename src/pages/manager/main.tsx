import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { runtimeAdapter } from '../../chrome/runtimeAdapter'
import type { BookmarkItem, BookmarkNode, BookmarkScanResult, CleanupSuggestion } from '../../types/bookmarks'
import {
  MESSAGE_VERSION,
  type ApplyResponse,
  type LatestBatchResult,
  type ScanResponse,
  type UndoResponse,
} from '../../types/messages'
import type { OperationBatch } from '../../types/operations'
import '../shared.css'

const SHOW_READ_ONLY_DIAGNOSTICS = false

function fullPath(node: BookmarkNode): string {
  return [...node.path, node.title || '(untitled)'].join(' / ')
}

function IssueCard({
  suggestion,
  result,
  selected,
  onToggle,
}: {
  suggestion: CleanupSuggestion
  result: BookmarkScanResult
  selected: boolean
  onToggle: () => void
}) {
  const keeper = suggestion.keepId
    ? result.nodes[result.indexes.byId[suggestion.keepId]]
    : null
  const destination = suggestion.targetFolderId
    ? result.nodes[result.indexes.byId[suggestion.targetFolderId]]
    : null
  const badgeLabel = suggestion.kind === 'move-bookmark'
    ? 'Move suggestion'
    : suggestion.kind === 'delete-empty-folder'
      ? 'Empty folder'
      : suggestion.duplicateType === 'exact' ? 'Exact duplicate' : 'Normalized duplicate'

  return (
    <article className={`issue-card ${selected ? 'issue-selected' : ''}`}>
      <div className="issue-heading">
        <span className={`badge ${suggestion.duplicateType === 'normalized' ? 'badge-caution' : ''} ${suggestion.kind === 'move-bookmark' ? 'badge-move' : ''}`}>
          {badgeLabel}
        </span>
        <span className="confidence">{Math.round(suggestion.confidence * 100)}% confidence</span>
      </div>
      <strong>{suggestion.before.title || '(untitled)'}</strong>
      <span className="path">{fullPath(suggestion.before)}</span>
      {suggestion.before.type === 'bookmark' && <code>{suggestion.before.url}</code>}
      {keeper && <p className="keeper">Keep: {fullPath(keeper)}</p>}
      {destination && <p className="destination">Move to: {fullPath(destination)}</p>}
      <p>{suggestion.reasons[0]}</p>
      <label className="select-control">
        <input type="checkbox" checked={selected} onChange={onToggle} />
        Include in review batch
      </label>
    </article>
  )
}

function BatchSummary({ batch, undoing, onUndo }: {
  batch: OperationBatch
  undoing: boolean
  onUndo: () => void
}) {
  const succeeded = batch.operations.filter((operation) => operation.status === 'success').length
  const failed = batch.operations.filter((operation) => operation.status === 'failed').length
  const skipped = batch.operations.filter((operation) => operation.status === 'skipped').length
  const uncertain = batch.operations.filter((operation) => operation.status === 'executing').length
  const canUndo = batch.status !== 'undone'
    && batch.operations.some((operation) => operation.status === 'success' && operation.undoStatus !== 'success')
  const issues = batch.operations.filter((operation) =>
    operation.error || operation.undoError,
  )

  return (
    <section className="card batch-card" aria-live="polite">
      <div>
        <span className="eyebrow">Latest operation batch</span>
        <h2 className="batch-title">{batch.status.replace('-', ' ')}</h2>
        <p>{succeeded} succeeded · {failed} failed · {skipped} skipped{uncertain ? ` · ${uncertain} needs verification` : ''}</p>
        {batch.status === 'interrupted' && (
          <p className="warning-text">The worker stopped during this batch. Verify uncertain items before making more changes.</p>
        )}
        {issues.length > 0 && (
          <ul className="batch-results">
            {issues.map((operation) => (
              <li key={operation.id}>{operation.before.title || operation.targetId}: {operation.undoError ?? operation.error}</li>
            ))}
          </ul>
        )}
      </div>
      {canUndo && (
        <button type="button" className="secondary-button" onClick={onUndo} disabled={undoing}>
          {undoing ? 'Undoing…' : 'Undo latest batch'}
        </button>
      )}
    </section>
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

function formatDepths(depths: Record<string, number>): string {
  const entries = Object.entries(depths).sort(([left], [right]) => Number(left) - Number(right))
  return entries.length ? entries.map(([depth, count]) => `D${depth}: ${count}`).join(' · ') : 'None'
}

function Diagnostics({ result }: { result: BookmarkScanResult }) {
  const diagnostics = result.diagnostics
  const classification = diagnostics.classification

  return (
    <details className="card diagnostics-card" open>
      <summary>
        <span>
          <span className="eyebrow">Read-only diagnostics</span>
          <strong>Why suggestions were included or filtered</strong>
        </span>
        <code>{diagnostics.analyzerBuild}</code>
      </summary>
      <p>This section contains counts only. It does not expose bookmark URLs or change the library.</p>
      <dl className="diagnostics-grid">
        <div><dt>Root nodes</dt><dd>{diagnostics.rootNodes}</dd></div>
        <div><dt>Protected folders</dt><dd>{diagnostics.protectedFolders}</dd></div>
        <div><dt>User folders</dt><dd>{diagnostics.userFolders}</dd></div>
        <div><dt>Candidate folders</dt><dd>{classification.candidateFolders}</dd></div>
        <div><dt>Bookmarks visited</dt><dd>{classification.bookmarksVisited}</dd></div>
        <div><dt>Eligible for classification</dt><dd>{classification.eligibleForClassification}</dd></div>
        <div><dt>Already in named folders</dt><dd>{classification.bookmarksAlreadyInMeaningfulFolder}</dd></div>
        <div><dt>Cleanup targets skipped</dt><dd>{classification.skippedCleanupTargets}</dd></div>
        <div><dt>Content-platform candidates</dt><dd>{classification.eligibleContentPlatformBookmarks}</dd></div>
        <div><dt>With domain candidates</dt><dd>{classification.bookmarksWithDomainCandidates}</dd></div>
        <div><dt>With keyword candidates</dt><dd>{classification.bookmarksWithKeywordCandidates}</dd></div>
        <div><dt>No qualifying destination</dt><dd>{classification.skippedNoCandidate}</dd></div>
        <div><dt>Top-score ties</dt><dd>{classification.skippedTopScoreTie}</dd></div>
        <div><dt>Current folder as good or better</dt><dd>{classification.skippedCurrentPlacementAsGoodOrBetter}</dd></div>
        <div><dt>Move suggestions created</dt><dd>{classification.suggestionsCreated}</dd></div>
      </dl>
      <div className="depth-diagnostics">
        <span><strong>Bookmarks by depth</strong>{formatDepths(diagnostics.bookmarksByDepth)}</span>
        <span><strong>Folders by depth</strong>{formatDepths(diagnostics.foldersByDepth)}</span>
      </div>
    </details>
  )
}

export function Manager() {
  const [result, setResult] = useState<BookmarkScanResult | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [latestBatch, setLatestBatch] = useState<OperationBatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void runtimeAdapter
      .send<LatestBatchResult>({ version: MESSAGE_VERSION, type: 'GET_LATEST_BATCH' })
      .then((response) => {
        if (response.ok) setLatestBatch(response.data)
      })
      .catch(() => setError('Saved operation history is temporarily unavailable. Scanning is still safe.'))
  }, [])

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
  const classificationSuggestions = result?.suggestions.filter((item) => item.kind === 'move-bookmark') ?? []
  const cleanupSuggestionCount = duplicateSuggestions.length + emptyFolderSuggestions.length

  const scan = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await runtimeAdapter.send<ScanResponse>({ version: MESSAGE_VERSION, type: 'SCAN_BOOKMARKS' })
      if (response.ok) {
        setResult(response.data)
        setSelectedIds(new Set())
      }
      else setError(response.error.message)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The extension worker is unavailable. Reload and try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSuggestion = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applySelected = async () => {
    if (!result || selectedIds.size === 0) return
    const suggestions = result.suggestions.filter((suggestion) => selectedIds.has(suggestion.id))
    const confirmed = window.confirm(
      `Apply ${suggestions.length} reviewed change${suggestions.length === 1 ? '' : 's'}? A snapshot will be saved first.`,
    )
    if (!confirmed) return

    setApplying(true)
    setError(null)
    try {
      const response = await runtimeAdapter.send<ApplyResponse>({
        version: MESSAGE_VERSION,
        type: 'APPLY_SUGGESTIONS',
        suggestions,
      })
      if (response.ok) {
        setLatestBatch(response.data)
        await scan()
      } else {
        setError(response.error.message)
      }
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'The operation batch could not be applied.')
    } finally {
      setApplying(false)
    }
  }

  const undoLatest = async () => {
    setUndoing(true)
    setError(null)
    try {
      const response = await runtimeAdapter.send<UndoResponse>({ version: MESSAGE_VERSION, type: 'UNDO_LATEST_BATCH' })
      if (response.ok) {
        setLatestBatch(response.data)
        await scan()
      } else {
        setError(response.error.message)
      }
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'The latest batch could not be undone.')
    } finally {
      setUndoing(false)
    }
  }

  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">v0.1 · Scan, organize, undo</span>
          <h1>Bookmark Tidy</h1>
          <p>Scanning is read-only. Only suggestions you select and explicitly confirm can modify bookmarks.</p>
        </div>
        <button type="button" onClick={scan} disabled={loading}>
          {loading ? 'Scanning…' : result ? 'Scan again' : 'Scan bookmarks'}
        </button>
      </header>

      {error && <p className="alert error" role="alert">{error}</p>}
      {latestBatch && <BatchSummary batch={latestBatch} undoing={undoing} onUndo={undoLatest} />}

      {!result ? (
        <section className="card empty-state">
          <div className="empty-icon" aria-hidden="true">✓</div>
          <h2>Analysis stays separate from changes</h2>
          <p>The scanner only reads your bookmark tree. Every selected change is revalidated and snapshotted before execution.</p>
        </section>
      ) : (
        <>
          <section className="stats stats-five" aria-label="Library overview">
            <div className="stat"><strong>{result.summary.bookmarks}</strong><span>Bookmarks</span></div>
            <div className="stat"><strong>{result.summary.folders}</strong><span>Folders</span></div>
            <div className="stat stat-accent"><strong>{result.summary.duplicateGroups}</strong><span>Duplicate groups</span></div>
            <div className="stat stat-accent"><strong>{result.summary.emptyFolders}</strong><span>Empty folders</span></div>
            <div className="stat stat-accent"><strong>{result.summary.classificationSuggestions}</strong><span>Folder suggestions</span></div>
          </section>

          {SHOW_READ_ONLY_DIAGNOSTICS && <Diagnostics result={result} />}

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Cleanup findings</span>
                <h2>{cleanupSuggestionCount} cleanup suggestions</h2>
              </div>
              <span className="read-only-pill">Review required</span>
            </div>

            {cleanupSuggestionCount === 0 ? (
              <p>No duplicates or empty folders found.</p>
            ) : (
              <div className="issues-grid">
                {duplicateSuggestions.map((suggestion) => (
                  <IssueCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    result={result}
                    selected={selectedIds.has(suggestion.id)}
                    onToggle={() => toggleSuggestion(suggestion.id)}
                  />
                ))}
                {emptyFolderSuggestions.map((suggestion) => (
                  <IssueCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    result={result}
                    selected={selectedIds.has(suggestion.id)}
                    onToggle={() => toggleSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Existing-folder classification</span>
                <h2>{classificationSuggestions.length} organization suggestions</h2>
              </div>
              <span className="read-only-pill">No new folders</span>
            </div>
            {classificationSuggestions.length === 0 ? (
              <p>No high-confidence moves to existing folders were found.</p>
            ) : (
              <div className="issues-grid">
                {classificationSuggestions.map((suggestion) => (
                  <IssueCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    result={result}
                    selected={selectedIds.has(suggestion.id)}
                    onToggle={() => toggleSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {result.suggestions.length > 0 && (
            <div className="review-bar sticky-review">
              <div>
                <strong>{selectedIds.size} selected</strong>
                <span>Nothing changes until you confirm. Every target is checked again first.</span>
              </div>
              <button type="button" onClick={applySelected} disabled={selectedIds.size === 0 || applying || loading}>
                {applying ? 'Applying…' : 'Apply reviewed changes'}
              </button>
            </div>
          )}

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
