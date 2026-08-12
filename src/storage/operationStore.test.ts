import { describe, expect, it } from 'vitest'
import { OPERATION_SCHEMA_VERSION, type OperationBatch } from '../types/operations'
import {
  createOperationStore,
  OPERATION_HISTORY_LIMIT,
  OPERATION_STORAGE_SCHEMA_VERSION,
} from './operationStore'

const STATE_KEY = 'bookmarkTidy.operationState'

function batch(id: string, createdAt = 1): OperationBatch {
  return {
    schemaVersion: OPERATION_SCHEMA_VERSION,
    id,
    kind: 'apply',
    createdAt,
    status: 'success',
    operations: [],
  }
}

class MemoryStorage {
  values: Record<string, unknown>

  constructor(initial: Record<string, unknown> = {}) {
    this.values = initial
  }

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] }
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items)
  }
}

describe('operationStore', () => {
  it('migrates the v0.1 latest batch into v0.2 history', async () => {
    const latest = { ...batch('legacy'), schemaVersion: 1 as const }
    const storage = new MemoryStorage({
      [STATE_KEY]: { schemaVersion: 1, latestBatch: latest },
    })
    const store = createOperationStore(storage)

    const migrated = { ...latest, schemaVersion: OPERATION_SCHEMA_VERSION, kind: 'apply' as const }
    await expect(store.getHistory()).resolves.toEqual([migrated])
    expect(storage.values[STATE_KEY]).toEqual({
      schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION,
      batches: [migrated],
    })
  })

  it('prepends new batches and updates an existing batch in place', async () => {
    const storage = new MemoryStorage()
    const store = createOperationStore(storage)
    const first = batch('first', 1)
    const second = batch('second', 2)

    await store.saveBatch(first)
    await store.saveBatch(second)
    await store.saveBatch({ ...first, status: 'undone' })

    await expect(store.getHistory()).resolves.toEqual([
      second,
      { ...first, status: 'undone' },
    ])
    await expect(store.getLatestBatch()).resolves.toEqual(second)
  })

  it('retains only the newest bounded history', async () => {
    const storage = new MemoryStorage()
    const store = createOperationStore(storage)

    for (let index = 0; index < OPERATION_HISTORY_LIMIT + 5; index += 1) {
      await store.saveBatch(batch(`batch-${index}`, index))
    }

    const history = await store.getHistory()
    expect(history).toHaveLength(OPERATION_HISTORY_LIMIT)
    expect(history[0].id).toBe(`batch-${OPERATION_HISTORY_LIMIT + 4}`)
    expect(history.at(-1)?.id).toBe('batch-5')
  })

  it('recovers from malformed storage without exposing invalid batches', async () => {
    const storage = new MemoryStorage({
      [STATE_KEY]: { schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION, batches: [{ nope: true }] },
    })
    const store = createOperationStore(storage)

    await expect(store.getHistory()).resolves.toEqual([])
  })
})
