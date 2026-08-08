import { describe, expect, it } from 'vitest'
import { analyzeBookmarks } from './analyzeBookmarks'
import { scanBookmarkTree } from './scanner'

function fixtureTree(): chrome.bookmarks.BookmarkTreeNode[] {
  return [
    {
      id: '0',
      title: '',
      syncing: false,
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          syncing: false,
          children: [
            {
              id: '10',
              title: 'Work',
              syncing: false,
              children: [
                {
                  id: '100',
                  title: 'Docs tracked',
                  url: 'https://example.com/docs/?utm_source=test&a=1',
                  dateAdded: 20,
                  syncing: false,
                },
                {
                  id: '101',
                  title: 'Docs clean',
                  url: 'https://example.com/docs?a=1',
                  dateAdded: 10,
                  syncing: false,
                },
                {
                  id: '102',
                  title: 'Exact one',
                  url: 'https://example.com/exact',
                  syncing: false,
                },
                {
                  id: '103',
                  title: 'Exact two',
                  url: 'https://example.com/exact',
                  syncing: false,
                },
              ],
            },
            { id: '11', title: 'Empty', syncing: false, children: [] },
          ],
        },
      ],
    },
  ]
}

describe('scanBookmarkTree', () => {
  it('creates stable nodes, paths, and indexes', () => {
    const scan = scanBookmarkTree(fixtureTree())
    const bookmark = scan.nodes[scan.indexes.byId['100']]
    const root = scan.nodes[scan.indexes.byId['0']]
    const permanentFolder = scan.nodes[scan.indexes.byId['1']]

    expect(bookmark).toMatchObject({
      type: 'bookmark',
      path: ['Bookmarks Bar', 'Work'],
      domain: 'example.com',
      normalizedUrl: 'https://example.com/docs?a=1',
    })
    expect(root).toMatchObject({ type: 'folder', isProtected: true })
    expect(permanentFolder).toMatchObject({ type: 'folder', isProtected: true })
    expect(scan.indexes.byParentId['10']).toEqual(['100', '101', '102', '103'])
    expect(scan.indexes.byNormalizedUrl['https://example.com/docs?a=1']).toEqual(['100', '101'])
  })
})

describe('analyzeBookmarks', () => {
  it('returns deterministic, unselected cleanup suggestions', () => {
    const result = analyzeBookmarks(scanBookmarkTree(fixtureTree()))

    expect(result.summary).toEqual({
      bookmarks: 4,
      folders: 4,
      duplicateGroups: 2,
      duplicateBookmarks: 2,
      emptyFolders: 1,
      classificationSuggestions: 0,
    })
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions.every((suggestion) => suggestion.selected === false)).toBe(true)
    expect(result.suggestions).toContainEqual(expect.objectContaining({
      kind: 'delete-duplicate',
      targetId: '100',
      keepId: '101',
      duplicateType: 'normalized',
    }))
    expect(result.suggestions).toContainEqual(expect.objectContaining({
      kind: 'delete-empty-folder',
      targetId: '11',
    }))
    expect(result.diagnostics).toMatchObject({
      analyzerBuild: 'diagnostics-2026-08-08-v2-folder-comparison',
      rootNodes: 1,
      protectedFolders: 2,
      userFolders: 2,
      bookmarksByDepth: { 3: 4 },
      foldersByDepth: { 0: 1, 1: 1, 2: 2 },
      classification: {
        bookmarksVisited: 4,
        skippedCleanupTargets: 2,
        bookmarksAlreadyInMeaningfulFolder: 2,
        eligibleForClassification: 2,
        suggestionsCreated: 0,
      },
    })
  })
})
