import { describe, expect, it } from 'vitest'
import type { BookmarksAdapter } from './bookmarksAdapter'
import { executeSuggestions, recoverInterruptedBatch, undoBatch } from './operationEngine'
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

function emptyFolderSuggestion(folder: BookmarkFolder): CleanupSuggestion {
  return {
    id: `empty-folder:${folder.id}`,
    kind: 'delete-empty-folder',
    targetId: folder.id,
    groupKey: `empty-folder:${folder.id}`,
    before: folder,
    confidence: 1,
    reasons: ['Empty folder'],
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
    const removed = this.nodes.get(id)
    this.nodes.delete(id)
    if (!removed?.parentId || removed.index === undefined) return
    for (const [nodeId, node] of this.nodes) {
      if (node.parentId === removed.parentId && (node.index ?? 0) > removed.index) {
        this.nodes.set(nodeId, { ...node, index: (node.index ?? 0) - 1 })
      }
    }
  }
  async create(details: { parentId: string; index: number; title: string; url?: string }): Promise<BookmarkTreeSource> {
    const siblings = await this.getChildren(details.parentId)
    if (details.index > siblings.length) throw new Error('Index out of bounds')
    for (const sibling of siblings) {
      if ((sibling.index ?? 0) >= details.index) {
        this.nodes.set(sibling.id, { ...sibling, index: (sibling.index ?? 0) + 1 })
      }
    }
    const created = { ...details, id: `restored-${this.nextId++}` }
    this.nodes.set(created.id, created)
    return created
  }
}

class MemoryStore implements Pick<OperationStore, 'getLatestBatch' | 'saveBatch'> {
  latest: OperationBatch | null = null
  saves = 0

  async getLatestBatch(): Promise<OperationBatch | null> { return this.latest }
  async saveBatch(batch: OperationBatch): Promise<void> {
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
    expect(undone.undoBatch.status).toBe('success')
    expect(undone.undoBatch.kind).toBe('undo')
    expect(undone.sourceBatch.undoneByBatchId).toBe(undone.undoBatch.id)
    expect(undone.undoBatch.operations[0].restoredId).toBe('restored-100')
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

  it('skips an empty folder that gained a child after scanning', async () => {
    const emptyFolder: BookmarkFolder = {
      ...sourceFolder,
      id: 'empty-folder',
      title: 'Was empty',
      childIds: [],
    }
    const bookmarks = new MemoryBookmarks([
      ...sourceNodes(),
      { id: emptyFolder.id, title: emptyFolder.title, parentId: emptyFolder.parentId ?? undefined, index: emptyFolder.index },
      { id: 'new-child', title: 'Added later', url: 'https://later.example', parentId: emptyFolder.id, index: 0 },
    ])

    const batch = await executeSuggestions([emptyFolderSuggestion(emptyFolder)], dependencies(bookmarks))
    expect(batch.operations[0]).toMatchObject({
      status: 'skipped',
      error: 'The folder is no longer empty.',
    })
    expect(await bookmarks.get(emptyFolder.id)).not.toBeNull()
  })

  it('moves a bookmark and restores its original parent and index', async () => {
    const bookmarks = new MemoryBookmarks(sourceNodes())
    const deps = dependencies(bookmarks)

    const batch = await executeSuggestions([moveSuggestion()], deps)
    expect(await bookmarks.get(bookmark.id)).toMatchObject({ parentId: destinationFolder.id })

    const undone = await undoBatch(batch, deps)
    expect(undone.undoBatch.status).toBe('success')
    expect(await bookmarks.get(bookmark.id)).toMatchObject({
      parentId: sourceFolder.id,
      index: bookmark.index,
    })
  })

  it('restores adjacent deletions in their original order when later indexes are temporarily unavailable', async () => {
    const duplicate: BookmarkItem = {
      ...bookmark,
      id: 'bookmark-2',
      index: 1,
    }
    const emptyFolder: BookmarkFolder = {
      ...sourceFolder,
      id: 'empty-folder',
      title: 'Empty',
      index: 2,
      childIds: [],
    }
    const bookmarks = new MemoryBookmarks([
      ...sourceNodes(),
      {
        id: duplicate.id,
        title: duplicate.title,
        url: duplicate.url,
        parentId: duplicate.parentId ?? undefined,
        index: duplicate.index,
      },
      {
        id: emptyFolder.id,
        title: emptyFolder.title,
        parentId: emptyFolder.parentId ?? undefined,
        index: emptyFolder.index,
      },
    ])
    const deps = dependencies(bookmarks)

    const batch = await executeSuggestions(
      [deleteSuggestion(duplicate), emptyFolderSuggestion(emptyFolder)],
      deps,
    )
    const undone = await undoBatch(batch, deps)

    expect(undone.undoBatch.status).toBe('success')
    const restoredFolderId = undone.undoBatch.operations[0].restoredId
    const restoredDuplicateId = undone.undoBatch.operations[1].restoredId
    expect(restoredDuplicateId).toBeDefined()
    expect(restoredFolderId).toBeDefined()
    expect(await bookmarks.get(restoredDuplicateId!)).toMatchObject({ index: 1 })
    expect(await bookmarks.get(restoredFolderId!)).toMatchObject({ index: 2 })
  })

  it('recovers the outcome of an operation interrupted after the browser applied it', async () => {
    const bookmarks = new MemoryBookmarks(sourceNodes())
    const batch = await executeSuggestions([deleteSuggestion()], dependencies(bookmarks))
    const persistedDuringExecution: OperationBatch = {
      ...batch,
      status: 'running',
      operations: batch.operations.map((operation) => ({ ...operation, status: 'executing' })),
    }

    const recovered = await recoverInterruptedBatch(persistedDuringExecution, bookmarks)
    expect(recovered.status).toBe('success')
    expect(recovered.operations[0].status).toBe('success')
  })

  it('recovers an interrupted undo move after the browser restored the original parent', async () => {
    const bookmarks = new MemoryBookmarks(sourceNodes())
    const deps = dependencies(bookmarks)
    const applied = await executeSuggestions([moveSuggestion()], deps)
    const undone = await undoBatch(applied, deps)
    const persistedDuringUndo: OperationBatch = {
      ...undone.undoBatch,
      status: 'running',
      operations: undone.undoBatch.operations.map((operation) => ({ ...operation, status: 'executing' })),
    }

    const recovered = await recoverInterruptedBatch(persistedDuringUndo, bookmarks)
    expect(recovered.status).toBe('success')
    expect(recovered.operations[0].status).toBe('success')
  })
})
