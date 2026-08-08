import { OPERATION_SCHEMA_VERSION, type OperationBatch } from '../types/operations'

const OPERATION_STATE_KEY = 'bookmarkTidy.operationState'

type StoredOperationState = {
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  latestBatch: OperationBatch | null
}

function isStoredOperationState(value: unknown): value is StoredOperationState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredOperationState>
  return candidate.schemaVersion === OPERATION_SCHEMA_VERSION
    && (candidate.latestBatch === null || typeof candidate.latestBatch === 'object')
}

export const operationStore = {
  async getLatestBatch(): Promise<OperationBatch | null> {
    const stored = await chrome.storage.local.get(OPERATION_STATE_KEY)
    const state: unknown = stored[OPERATION_STATE_KEY]
    return isStoredOperationState(state) ? state.latestBatch : null
  },

  async saveLatestBatch(batch: OperationBatch): Promise<void> {
    const state: StoredOperationState = {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      latestBatch: batch,
    }
    await chrome.storage.local.set({ [OPERATION_STATE_KEY]: state })
  },
}

export type OperationStore = typeof operationStore

