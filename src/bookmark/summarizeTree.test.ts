import { describe, expect, it } from 'vitest'
import { summarizeTree } from './summarizeTree'

describe('summarizeTree', () => {
  it('counts bookmarks and folders recursively', () => {
    const tree: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '0',
        title: '',
        syncing: false,
        children: [
          { id: '1', title: 'Folder', children: [], syncing: false },
          { id: '2', title: 'Example', url: 'https://example.com', syncing: false },
        ],
      },
    ]

    expect(summarizeTree(tree)).toEqual({ bookmarks: 1, folders: 2 })
  })
})
