import type { BookmarkScanResult, CleanupSuggestion } from './bookmarks'
import type {
  ApplySuggestionsResponse,
  LatestBatchResponse,
  OperationHistoryResponse,
  UndoBatchResponse,
} from './operations'

export const MESSAGE_VERSION = 1 as const

export type AppRequest =
  | { version: typeof MESSAGE_VERSION; type: 'OPEN_MANAGER' }
  | { version: typeof MESSAGE_VERSION; type: 'SCAN_BOOKMARKS' }
  | { version: typeof MESSAGE_VERSION; type: 'APPLY_SUGGESTIONS'; suggestions: CleanupSuggestion[] }
  | { version: typeof MESSAGE_VERSION; type: 'GET_LATEST_BATCH' }
  | { version: typeof MESSAGE_VERSION; type: 'GET_OPERATION_HISTORY' }
  | { version: typeof MESSAGE_VERSION; type: 'UNDO_LATEST_BATCH' }

export type ScanResponse = BookmarkScanResult
export type ApplyResponse = ApplySuggestionsResponse
export type LatestBatchResult = LatestBatchResponse
export type OperationHistoryResult = OperationHistoryResponse
export type UndoResponse = UndoBatchResponse

export type AppResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
