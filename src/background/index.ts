import { bookmarksAdapter } from '../bookmark/bookmarksAdapter'
import { executeSuggestions, recoverInterruptedBatch, undoBatch } from '../bookmark/operationEngine'
import { scanBookmarks } from '../bookmark/scanBookmarks'
import { runtimeAdapter } from '../chrome/runtimeAdapter'
import { operationStore } from '../storage/operationStore'
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
          if (shouldRecover) await operationStore.saveLatestBatch(recoveredBatch)
          return { ok: true, data: recoveredBatch }
        }
        case 'UNDO_LATEST_BATCH': {
          const latestBatch = await operationStore.getLatestBatch()
          if (!latestBatch) {
            return { ok: false, error: { code: 'NO_BATCH', message: 'There is no batch to undo.' } }
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
