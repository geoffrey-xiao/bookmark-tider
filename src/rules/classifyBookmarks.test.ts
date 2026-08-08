import { describe, expect, it } from 'vitest'
import { analyzeBookmarks } from '../bookmark/analyzeBookmarks'
import { scanBookmarkTree } from '../bookmark/scanner'
import type { BookmarkTreeSource } from '../types/bookmarks'

function classificationTree(): BookmarkTreeSource[] {
  return [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        {
          id: '10',
          title: 'Development',
          children: [
            { id: '100', title: 'Project docs A', url: 'https://docs.acme.test/a' },
            { id: '101', title: 'Project docs B', url: 'https://docs.acme.test/b' },
          ],
        },
        {
          id: '11',
          title: 'News',
          children: [{ id: '110', title: 'Daily briefing', url: 'https://brief.example/daily' }],
        },
        {
          id: '12',
          title: 'Unsorted',
          children: [
            { id: '120', title: 'Another project', url: 'https://docs.acme.test/c' },
            { id: '121', title: 'Latest News digest', url: 'https://digest.example/today' },
          ],
        },
      ],
    }],
  }]
}

describe('classifyBookmarks', () => {
  it('prefers a stronger existing domain cluster and folder-title keywords', () => {
    const result = analyzeBookmarks(scanBookmarkTree(classificationTree()))
    const moves = result.suggestions.filter((suggestion) => suggestion.kind === 'move-bookmark')

    expect(moves).toContainEqual(expect.objectContaining({
      targetId: '120',
      targetFolderId: '10',
      confidence: 0.9,
      selected: false,
    }))
    expect(moves).toContainEqual(expect.objectContaining({
      targetId: '121',
      targetFolderId: '11',
      confidence: 0.82,
      selected: false,
    }))
    expect(result.diagnostics.classification).toMatchObject({
      candidateFolders: 2,
      bookmarksVisited: 5,
      bookmarksAlreadyInMeaningfulFolder: 3,
      eligibleForClassification: 5,
      bookmarksWithDomainCandidates: 1,
      bookmarksWithKeywordCandidates: 1,
      suggestionsCreated: 2,
    })
  })

  it('does not pull bookmarks out of a stronger domain cluster', () => {
    const result = analyzeBookmarks(scanBookmarkTree(classificationTree()))
    const movedIds = result.suggestions
      .filter((suggestion) => suggestion.kind === 'move-bookmark')
      .map((suggestion) => suggestion.targetId)

    expect(movedIds).not.toContain('100')
    expect(movedIds).not.toContain('101')
  })

  it('suggests a stronger destination for a bookmark in the wrong named folder', () => {
    const tree = classificationTree()
    tree[0].children?.[0].children?.find((folder) => folder.id === '11')?.children?.push({
      id: '111',
      title: 'Development weekly update',
      url: 'https://weekly.example/development',
    })

    const result = analyzeBookmarks(scanBookmarkTree(tree))
    expect(result.suggestions).toContainEqual(expect.objectContaining({
      kind: 'move-bookmark',
      targetId: '111',
      targetFolderId: '10',
    }))
  })

  it('keeps a bookmark when its current named folder is an equally strong match', () => {
    const result = analyzeBookmarks(scanBookmarkTree(classificationTree()))

    expect(result.suggestions).not.toContainEqual(expect.objectContaining({
      kind: 'move-bookmark',
      targetId: '110',
    }))
  })

  it('does not use broad content-platform domains as folder intent', () => {
    const tree = classificationTree()
    const bar = tree[0].children?.[0]
    bar?.children?.push({
      id: '13',
      title: 'Projects',
      children: [
        { id: '130', title: 'Repository one', url: 'https://github.com/acme/one' },
        { id: '131', title: 'Repository two', url: 'https://github.com/acme/two' },
      ],
    })
    bar?.children?.find((folder) => folder.id === '12')?.children?.push(
      { id: '122', title: 'Unrelated repository', url: 'https://github.com/acme/three' },
    )

    const result = analyzeBookmarks(scanBookmarkTree(tree))
    expect(result.suggestions).not.toContainEqual(expect.objectContaining({
      kind: 'move-bookmark',
      targetId: '122',
    }))
  })
})
