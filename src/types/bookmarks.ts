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
  source?: 'local-rule' | 'ai'
  model?: string
}

export type AiPrivacyMode = 'domain-only' | 'title-and-domain'

export type AiSettings = {
  enabled: boolean
  model: string
  privacyMode: AiPrivacyMode
  hasApiKey: boolean
}

export type AiSettingsUpdate = Omit<AiSettings, 'hasApiKey'> & {
  apiKey?: string
  clearApiKey?: boolean
}

export type AiClassificationSummary = {
  provider: 'openai'
  model: string
  privacyMode: AiPrivacyMode
  bookmarksConsidered: number
  bookmarksSent: number
  suggestionsCreated: number
  truncated: boolean
}

export type AiClassificationResult = BookmarkScanResult & {
  ai: AiClassificationSummary
}

export type ScanSummary = {
  bookmarks: number
  folders: number
  duplicateGroups: number
  duplicateBookmarks: number
  emptyFolders: number
  classificationSuggestions: number
}

export type ClassificationDiagnostics = {
  candidateFolders: number
  bookmarksVisited: number
  skippedCleanupTargets: number
  bookmarksAlreadyInMeaningfulFolder: number
  eligibleForClassification: number
  eligibleContentPlatformBookmarks: number
  bookmarksWithDomainCandidates: number
  bookmarksWithKeywordCandidates: number
  skippedNoCandidate: number
  skippedTopScoreTie: number
  skippedCurrentPlacementAsGoodOrBetter: number
  suggestionsCreated: number
}

export type ScanDiagnostics = {
  analyzerBuild: string
  rootNodes: number
  protectedFolders: number
  userFolders: number
  bookmarksByDepth: Record<string, number>
  foldersByDepth: Record<string, number>
  classification: ClassificationDiagnostics
}

export type BookmarkScanResult = {
  scannedAt: number
  nodes: BookmarkNode[]
  indexes: BookmarkIndexes
  suggestions: CleanupSuggestion[]
  summary: ScanSummary
  diagnostics: ScanDiagnostics
}
