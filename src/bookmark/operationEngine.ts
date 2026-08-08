import type { BookmarksAdapter } from './bookmarksAdapter'
import type { OperationStore } from '../storage/operationStore'
import type { BookmarkNode, BookmarkTreeSource, CleanupSuggestion } from '../types/bookmarks'
import {
  OPERATION_SCHEMA_VERSION,
  type OperationBatch,
  type OperationRecord,
} from '../types/operations'

export type OperationDependencies = {
  bookmarks: BookmarksAdapter
  store: OperationStore
  createId?: () => string
  now?: () => number
}

function nodeMatchesSnapshot(current: BookmarkTreeSource, before: BookmarkNode): boolean {
  const sameType = before.type === 'bookmark' ? current.url !== undefined : current.url === undefined
  return sameType
    && current.title.trim() === before.title
    && (current.url ?? null) === (before.type === 'bookmark' ? before.url : null)
    && (current.parentId ?? null) === before.parentId
    && (current.index ?? before.index) === before.index
}

function makeOperation(suggestion: CleanupSuggestion): OperationRecord {
  return {
    id: `operation:${suggestion.id}`,
    suggestion,
    kind: suggestion.kind === 'move-bookmark' ? 'move' : 'delete',
    targetId: suggestion.targetId,
    before: suggestion.before,
    after: suggestion.targetFolderId ? { parentId: suggestion.targetFolderId } : undefined,
    status: 'pending',
  }
}

async function prevalidate(operation: OperationRecord, bookmarks: BookmarksAdapter): Promise<string | null> {
  const current = await bookmarks.get(operation.targetId)
  if (!current) return 'The target no longer exists.'
  if (!nodeMatchesSnapshot(current, operation.before)) return 'The target changed after the scan.'

  if (operation.suggestion.kind === 'delete-empty-folder') {
    const children = await bookmarks.getChildren(operation.targetId)
    if (children.length > 0) return 'The folder is no longer empty.'
  }

  if (operation.kind === 'move') {
    if (!operation.after) return 'The move has no destination.'
    const destination = await bookmarks.get(operation.after.parentId)
    if (!destination || destination.url !== undefined) return 'The destination folder no longer exists.'
    if (operation.before.parentId === operation.after.parentId) return 'The bookmark is already in that folder.'
  }

  return null
}

function finishStatus(operations: OperationRecord[]): OperationBatch['status'] {
  const successes = operations.filter((operation) => operation.status === 'success').length
  if (successes === operations.length && successes > 0) return 'success'
  if (successes > 0) return 'partial'
  return 'failed'
}

export async function executeSuggestions(
  suggestions: CleanupSuggestion[],
  dependencies: OperationDependencies,
): Promise<OperationBatch> {
  const now = dependencies.now ?? Date.now
  const createId = dependencies.createId ?? (() => crypto.randomUUID())
  const uniqueSuggestions = suggestions.filter((suggestion, index, all) =>
    all.findIndex((candidate) => candidate.targetId === suggestion.targetId) === index,
  )
  const batch: OperationBatch = {
    schemaVersion: OPERATION_SCHEMA_VERSION,
    id: createId(),
    createdAt: now(),
    status: 'running',
    operations: uniqueSuggestions.map(makeOperation),
  }

  for (const operation of batch.operations) {
    try {
      const validationError = await prevalidate(operation, dependencies.bookmarks)
      if (validationError) {
        operation.status = 'skipped'
        operation.error = validationError
      }
    } catch (error) {
      operation.status = 'skipped'
      operation.error = error instanceof Error ? error.message : 'Validation failed.'
    }
  }

  await dependencies.store.saveLatestBatch(batch)

  for (const operation of batch.operations) {
    if (operation.status !== 'pending') continue
    try {
      if (operation.kind === 'move' && operation.after) {
        await dependencies.bookmarks.move(operation.targetId, { parentId: operation.after.parentId })
      } else {
        await dependencies.bookmarks.remove(operation.targetId)
      }
      operation.status = 'success'
    } catch (error) {
      operation.status = 'failed'
      operation.error = error instanceof Error ? error.message : 'Bookmark operation failed.'
    }
    await dependencies.store.saveLatestBatch(batch)
  }

  batch.completedAt = now()
  batch.status = finishStatus(batch.operations)
  await dependencies.store.saveLatestBatch(batch)
  return batch
}

function restoreDetails(before: BookmarkNode): {
  parentId: string
  index: number
  title: string
  url?: string
} {
  if (before.parentId === null) throw new Error('Root nodes cannot be restored.')
  return {
    parentId: before.parentId,
    index: before.index,
    title: before.title,
    url: before.type === 'bookmark' ? before.url : undefined,
  }
}

export async function undoBatch(
  batch: OperationBatch,
  dependencies: OperationDependencies,
): Promise<OperationBatch> {
  if (batch.status === 'undone') return batch
  const now = dependencies.now ?? Date.now
  const reversible = [...batch.operations].reverse().filter((operation) => operation.status === 'success')

  for (const operation of reversible) {
    if (operation.undoStatus === 'success') continue
    operation.undoStatus = 'pending'
    try {
      if (operation.kind === 'move') {
        const current = await dependencies.bookmarks.get(operation.targetId)
        if (!current) throw new Error('The moved bookmark no longer exists.')
        if (current.parentId !== operation.after?.parentId) {
          operation.undoStatus = 'skipped'
          operation.undoError = 'The bookmark moved again after this batch.'
        } else if (operation.before.parentId === null) {
          throw new Error('The original folder is unavailable.')
        } else {
          await dependencies.bookmarks.move(operation.targetId, {
            parentId: operation.before.parentId,
            index: operation.before.index,
          })
          operation.undoStatus = 'success'
        }
      } else {
        const restored = await dependencies.bookmarks.create(restoreDetails(operation.before))
        operation.restoredId = restored.id
        operation.undoStatus = 'success'
      }
    } catch (error) {
      operation.undoStatus = 'failed'
      operation.undoError = error instanceof Error ? error.message : 'Undo failed.'
    }
    await dependencies.store.saveLatestBatch(batch)
  }

  const undoSucceeded = reversible.length > 0
    && reversible.every((operation) => operation.undoStatus === 'success')
  batch.undoneAt = now()
  batch.status = undoSucceeded ? 'undone' : 'undo-partial'
  await dependencies.store.saveLatestBatch(batch)
  return batch
}
