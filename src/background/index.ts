import { bookmarksAdapter } from '../bookmark/bookmarksAdapter'
import { summarizeTree } from '../bookmark/summarizeTree'
import { runtimeAdapter } from '../chrome/runtimeAdapter'
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
          return { ok: true, data: summarizeTree(await bookmarksAdapter.getTree()) }
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

