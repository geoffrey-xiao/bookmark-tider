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
  store: Pick<OperationStore, 'saveBatch'>
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
    kind: 'apply',
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

  await dependencies.store.saveBatch(batch)

  for (const operation of batch.operations) {
    if (operation.status !== 'pending') continue
    operation.status = 'executing'
    await dependencies.store.saveBatch(batch)
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
    await dependencies.store.saveBatch(batch)
  }

  batch.completedAt = now()
  batch.status = finishStatus(batch.operations)
  await dependencies.store.saveBatch(batch)
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

async function restoreDeletedNode(
  before: BookmarkNode,
  bookmarks: BookmarksAdapter,
): Promise<BookmarkTreeSource> {
  const details = restoreDetails(before)
  const siblings = await bookmarks.getChildren(details.parentId)
  return bookmarks.create({
    ...details,
    index: Math.min(details.index, siblings.length),
  })
}

export async function undoBatch(
  sourceBatch: OperationBatch,
  dependencies: OperationDependencies,
): Promise<{ sourceBatch: OperationBatch; undoBatch: OperationBatch }> {
  const now = dependencies.now ?? Date.now
  const createId = dependencies.createId ?? (() => crypto.randomUUID())
  if (sourceBatch.kind !== 'apply') throw new Error('Undo batches cannot be undone.')
  if (sourceBatch.undoneByBatchId) throw new Error('This batch already has an undo record.')
  if (sourceBatch.status === 'running' || sourceBatch.status === 'interrupted') {
    throw new Error('Resolve the interrupted batch before undoing it.')
  }
  const reversible = [...sourceBatch.operations]
    .reverse()
    .filter((operation) => operation.status === 'success')
  if (reversible.length === 0) throw new Error('This batch has no successful operations to undo.')

  const undoBatch: OperationBatch = {
    schemaVersion: OPERATION_SCHEMA_VERSION,
    id: `undo:${createId()}`,
    kind: 'undo',
    sourceBatchId: sourceBatch.id,
    createdAt: now(),
    status: 'running',
    operations: reversible.map((operation) => ({
      ...operation,
      id: `undo:${operation.id}`,
      status: 'pending',
      error: undefined,
      undoStatus: undefined,
      undoError: undefined,
      restoredId: undefined,
    })),
  }
  await dependencies.store.saveBatch(undoBatch)

  for (const operation of undoBatch.operations) {
    operation.status = 'executing'
    await dependencies.store.saveBatch(undoBatch)
    try {
      if (operation.kind === 'move') {
        const current = await dependencies.bookmarks.get(operation.targetId)
        if (!current) throw new Error('The moved bookmark no longer exists.')
        if (current.parentId !== operation.after?.parentId) {
          operation.status = 'skipped'
          operation.error = 'The bookmark moved again after this batch.'
        } else if (operation.before.parentId === null) {
          throw new Error('The original folder is unavailable.')
        } else {
          await dependencies.bookmarks.move(operation.targetId, {
            parentId: operation.before.parentId,
            index: operation.before.index,
          })
          operation.status = 'success'
        }
      } else {
        const restored = await restoreDeletedNode(operation.before, dependencies.bookmarks)
        operation.restoredId = restored.id
        operation.status = 'success'
      }
    } catch (error) {
      operation.status = 'failed'
      operation.error = error instanceof Error ? error.message : 'Undo failed.'
    }
    await dependencies.store.saveBatch(undoBatch)
  }

  undoBatch.completedAt = now()
  undoBatch.status = finishStatus(undoBatch.operations)
  sourceBatch.undoneAt = undoBatch.completedAt
  sourceBatch.undoneByBatchId = undoBatch.id
  await dependencies.store.saveBatch(undoBatch)
  await dependencies.store.saveBatch(sourceBatch)
  return { sourceBatch, undoBatch }
}

export async function recoverInterruptedBatch(
  batch: OperationBatch,
  bookmarks: BookmarksAdapter,
): Promise<OperationBatch> {
  if (batch.status !== 'running' && batch.status !== 'interrupted') return batch

  for (const operation of batch.operations.filter((item) => item.status === 'pending')) {
    operation.status = 'skipped'
    operation.error = 'The worker stopped before this operation began.'
  }

  if (batch.kind === 'undo') {
    for (const operation of batch.operations.filter((item) => item.status === 'executing')) {
      if (operation.kind === 'move') {
        const current = await bookmarks.get(operation.targetId)
        if (current?.parentId === operation.before.parentId) {
          operation.status = 'success'
        } else if (current?.parentId === operation.after?.parentId) {
          operation.status = 'skipped'
          operation.error = 'The interrupted undo move was confirmed not to have run.'
        }
      } else if (operation.restoredId && await bookmarks.get(operation.restoredId)) {
        operation.status = 'success'
      }
    }

    batch.status = batch.operations.some((operation) => operation.status === 'executing')
      ? 'interrupted'
      : finishStatus(batch.operations)
    return batch
  }

  for (const operation of batch.operations.filter((item) => item.status === 'executing')) {
    const current = await bookmarks.get(operation.targetId)
    if (operation.kind === 'delete') {
      if (!current) operation.status = 'success'
      else if (nodeMatchesSnapshot(current, operation.before)) {
        operation.status = 'skipped'
        operation.error = 'The interrupted delete was confirmed not to have run.'
      }
    } else if (current?.parentId === operation.after?.parentId) {
      operation.status = 'success'
    } else if (current && nodeMatchesSnapshot(current, operation.before)) {
      operation.status = 'skipped'
      operation.error = 'The interrupted move was confirmed not to have run.'
    }
  }

  batch.status = batch.operations.some((operation) => operation.status === 'executing')
    ? 'interrupted'
    : finishStatus(batch.operations)
  return batch
}
