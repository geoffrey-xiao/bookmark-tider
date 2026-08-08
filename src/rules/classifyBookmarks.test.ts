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
            { id: '100', title: 'GitHub project A', url: 'https://github.com/acme/a' },
            { id: '101', title: 'GitHub project B', url: 'https://github.com/acme/b' },
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
            { id: '120', title: 'Another repository', url: 'https://github.com/acme/c' },
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
      confidence: 0.94,
      selected: false,
    }))
    expect(moves).toContainEqual(expect.objectContaining({
      targetId: '121',
      targetFolderId: '11',
      confidence: 0.82,
      selected: false,
    }))
  })

  it('does not pull bookmarks out of a stronger domain cluster', () => {
    const result = analyzeBookmarks(scanBookmarkTree(classificationTree()))
    const movedIds = result.suggestions
      .filter((suggestion) => suggestion.kind === 'move-bookmark')
      .map((suggestion) => suggestion.targetId)

    expect(movedIds).not.toContain('100')
    expect(movedIds).not.toContain('101')
  })
})

