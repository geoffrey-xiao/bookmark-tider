import type { BookmarkNode, CleanupSuggestion } from './bookmarks'

export const OPERATION_SCHEMA_VERSION = 2 as const

export type OperationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'skipped'
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
  kind: 'apply' | 'undo'
  sourceBatchId?: string
  undoneByBatchId?: string
  createdAt: number
  completedAt?: number
  undoneAt?: number
  status: 'running' | 'interrupted' | 'success' | 'partial' | 'failed' | 'undone' | 'undo-partial'
  operations: OperationRecord[]
}

export type ApplySuggestionsResponse = OperationBatch
export type LatestBatchResponse = OperationBatch | null
export type OperationHistoryResponse = OperationBatch[]
export type UndoBatchResponse = {
  sourceBatch: OperationBatch
  undoBatch: OperationBatch
}
