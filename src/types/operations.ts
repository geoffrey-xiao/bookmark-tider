import type { BookmarkNode, CleanupSuggestion } from './bookmarks'

export const OPERATION_SCHEMA_VERSION = 1 as const

export type OperationStatus = 'pending' | 'success' | 'failed' | 'skipped'
export type UndoStatus = 'pending' | 'success' | 'failed' | 'skipped'

export type OperationRecord = {
  id: string
  suggestion: CleanupSuggestion
  kind: 'move' | 'delete'
  targetId: string
  before: BookmarkNode
  after?: { parentId: string }
  status: OperationStatus
  error?: string
  undoStatus?: UndoStatus
  undoError?: string
  restoredId?: string
}

export type OperationBatch = {
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  id: string
  createdAt: number
  completedAt?: number
  undoneAt?: number
  status: 'running' | 'success' | 'partial' | 'failed' | 'undone' | 'undo-partial'
  operations: OperationRecord[]
}

export type ApplySuggestionsResponse = OperationBatch
export type LatestBatchResponse = OperationBatch | null
export type UndoBatchResponse = OperationBatch

