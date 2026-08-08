import type { AppRequest, AppResponse } from '../types/messages'

export const runtimeAdapter = {
  async send<T>(request: AppRequest): Promise<AppResponse<T>> {
    return chrome.runtime.sendMessage<AppRequest, AppResponse<T>>(request)
  },

  managerUrl(): string {
    return chrome.runtime.getURL('manager.html')
  },

  async openTab(url: string): Promise<void> {
    await chrome.tabs.create({ url })
  },
}

