export const MESSAGE_VERSION = 1 as const

export type AppRequest =
  | { version: typeof MESSAGE_VERSION; type: 'OPEN_MANAGER' }
  | { version: typeof MESSAGE_VERSION; type: 'SCAN_BOOKMARKS' }

export type ScanSummary = {
  bookmarks: number
  folders: number
}

export type AppResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

