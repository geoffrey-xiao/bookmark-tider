import type { ScanSummary } from '../types/messages'

export function summarizeTree(tree: chrome.bookmarks.BookmarkTreeNode[]): ScanSummary {
  const summary: ScanSummary = { bookmarks: 0, folders: 0 }

  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (node.url) {
      summary.bookmarks += 1
    } else {
      summary.folders += 1
    }
    node.children?.forEach(visit)
  }

  tree.forEach(visit)
  return summary
}

