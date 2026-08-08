import type { BookmarkScanResult } from '../types/bookmarks'
import { analyzeBookmarks } from './analyzeBookmarks'
import { bookmarksAdapter } from './bookmarksAdapter'
import { scanBookmarkTree } from './scanner'

export async function scanBookmarks(): Promise<BookmarkScanResult> {
  const tree = await bookmarksAdapter.getTree()
  return analyzeBookmarks(scanBookmarkTree(tree))
}

