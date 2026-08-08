export type BookmarkPath = string[]

export type BookmarkTreeSource = {
  id: string
  title: string
  url?: string
  parentId?: string
  index?: number
  dateAdded?: number
  children?: BookmarkTreeSource[]
}

type BookmarkNodeBase = {
  id: string
  title: string
  parentId: string | null
  index: number
  path: BookmarkPath
  dateAdded: number | null
}

export type BookmarkItem = BookmarkNodeBase & {
  type: 'bookmark'
  url: string
  normalizedUrl: string
  domain: string
}

export type BookmarkFolder = BookmarkNodeBase & {
  type: 'folder'
  childIds: string[]
  isProtected: boolean
}

export type BookmarkNode = BookmarkItem | BookmarkFolder

export type BookmarkIndexes = {
  byId: Record<string, number>
  byParentId: Record<string, string[]>
  byDomain: Record<string, string[]>
  byNormalizedUrl: Record<string, string[]>
}

export type CleanupSuggestion = {
  id: string
  kind: 'delete-duplicate' | 'delete-empty-folder' | 'move-bookmark'
  targetId: string
  groupKey: string
  before: BookmarkNode
  confidence: number
  reasons: string[]
  selected: false
  duplicateType?: 'exact' | 'normalized'
  keepId?: string
  targetFolderId?: string
}

export type ScanSummary = {
  bookmarks: number
  folders: number
  duplicateGroups: number
  duplicateBookmarks: number
  emptyFolders: number
  classificationSuggestions: number
}

export type BookmarkScanResult = {
  scannedAt: number
  nodes: BookmarkNode[]
  indexes: BookmarkIndexes
  suggestions: CleanupSuggestion[]
  summary: ScanSummary
}
