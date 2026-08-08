import { describe, expect, it } from 'vitest'
import type { BookmarksAdapter } from './bookmarksAdapter'
import { executeSuggestions, undoBatch } from './operationEngine'
import type { OperationStore } from '../storage/operationStore'
import type { BookmarkFolder, BookmarkItem, BookmarkTreeSource, CleanupSuggestion } from '../types/bookmarks'
import type { OperationBatch } from '../types/operations'

const sourceFolder: BookmarkFolder = {
  id: 'folder-a',
  type: 'folder',
  title: 'Source',
  parentId: 'root',
  index: 0,
  path: ['Bookmarks Bar'],
  dateAdded: null,
  childIds: ['bookmark-1'],
  isProtected: false,
}

const destinationFolder: BookmarkFolder = {
  ...sourceFolder,
  id: 'folder-b',
  title: 'Destination',
  index: 1,
  childIds: [],
}

const bookmark: BookmarkItem = {
  id: 'bookmark-1',
  type: 'bookmark',
  title: 'Example',
  url: 'https://example.com',
  normalizedUrl: 'https://example.com/',
  domain: 'example.com',
  parentId: sourceFolder.id,
  index: 0,
  path: ['Bookmarks Bar', 'Source'],
  dateAdded: 10,
}

function deleteSuggestion(target: BookmarkItem = bookmark): CleanupSuggestion {
  return {
    id: `duplicate:${target.id}`,
    kind: 'delete-duplicate',
    targetId: target.id,
    groupKey: 'duplicate:https://example.com/',
    before: target,
    confidence: 1,
    reasons: ['Duplicate'],
    selected: false,
  }
}

function moveSuggestion(): CleanupSuggestion {
  return {
    id: `move:${bookmark.id}:${destinationFolder.id}`,
    kind: 'move-bookmark',
    targetId: bookmark.id,
    targetFolderId: destinationFolder.id,
    groupKey: `move:${destinationFolder.id}`,
    before: bookmark,
    confidence: 0.9,
    reasons: ['Matches existing folder'],
    selected: false,
  }
}

class MemoryBookmarks implements BookmarksAdapter {
  nodes = new Map<string, BookmarkTreeSource>()
  failRemoveId: string | null = null
  nextId = 100

  constructor(nodes: BookmarkTreeSource[]) {
    nodes.forEach((node) => this.nodes.set(node.id, { ...node }))
  }

  async getTree(): Promise<BookmarkTreeSource[]> { return [] }
  async get(id: string): Promise<BookmarkTreeSource | null> { return this.nodes.get(id) ?? null }
  async getChildren(id: string): Promise<BookmarkTreeSource[]> {
    return [...this.nodes.values()].filter((node) => node.parentId === id)
  }
  async move(id: string, destination: { parentId: string; index?: number }): Promise<BookmarkTreeSource> {
    const node = this.nodes.get(id)
    if (!node) throw new Error('Missing node')
    const moved = { ...node, parentId: destination.parentId, index: destination.index ?? 0 }
    this.nodes.set(id, moved)
    return moved
  }
  async remove(id: string): Promise<void> {
    if (id === this.failRemoveId) throw new Error('Synthetic remove failure')
    this.nodes.delete(id)
  }
  async create(details: { parentId: string; index: number; title: string; url?: string }): Promise<BookmarkTreeSource> {
    const created = { ...details, id: `restored-${this.nextId++}` }
    this.nodes.set(created.id, created)
    return created
  }
}

class MemoryStore implements OperationStore {
  latest: OperationBatch | null = null
  saves = 0

  async getLatestBatch(): Promise<OperationBatch | null> { return this.latest }
  async saveLatestBatch(batch: OperationBatch): Promise<void> {
    this.latest = batch
    this.saves += 1
  }
}

function dependencies(bookmarks: MemoryBookmarks, store = new MemoryStore()) {
  return {
    bookmarks,
    store,
    createId: () => 'batch-1',
    now: () => 1000,
  }
}

function sourceNodes(): BookmarkTreeSource[] {
  return [
    { id: 'root', title: '', parentId: undefined, index: 0 },
    { id: sourceFolder.id, title: sourceFolder.title, parentId: 'root', index: sourceFolder.index },
    { id: destinationFolder.id, title: destinationFolder.title, parentId: 'root', index: destinationFolder.index },
    { id: bookmark.id, title: bookmark.title, url: bookmark.url, parentId: bookmark.parentId ?? undefined, index: bookmark.index },
  ]
}

describe('operationEngine', () => {
  it('persists, executes, and restores a deleted bookmark with a new id', async () => {
    const bookmarks = new MemoryBookmarks(sourceNodes())
    const store = new MemoryStore()
    const deps = dependencies(bookmarks, store)

    const batch = await executeSuggestions([deleteSuggestion()], deps)
    expect(batch.status).toBe('success')
    expect(await bookmarks.get(bookmark.id)).toBeNull()
    expect(store.saves).toBeGreaterThanOrEqual(2)

    const undone = await undoBatch(batch, deps)
    expect(undone.status).toBe('undone')
    expect(undone.operations[0].restoredId).toBe('restored-100')
    expect(await bookmarks.get('restored-100')).toMatchObject({
      title: bookmark.title,
      url: bookmark.url,
      parentId: sourceFolder.id,
      index: bookmark.index,
    })
  })

  it('skips a node that changed after scanning', async () => {
    const nodes = sourceNodes().map((node) =>
      node.id === bookmark.id ? { ...node, title: 'Changed title' } : node,
    )
    const bookmarks = new MemoryBookmarks(nodes)

    const batch = await executeSuggestions([deleteSuggestion()], dependencies(bookmarks))
    expect(batch.status).toBe('failed')
    expect(batch.operations[0]).toMatchObject({ status: 'skipped', error: 'The target changed after the scan.' })
    expect(await bookmarks.get(bookmark.id)).not.toBeNull()
  })

  it('records partial failure without rolling back independent successes', async () => {
    const secondBookmark: BookmarkItem = { ...bookmark, id: 'bookmark-2', index: 1, title: 'Second' }
    const bookmarks = new MemoryBookmarks([
      ...sourceNodes(),
      { id: secondBookmark.id, title: secondBookmark.title, url: secondBookmark.url, parentId: secondBookmark.parentId ?? undefined, index: secondBookmark.index },
    ])
    bookmarks.failRemoveId = secondBookmark.id

    const batch = await executeSuggestions(
      [deleteSuggestion(), deleteSuggestion(secondBookmark)],
      dependencies(bookmarks),
    )
    expect(batch.status).toBe('partial')
    expect(batch.operations.map((operation) => operation.status)).toEqual(['success', 'failed'])
  })

  it('moves a bookmark and restores its original parent and index', async () => {
    const bookmarks = new MemoryBookmarks(sourceNodes())
    const deps = dependencies(bookmarks)

    const batch = await executeSuggestions([moveSuggestion()], deps)
    expect(await bookmarks.get(bookmark.id)).toMatchObject({ parentId: destinationFolder.id })

    const undone = await undoBatch(batch, deps)
    expect(undone.status).toBe('undone')
    expect(await bookmarks.get(bookmark.id)).toMatchObject({
      parentId: sourceFolder.id,
      index: bookmark.index,
    })
  })
})
