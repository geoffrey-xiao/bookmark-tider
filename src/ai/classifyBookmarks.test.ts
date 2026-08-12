import { describe, expect, it, vi } from 'vitest'
import type { BookmarkScanResult } from '../types/bookmarks'
import { addAiClassifications } from './classifyBookmarks'

const scan: BookmarkScanResult = {
  scannedAt: 1,
  nodes: [
    { id: '0', type: 'folder', title: 'Root', parentId: null, index: 0, path: [], dateAdded: 1, childIds: ['inbox', 'research'], isProtected: true },
    { id: 'inbox', type: 'folder', title: 'Inbox', parentId: '0', index: 0, path: ['Root'], dateAdded: 1, childIds: ['bookmark'], isProtected: false },
    { id: 'research', type: 'folder', title: 'Research', parentId: '0', index: 1, path: ['Root'], dateAdded: 1, childIds: [], isProtected: false },
    { id: 'bookmark', type: 'bookmark', title: 'Paper', url: 'https://example.com/private', normalizedUrl: 'https://example.com/private', domain: 'example.com', parentId: 'inbox', index: 0, path: ['Root', 'Inbox'], dateAdded: 1 },
  ],
  indexes: { byId: { '0': 0, inbox: 1, research: 2, bookmark: 3 }, byParentId: {}, byDomain: {}, byNormalizedUrl: {} },
  suggestions: [],
  summary: { bookmarks: 1, folders: 3, duplicateGroups: 0, duplicateBookmarks: 0, emptyFolders: 0, classificationSuggestions: 0 },
  diagnostics: {
    analyzerBuild: 'test', rootNodes: 1, protectedFolders: 1, userFolders: 2,
    bookmarksByDepth: {}, foldersByDepth: {},
    classification: { candidateFolders: 2, bookmarksVisited: 1, skippedCleanupTargets: 0, bookmarksAlreadyInMeaningfulFolder: 1, eligibleForClassification: 1, eligibleContentPlatformBookmarks: 0, bookmarksWithDomainCandidates: 0, bookmarksWithKeywordCandidates: 0, skippedNoCandidate: 1, skippedTopScoreTie: 0, skippedCurrentPlacementAsGoodOrBetter: 0, suggestionsCreated: 0 },
  },
}

describe('addAiClassifications', () => {
  it('converts a valid high-confidence choice into an unselected review suggestion', async () => {
    const provider = vi.fn(async () => [{ bookmarkRef: 'b1', folderRef: 'f2', confidence: 0.91, reason: 'Research content' }])
    const result = await addAiClassifications({ scan, apiKey: 'sk-test', model: 'gpt-5-mini', privacyMode: 'domain-only', provider })

    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({
      kind: 'move-bookmark', targetId: 'bookmark', targetFolderId: 'research', source: 'ai', selected: false,
    })
    expect(result.ai).toMatchObject({ bookmarksSent: 1, suggestionsCreated: 1 })
  })

  it('drops low-confidence, unknown, and no-op choices', async () => {
    const provider = vi.fn(async () => [
      { bookmarkRef: 'b1', folderRef: 'f1', confidence: 0.99, reason: 'No-op' },
      { bookmarkRef: 'b1', folderRef: 'f2', confidence: 0.7, reason: 'Low' },
      { bookmarkRef: 'unknown', folderRef: 'f2', confidence: 0.99, reason: 'Unknown' },
    ])
    const result = await addAiClassifications({ scan, apiKey: 'sk-test', model: 'gpt-5-mini', privacyMode: 'domain-only', provider })

    expect(result.suggestions).toEqual([])
  })
})
