import type { BookmarkTreeSource } from '../types/bookmarks'

export const bookmarksAdapter = {
  async getTree(): Promise<BookmarkTreeSource[]> {
    return chrome.bookmarks.getTree()
  },

  async get(id: string): Promise<BookmarkTreeSource | null> {
    try {
      return (await chrome.bookmarks.get(id))[0] ?? null
    } catch {
      return null
    }
  },

  async getChildren(id: string): Promise<BookmarkTreeSource[]> {
    return chrome.bookmarks.getChildren(id)
  },

  async move(id: string, destination: { parentId: string; index?: number }): Promise<BookmarkTreeSource> {
    return chrome.bookmarks.move(id, destination)
  },

  async remove(id: string): Promise<void> {
    await chrome.bookmarks.remove(id)
  },

  async create(details: {
    parentId: string
    index: number
    title: string
    url?: string
  }): Promise<BookmarkTreeSource> {
    return chrome.bookmarks.create(details)
  },
}

export type BookmarksAdapter = typeof bookmarksAdapter
