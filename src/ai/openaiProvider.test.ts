import { describe, expect, it, vi } from 'vitest'
import { classifyWithOpenAI } from './openaiProvider'

describe('classifyWithOpenAI', () => {
  it('uses Responses structured output without storing the request', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input
      void init
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{
          type: 'output_text',
          text: JSON.stringify({ choices: [{ bookmarkRef: 'b1', folderRef: 'f1', confidence: 0.9, reason: 'Match' }] }),
        }] }],
      }), { status: 200 })
    })

    await expect(classifyWithOpenAI({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
      bookmarks: [{ ref: 'b1', domain: 'example.com' }],
      folders: [{ ref: 'f1', title: 'Research' }],
      fetcher,
    })).resolves.toEqual([{ bookmarkRef: 'b1', folderRef: 'f1', confidence: 0.9, reason: 'Match' }])

    const init = fetcher.mock.calls[0][1]
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body.store).toBe(false)
    expect(body.text).toMatchObject({ format: { type: 'json_schema', strict: true } })
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-test' })
  })

  it('rejects references or confidence values with invalid shapes', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input
      void init
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify({
          choices: [{ bookmarkRef: 'b1', folderRef: 'f1', confidence: 2, reason: 'Bad' }],
        }) }] }],
      }), { status: 200 })
    })

    await expect(classifyWithOpenAI({
      apiKey: 'sk-test', model: 'gpt-5-mini', bookmarks: [], folders: [], fetcher,
    })).rejects.toThrow('invalid choice')
  })
})
