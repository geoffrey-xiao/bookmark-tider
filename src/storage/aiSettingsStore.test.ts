import { describe, expect, it } from 'vitest'
import { createAiSettingsStore } from './aiSettingsStore'

class MemoryStorage {
  values: Record<string, unknown> = {}

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] }
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items)
  }
}

describe('aiSettingsStore', () => {
  it('defaults to disabled domain-only mode without exposing a key', async () => {
    const store = createAiSettingsStore(new MemoryStorage())

    await expect(store.get()).resolves.toEqual({
      enabled: false,
      model: 'gpt-5-mini',
      privacyMode: 'domain-only',
      hasApiKey: false,
    })
  })

  it('stores a user key but returns only whether one exists', async () => {
    const store = createAiSettingsStore(new MemoryStorage())
    await expect(store.save({
      enabled: true,
      model: 'gpt-5-mini',
      privacyMode: 'title-and-domain',
      apiKey: 'sk-user-secret',
    })).resolves.toEqual({
      enabled: true,
      model: 'gpt-5-mini',
      privacyMode: 'title-and-domain',
      hasApiKey: true,
    })

    await expect(store.getApiConfiguration()).resolves.toMatchObject({ apiKey: 'sk-user-secret' })
    await expect(store.get()).resolves.not.toHaveProperty('apiKey')
  })

  it('preserves a saved key when settings are updated with a blank key', async () => {
    const store = createAiSettingsStore(new MemoryStorage())
    await store.save({ enabled: true, model: 'first', privacyMode: 'domain-only', apiKey: 'sk-existing' })
    await store.save({ enabled: true, model: 'second', privacyMode: 'domain-only' })

    await expect(store.getApiConfiguration()).resolves.toMatchObject({ model: 'second', apiKey: 'sk-existing' })
  })
})
