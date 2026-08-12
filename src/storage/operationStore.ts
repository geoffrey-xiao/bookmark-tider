import { OPERATION_SCHEMA_VERSION, type OperationBatch } from '../types/operations'

export const OPERATION_STORAGE_SCHEMA_VERSION = 2 as const
export const OPERATION_HISTORY_LIMIT = 50

const OPERATION_STATE_KEY = 'bookmarkTidy.operationState'

export type StoredOperationState = {
  schemaVersion: typeof OPERATION_STORAGE_SCHEMA_VERSION
  batches: OperationBatch[]
}

type StorageArea = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

function isOperationBatch(value: unknown): value is Omit<OperationBatch, 'schemaVersion' | 'kind'> & {
  schemaVersion?: number
  kind?: OperationBatch['kind']
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OperationBatch>
  return typeof candidate.id === 'string'
    && typeof candidate.createdAt === 'number'
    && typeof candidate.status === 'string'
    && Array.isArray(candidate.operations)
}

function normalizeOperationBatch(value: unknown): OperationBatch | null {
  if (!isOperationBatch(value)) return null
  if (value.schemaVersion === OPERATION_SCHEMA_VERSION && (value.kind === 'apply' || value.kind === 'undo')) {
    return value as OperationBatch
  }
  return {
    ...value,
    schemaVersion: OPERATION_SCHEMA_VERSION,
    kind: value.kind === 'undo' ? 'undo' : 'apply',
  }
}

function migrateStoredState(value: unknown): StoredOperationState {
  if (!value || typeof value !== 'object') {
    return { schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION, batches: [] }
  }

  const candidate = value as {
    schemaVersion?: unknown
    batches?: unknown
    latestBatch?: unknown
  }
  if (candidate.schemaVersion === OPERATION_STORAGE_SCHEMA_VERSION && Array.isArray(candidate.batches)) {
    return {
      schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION,
      batches: candidate.batches
        .map(normalizeOperationBatch)
        .filter((batch): batch is OperationBatch => batch !== null)
        .slice(0, OPERATION_HISTORY_LIMIT),
    }
  }

  if (candidate.schemaVersion === 1) {
    const latestBatch = normalizeOperationBatch(candidate.latestBatch)
    return {
      schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION,
      batches: latestBatch ? [latestBatch] : [],
    }
  }

  return { schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION, batches: [] }
}

function statesMatch(value: unknown, state: StoredOperationState): boolean {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredOperationState>
  return candidate.schemaVersion === state.schemaVersion
    && Array.isArray(candidate.batches)
    && candidate.batches.length === state.batches.length
    && candidate.batches.every((batch, index) => batch === state.batches[index])
}

export function createOperationStore(storage: StorageArea) {
  const readState = async (): Promise<StoredOperationState> => {
    const stored = await storage.get(OPERATION_STATE_KEY)
    const rawState: unknown = stored[OPERATION_STATE_KEY]
    const state = migrateStoredState(rawState)
    if (!statesMatch(rawState, state)) {
      await storage.set({ [OPERATION_STATE_KEY]: state })
    }
    return state
  }

  return {
    async getLatestBatch(): Promise<OperationBatch | null> {
      const state = await readState()
      return state.batches[0] ?? null
    },

    async getHistory(): Promise<OperationBatch[]> {
      const state = await readState()
      return state.batches
    },

    async getBatch(batchId: string): Promise<OperationBatch | null> {
      const state = await readState()
      return state.batches.find((batch) => batch.id === batchId) ?? null
    },

    async saveBatch(batch: OperationBatch): Promise<void> {
      const state = await readState()
      const existingIndex = state.batches.findIndex((candidate) => candidate.id === batch.id)
      const batches = existingIndex === -1
        ? [batch, ...state.batches]
        : state.batches.map((candidate, index) => index === existingIndex ? batch : candidate)

      await storage.set({
        [OPERATION_STATE_KEY]: {
          schemaVersion: OPERATION_STORAGE_SCHEMA_VERSION,
          batches: batches.slice(0, OPERATION_HISTORY_LIMIT),
        } satisfies StoredOperationState,
      })
    },
  }
}

const chromeStorage: StorageArea = {
  async get(key) {
    return chrome.storage.local.get(key)
  },
  async set(items) {
    await chrome.storage.local.set(items)
  },
}

export const operationStore = createOperationStore(chromeStorage)

export type OperationStore = ReturnType<typeof createOperationStore>
