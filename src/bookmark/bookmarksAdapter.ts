import type { BookmarkTreeSource } from '../types/bookmarks'

export const bookmarksAdapter = {
  async getTree(): Promise<BookmarkTreeSource[]> {
    return chrome.bookmarks.getTree()
  },
}
