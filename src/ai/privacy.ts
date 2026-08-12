import type { AiPrivacyMode, BookmarkFolder, BookmarkItem, BookmarkNode } from '../types/bookmarks'

export type PrivateBookmarkInput = {
  ref: string
  domain: string
  title?: string
  currentFolder?: string
}

export type PrivateFolderInput = {
  ref: string
  title: string
}

function parentFolder(bookmark: BookmarkItem, byId: Map<string, BookmarkNode>): BookmarkFolder | undefined {
  const parent = bookmark.parentId ? byId.get(bookmark.parentId) : undefined
  return parent?.type === 'folder' ? parent : undefined
}

export function minimizeBookmark(
  bookmark: BookmarkItem,
  ref: string,
  mode: AiPrivacyMode,
  byId: Map<string, BookmarkNode>,
): PrivateBookmarkInput {
  const input: PrivateBookmarkInput = { ref, domain: bookmark.domain }
  if (mode === 'title-and-domain') {
    input.title = bookmark.title
    input.currentFolder = parentFolder(bookmark, byId)?.title ?? ''
  }
  return input
}
