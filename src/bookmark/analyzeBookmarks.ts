import type {
  BookmarkFolder,
  BookmarkItem,
  BookmarkNode,
  BookmarkScanResult,
  CleanupSuggestion,
} from '../types/bookmarks'
import type { ScannedBookmarkTree } from './scanner'
import { classifyBookmarksWithDiagnostics } from '../rules/classifyBookmarks'

const ANALYZER_BUILD = 'diagnostics-2026-08-08-v2-folder-comparison'

function incrementDepth(index: Record<string, number>, depth: number): void {
  const key = String(depth)
  index[key] = (index[key] ?? 0) + 1
}

function chooseKeeper(bookmarks: BookmarkItem[]): BookmarkItem {
  return [...bookmarks].sort((left, right) => {
    const leftDate = left.dateAdded ?? Number.POSITIVE_INFINITY
    const rightDate = right.dateAdded ?? Number.POSITIVE_INFINITY
    if (leftDate !== rightDate) return leftDate - rightDate
    if (left.path.length !== right.path.length) return left.path.length - right.path.length
    return left.id.localeCompare(right.id, undefined, { numeric: true })
  })[0]
}

function duplicateSuggestions(nodes: BookmarkNode[]): CleanupSuggestion[] {
  const groups = new Map<string, BookmarkItem[]>()

  for (const node of nodes) {
    if (node.type !== 'bookmark' || !node.normalizedUrl) continue
    const group = groups.get(node.normalizedUrl) ?? []
    group.push(node)
    groups.set(node.normalizedUrl, group)
  }

  const suggestions: CleanupSuggestion[] = []
  const sortedGroups = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))

  for (const [normalizedUrl, bookmarks] of sortedGroups) {
    if (bookmarks.length < 2) continue
    const keeper = chooseKeeper(bookmarks)
    const duplicateType = bookmarks.every((bookmark) => bookmark.url === bookmarks[0].url)
      ? 'exact'
      : 'normalized'

    for (const bookmark of bookmarks) {
      if (bookmark.id === keeper.id) continue
      suggestions.push({
        id: `duplicate:${bookmark.id}`,
        kind: 'delete-duplicate',
        targetId: bookmark.id,
        groupKey: `duplicate:${normalizedUrl}`,
        before: bookmark,
        confidence: duplicateType === 'exact' ? 1 : 0.9,
        reasons: [
          duplicateType === 'exact'
            ? `Same URL as “${keeper.title || keeper.url}”.`
            : `Same normalized URL as “${keeper.title || keeper.url}”.`,
          'The earliest bookmark is suggested as the keeper.',
        ],
        selected: false,
        duplicateType,
        keepId: keeper.id,
      })
    }
  }

  return suggestions
}

function emptyFolderSuggestions(nodes: BookmarkNode[]): CleanupSuggestion[] {
  return nodes
    .filter((node): node is BookmarkFolder =>
      node.type === 'folder' && !node.isProtected && node.childIds.length === 0,
    )
    .map((folder) => ({
      id: `empty-folder:${folder.id}`,
      kind: 'delete-empty-folder' as const,
      targetId: folder.id,
      groupKey: `empty-folder:${folder.id}`,
      before: folder,
      confidence: 1,
      reasons: ['This folder contains no bookmarks or subfolders.'],
      selected: false as const,
    }))
}

export function analyzeBookmarks(scan: ScannedBookmarkTree): BookmarkScanResult {
  const duplicateItems = duplicateSuggestions(scan.nodes)
  const emptyFolders = emptyFolderSuggestions(scan.nodes)
  const cleanupSuggestions = [...duplicateItems, ...emptyFolders]
  const classification = classifyBookmarksWithDiagnostics(scan.nodes, cleanupSuggestions)
  const classificationSuggestions = classification.suggestions
  const duplicateGroups = new Set(duplicateItems.map((suggestion) => suggestion.groupKey)).size
  const depthsById = new Map<string, number>()
  const bookmarksByDepth: Record<string, number> = {}
  const foldersByDepth: Record<string, number> = {}

  for (const node of scan.nodes) {
    const depth = node.parentId === null ? 0 : (depthsById.get(node.parentId) ?? -1) + 1
    depthsById.set(node.id, depth)
    incrementDepth(node.type === 'bookmark' ? bookmarksByDepth : foldersByDepth, depth)
  }

  return {
    scannedAt: Date.now(),
    nodes: scan.nodes,
    indexes: scan.indexes,
    suggestions: [...cleanupSuggestions, ...classificationSuggestions],
    summary: {
      bookmarks: scan.nodes.filter((node) => node.type === 'bookmark').length,
      folders: scan.nodes.filter((node) => node.type === 'folder').length,
      duplicateGroups,
      duplicateBookmarks: duplicateItems.length,
      emptyFolders: emptyFolders.length,
      classificationSuggestions: classificationSuggestions.length,
    },
    diagnostics: {
      analyzerBuild: ANALYZER_BUILD,
      rootNodes: scan.nodes.filter((node) => node.parentId === null).length,
      protectedFolders: scan.nodes.filter((node) => node.type === 'folder' && node.isProtected).length,
      userFolders: scan.nodes.filter((node) => node.type === 'folder' && !node.isProtected).length,
      bookmarksByDepth,
      foldersByDepth,
      classification: classification.diagnostics,
    },
  }
}
