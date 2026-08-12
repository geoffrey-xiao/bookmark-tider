import type { PrivateBookmarkInput, PrivateFolderInput } from './privacy'

export type AiFolderChoice = {
  bookmarkRef: string
  folderRef: string
  confidence: number
  reason: string
}

type ResponsesApiPayload = {
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string; refusal?: string }>
  }>
  status?: string
  error?: { message?: string }
}

type FetchLike = typeof fetch

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    choices: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bookmarkRef: { type: 'string' },
          folderRef: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
        required: ['bookmarkRef', 'folderRef', 'confidence', 'reason'],
      },
    },
  },
  required: ['choices'],
} as const

function outputText(payload: ResponsesApiPayload): string {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'refusal') throw new Error(content.refusal || 'The AI provider refused the request.')
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  throw new Error(payload.error?.message || `The AI provider returned no usable output (${payload.status ?? 'unknown status'}).`)
}

function validateChoices(value: unknown): AiFolderChoice[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { choices?: unknown }).choices)) {
    throw new Error('The AI provider returned an invalid classification result.')
  }
  return (value as { choices: unknown[] }).choices.map((choice) => {
    if (!choice || typeof choice !== 'object') throw new Error('The AI provider returned an invalid choice.')
    const item = choice as Partial<AiFolderChoice>
    if (
      typeof item.bookmarkRef !== 'string'
      || typeof item.folderRef !== 'string'
      || typeof item.confidence !== 'number'
      || item.confidence < 0
      || item.confidence > 1
      || typeof item.reason !== 'string'
    ) throw new Error('The AI provider returned an invalid choice.')
    return item as AiFolderChoice
  })
}

export async function classifyWithOpenAI(options: {
  apiKey: string
  model: string
  bookmarks: PrivateBookmarkInput[]
  folders: PrivateFolderInput[]
  fetcher?: FetchLike
}): Promise<AiFolderChoice[]> {
  const fetcher = options.fetcher ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let response: Response
  try {
    response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        store: false,
        instructions: [
          'Classify bookmarks into the best existing folder.',
          'Use only the supplied bookmark and folder refs.',
          'Return a choice only when confidence is at least 0.75.',
          'Do not invent folders. Do not classify from ref values.',
        ].join(' '),
        input: JSON.stringify({ bookmarks: options.bookmarks, folders: options.folders }),
        text: {
          format: {
            type: 'json_schema',
            name: 'bookmark_classifications',
            strict: true,
            schema: OUTPUT_SCHEMA,
          },
        },
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The OpenAI request timed out after 30 seconds.', { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const payload = await response.json() as ResponsesApiPayload
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}.`)
  }
  return validateChoices(JSON.parse(outputText(payload)) as unknown)
}
