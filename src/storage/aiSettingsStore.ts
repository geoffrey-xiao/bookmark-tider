import type { AiPrivacyMode, AiSettings, AiSettingsUpdate } from '../types/bookmarks'

const AI_SETTINGS_KEY = 'bookmarkTidy.aiSettings'
const DEFAULT_MODEL = 'gpt-5-mini'

type StoredAiSettings = {
  schemaVersion: 1
  enabled: boolean
  model: string
  privacyMode: AiPrivacyMode
  apiKey: string
}

export type AiSettingsStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

const defaults = (): StoredAiSettings => ({
  schemaVersion: 1,
  enabled: false,
  model: DEFAULT_MODEL,
  privacyMode: 'domain-only',
  apiKey: '',
})

function isPrivacyMode(value: unknown): value is AiPrivacyMode {
  return value === 'domain-only' || value === 'title-and-domain'
}

function normalize(value: unknown): StoredAiSettings {
  if (!value || typeof value !== 'object') return defaults()
  const candidate = value as Partial<StoredAiSettings>
  return {
    schemaVersion: 1,
    enabled: candidate.enabled === true,
    model: typeof candidate.model === 'string' && candidate.model.trim()
      ? candidate.model.trim()
      : DEFAULT_MODEL,
    privacyMode: isPrivacyMode(candidate.privacyMode) ? candidate.privacyMode : 'domain-only',
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
  }
}

function publicSettings(settings: StoredAiSettings): AiSettings {
  return {
    enabled: settings.enabled,
    model: settings.model,
    privacyMode: settings.privacyMode,
    hasApiKey: settings.apiKey.length > 0,
  }
}

export function createAiSettingsStore(storage: AiSettingsStorage) {
  const readStored = async (): Promise<StoredAiSettings> => {
    const values = await storage.get(AI_SETTINGS_KEY)
    return normalize(values[AI_SETTINGS_KEY])
  }

  return {
    async get(): Promise<AiSettings> {
      return publicSettings(await readStored())
    },

    async getApiConfiguration(): Promise<StoredAiSettings> {
      return readStored()
    },

    async save(update: AiSettingsUpdate): Promise<AiSettings> {
      const current = await readStored()
      const next: StoredAiSettings = {
        schemaVersion: 1,
        enabled: update.enabled,
        model: update.model.trim() || DEFAULT_MODEL,
        privacyMode: update.privacyMode,
        apiKey: update.clearApiKey
          ? ''
          : update.apiKey?.trim() || current.apiKey,
      }
      await storage.set({ [AI_SETTINGS_KEY]: next })
      return publicSettings(next)
    },
  }
}

const chromeStorage: AiSettingsStorage = {
  async get(key) {
    return chrome.storage.local.get(key)
  },
  async set(items) {
    await chrome.storage.local.set(items)
  },
}

export const aiSettingsStore = createAiSettingsStore(chromeStorage)
