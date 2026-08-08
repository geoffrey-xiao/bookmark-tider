export const bookmarksAdapter = {
  async getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getTree()
  },
}

