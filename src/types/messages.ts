import type { BookmarkScanResult } from './bookmarks'

export const MESSAGE_VERSION = 1 as const

export type AppRequest =
  | { version: typeof MESSAGE_VERSION; type: 'OPEN_MANAGER' }
  | { version: typeof MESSAGE_VERSION; type: 'SCAN_BOOKMARKS' }

export type ScanResponse = BookmarkScanResult

export type AppResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
