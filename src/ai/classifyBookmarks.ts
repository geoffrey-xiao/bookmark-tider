import type {
  AiClassificationResult,
  AiPrivacyMode,
  BookmarkFolder,
  BookmarkItem,
  BookmarkScanResult,
  CleanupSuggestion,
} from '../types/bookmarks'
import { classifyWithOpenAI, type AiFolderChoice } from './openaiProvider'
import { minimizeBookmark, type PrivateFolderInput } from './privacy'

const MAX_BOOKMARKS = 200
const MAX_FOLDERS = 100
const BATCH_SIZE = 30
const MIN_CONFIDENCE = 0.8

type Provider = typeof classifyWithOpenAI

function folderLabel(folder: BookmarkFolder): string {
  return [...folder.path, folder.title].filter(Boolean).join(' / ') || '(untitled folder)'
}

export async function addAiClassifications(options: {
  scan: BookmarkScanResult
  apiKey: string
  model: string
  privacyMode: AiPrivacyMode
  provider?: Provider
}): Promise<AiClassificationResult> {
  const provider = options.provider ?? classifyWithOpenAI
  const byId = new Map(options.scan.nodes.map((node) => [node.id, node]))
  const blockedTargets = new Set(options.scan.suggestions.map((suggestion) => suggestion.targetId))
  const blockedFolders = new Set(options.scan.suggestions
    .filter((suggestion) => suggestion.kind === 'delete-empty-folder')
    .map((suggestion) => suggestion.targetId))
  const candidates = options.scan.nodes.filter((node): node is BookmarkItem =>
    node.type === 'bookmark' && !blockedTargets.has(node.id) && Boolean(node.domain),
  )
  const bookmarks = candidates.slice(0, MAX_BOOKMARKS)
  const folders = options.scan.nodes
    .filter((node): node is BookmarkFolder =>
      node.type === 'folder' && !node.isProtected && !blockedFolders.has(node.id),
    )
    .slice(0, MAX_FOLDERS)

  const bookmarkByRef = new Map(bookmarks.map((bookmark, index) => [`b${index + 1}`, bookmark]))
  const refByBookmarkId = new Map([...bookmarkByRef].map(([ref, bookmark]) => [bookmark.id, ref]))
  const folderByRef = new Map(folders.map((folder, index) => [`f${index + 1}`, folder]))
  const folderInputs: PrivateFolderInput[] = [...folderByRef].map(([ref, folder]) => ({
    ref,
    title: folderLabel(folder),
  }))
  const choices: AiFolderChoice[] = []

  for (let start = 0; start < bookmarks.length; start += BATCH_SIZE) {
    const batch = bookmarks.slice(start, start + BATCH_SIZE)
    const inputs = batch.map((bookmark) => {
      const ref = refByBookmarkId.get(bookmark.id)
      if (!ref) throw new Error('Could not prepare an AI bookmark reference.')
      return minimizeBookmark(bookmark, ref, options.privacyMode, byId)
    })
    choices.push(...await provider({
      apiKey: options.apiKey,
      model: options.model,
      bookmarks: inputs,
      folders: folderInputs,
    }))
  }

  const usedBookmarks = new Set<string>()
  const aiSuggestions: CleanupSuggestion[] = []
  for (const choice of choices) {
    const bookmark = bookmarkByRef.get(choice.bookmarkRef)
    const folder = folderByRef.get(choice.folderRef)
    if (
      !bookmark
      || !folder
      || usedBookmarks.has(bookmark.id)
      || bookmark.parentId === folder.id
      || choice.confidence < MIN_CONFIDENCE
    ) continue
    usedBookmarks.add(bookmark.id)
    aiSuggestions.push({
      id: `ai-move:${bookmark.id}:${folder.id}`,
      kind: 'move-bookmark',
      targetId: bookmark.id,
      groupKey: `ai-classification:${bookmark.id}`,
      before: bookmark,
      confidence: choice.confidence,
      reasons: [choice.reason, `AI suggested the existing folder “${folderLabel(folder)}”.`],
      selected: false,
      targetFolderId: folder.id,
      source: 'ai',
      model: options.model,
    })
  }

  return {
    ...options.scan,
    suggestions: [...options.scan.suggestions, ...aiSuggestions],
    summary: {
      ...options.scan.summary,
      classificationSuggestions: options.scan.summary.classificationSuggestions + aiSuggestions.length,
    },
    ai: {
      provider: 'openai',
      model: options.model,
      privacyMode: options.privacyMode,
      bookmarksConsidered: candidates.length,
      bookmarksSent: bookmarks.length,
      suggestionsCreated: aiSuggestions.length,
      truncated: candidates.length > bookmarks.length || options.scan.nodes.filter((node) =>
        node.type === 'folder' && !node.isProtected,
      ).length > folders.length,
    },
  }
}
