import { bookmarksAdapter } from '../bookmark/bookmarksAdapter'
import { addAiClassifications } from '../ai/classifyBookmarks'
import { executeSuggestions, recoverInterruptedBatch, undoBatch } from '../bookmark/operationEngine'
import { scanBookmarks } from '../bookmark/scanBookmarks'
import { runtimeAdapter } from '../chrome/runtimeAdapter'
import { operationStore } from '../storage/operationStore'
import { aiSettingsStore } from '../storage/aiSettingsStore'
import { MESSAGE_VERSION, type AppRequest, type AppResponse } from '../types/messages'

chrome.runtime.onMessage.addListener(
  (request: AppRequest, _sender, sendResponse: (response: AppResponse) => void) => {
    const handle = async (): Promise<AppResponse> => {
      if (request.version !== MESSAGE_VERSION) {
        return { ok: false, error: { code: 'UNSUPPORTED_VERSION', message: 'Unsupported message version.' } }
      }

      switch (request.type) {
        case 'OPEN_MANAGER':
          await runtimeAdapter.openTab(runtimeAdapter.managerUrl())
          return { ok: true, data: null }
        case 'SCAN_BOOKMARKS':
          return { ok: true, data: await scanBookmarks() }
        case 'GET_AI_SETTINGS':
          return { ok: true, data: await aiSettingsStore.get() }
        case 'SAVE_AI_SETTINGS':
          return { ok: true, data: await aiSettingsStore.save(request.settings) }
        case 'CLASSIFY_WITH_AI': {
          const settings = await aiSettingsStore.getApiConfiguration()
          if (!settings.enabled) {
            return { ok: false, error: { code: 'AI_DISABLED', message: 'Enable AI classification in settings first.' } }
          }
          if (!settings.apiKey) {
            return { ok: false, error: { code: 'AI_KEY_MISSING', message: 'Add an OpenAI API key in AI settings first.' } }
          }
          const scan = await scanBookmarks()
          return {
            ok: true,
            data: await addAiClassifications({
              scan,
              apiKey: settings.apiKey,
              model: settings.model,
              privacyMode: settings.privacyMode,
            }),
          }
        }
        case 'APPLY_SUGGESTIONS':
          if (request.suggestions.length === 0) {
            return { ok: false, error: { code: 'EMPTY_BATCH', message: 'Select at least one suggestion.' } }
          }
          {
            const previousBatch = await operationStore.getLatestBatch()
            if (previousBatch?.status === 'running' || previousBatch?.status === 'interrupted') {
              return {
                ok: false,
                error: { code: 'UNRESOLVED_BATCH', message: 'Resolve the interrupted batch before applying more changes.' },
              }
            }
          }
          return {
            ok: true,
            data: await executeSuggestions(request.suggestions, {
              bookmarks: bookmarksAdapter,
              store: operationStore,
            }),
          }
        case 'GET_LATEST_BATCH':
        {
          const storedBatch = await operationStore.getLatestBatch()
          if (!storedBatch) return { ok: true, data: null }
          const shouldRecover = storedBatch.status === 'running' || storedBatch.status === 'interrupted'
          const recoveredBatch = shouldRecover
            ? await recoverInterruptedBatch(storedBatch, bookmarksAdapter)
            : storedBatch
          if (shouldRecover) await operationStore.saveBatch(recoveredBatch)
          return { ok: true, data: recoveredBatch }
        }
        case 'GET_OPERATION_HISTORY':
        {
          const history = await operationStore.getHistory()
          const latestBatch = history[0]
          if (!latestBatch) return { ok: true, data: [] }
          const shouldRecover = latestBatch.status === 'running' || latestBatch.status === 'interrupted'
          const recoveredBatch = shouldRecover
            ? await recoverInterruptedBatch(latestBatch, bookmarksAdapter)
            : latestBatch
          if (shouldRecover) await operationStore.saveBatch(recoveredBatch)
          let olderHistory = history.slice(1)
          if (
            recoveredBatch.kind === 'undo'
            && recoveredBatch.status !== 'running'
            && recoveredBatch.status !== 'interrupted'
            && recoveredBatch.sourceBatchId
          ) {
            const sourceBatch = await operationStore.getBatch(recoveredBatch.sourceBatchId)
            if (sourceBatch && !sourceBatch.undoneByBatchId) {
              sourceBatch.undoneAt = recoveredBatch.completedAt ?? Date.now()
              sourceBatch.undoneByBatchId = recoveredBatch.id
              await operationStore.saveBatch(sourceBatch)
              olderHistory = olderHistory.map((batch) => batch.id === sourceBatch.id ? sourceBatch : batch)
            }
          }
          return { ok: true, data: [recoveredBatch, ...olderHistory] }
        }
        case 'UNDO_LATEST_BATCH': {
          const latestBatch = await operationStore.getLatestBatch()
          if (!latestBatch) {
            return { ok: false, error: { code: 'NO_BATCH', message: 'There is no batch to undo.' } }
          }
          const hasReversibleOperation = latestBatch.operations.some((operation) =>
            operation.status === 'success' && operation.undoStatus !== 'success',
          )
          if (
            latestBatch.kind !== 'apply'
            || latestBatch.undoneByBatchId
            || latestBatch.status === 'running'
            || latestBatch.status === 'interrupted'
            || latestBatch.status === 'undone'
            || latestBatch.status === 'undo-partial'
            || !hasReversibleOperation
          ) {
            return {
              ok: false,
              error: { code: 'NO_UNDOABLE_BATCH', message: 'The newest batch is not eligible for undo.' },
            }
          }
          return {
            ok: true,
            data: await undoBatch(latestBatch, {
              bookmarks: bookmarksAdapter,
              store: operationStore,
            }),
          }
        }
        default:
          return { ok: false, error: { code: 'UNKNOWN_MESSAGE', message: 'Unknown message type.' } }
      }
    }

    handle()
      .then(sendResponse)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unexpected extension error.'
        sendResponse({ ok: false, error: { code: 'INTERNAL_ERROR', message } })
      })

    return true
  },
)
