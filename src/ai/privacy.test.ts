import { describe, expect, it } from 'vitest'
import type { BookmarkFolder, BookmarkItem, BookmarkNode } from '../types/bookmarks'
import { minimizeBookmark } from './privacy'

const folder: BookmarkFolder = {
  id: 'folder', type: 'folder', title: 'Research', parentId: '0', index: 0,
  path: ['Bookmarks'], dateAdded: 1, childIds: ['bookmark'], isProtected: false,
}
const bookmark: BookmarkItem = {
  id: 'bookmark', type: 'bookmark', title: 'Private title', url: 'https://example.com/private/path?token=secret',
  normalizedUrl: 'https://example.com/private/path?token=secret', domain: 'example.com', parentId: 'folder',
  index: 0, path: ['Bookmarks', 'Research'], dateAdded: 1,
}
const byId = new Map<string, BookmarkNode>([[folder.id, folder], [bookmark.id, bookmark]])

describe('minimizeBookmark', () => {
  it('sends only a local ref and domain in domain-only mode', () => {
    expect(minimizeBookmark(bookmark, 'b1', 'domain-only', byId)).toEqual({ ref: 'b1', domain: 'example.com' })
  })

  it('never includes the full URL in title-and-domain mode', () => {
    const minimized = minimizeBookmark(bookmark, 'b1', 'title-and-domain', byId)
    expect(minimized).toEqual({ ref: 'b1', domain: 'example.com', title: 'Private title', currentFolder: 'Research' })
    expect(JSON.stringify(minimized)).not.toContain(bookmark.url)
  })
})
