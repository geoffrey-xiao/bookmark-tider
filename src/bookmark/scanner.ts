import type {
  BookmarkFolder,
  BookmarkIndexes,
  BookmarkItem,
  BookmarkNode,
  BookmarkPath,
  BookmarkTreeSource,
} from '../types/bookmarks'
import { getDomain, normalizeUrl } from './normalizeUrl'

export type ScannedBookmarkTree = {
  nodes: BookmarkNode[]
  indexes: BookmarkIndexes
}

function addToIndex(index: Record<string, string[]>, key: string, id: string): void {
  if (!key) return
  const ids = index[key] ?? []
  ids.push(id)
  index[key] = ids
}

export function scanBookmarkTree(tree: BookmarkTreeSource[]): ScannedBookmarkTree {
  const nodes: BookmarkNode[] = []
  const indexes: BookmarkIndexes = {
    byId: {},
    byParentId: {},
    byDomain: {},
    byNormalizedUrl: {},
  }

  const visit = (
    source: BookmarkTreeSource,
    parentId: string | null,
    index: number,
    parentPath: BookmarkPath,
    depth: number,
  ): void => {
    const title = source.title.trim()
    const base = {
      id: source.id,
      title,
      parentId,
      index: source.index ?? index,
      path: parentPath,
      dateAdded: source.dateAdded ?? null,
    }

    let node: BookmarkNode
    if (source.url !== undefined) {
      const item: BookmarkItem = {
        ...base,
        type: 'bookmark',
        url: source.url,
        normalizedUrl: normalizeUrl(source.url),
        domain: getDomain(source.url),
      }
      node = item
    } else {
      const folder: BookmarkFolder = {
        ...base,
        type: 'folder',
        childIds: source.children?.map((child) => child.id) ?? [],
        isProtected: depth <= 1,
      }
      node = folder
    }

    indexes.byId[node.id] = nodes.length
    nodes.push(node)
    if (parentId !== null) addToIndex(indexes.byParentId, parentId, node.id)

    if (node.type === 'bookmark') {
      addToIndex(indexes.byDomain, node.domain, node.id)
      addToIndex(indexes.byNormalizedUrl, node.normalizedUrl, node.id)
    }

    const childPath = source.url === undefined && title ? [...parentPath, title] : parentPath
    source.children?.forEach((child, childIndex) => {
      visit(child, source.id, childIndex, childPath, depth + 1)
    })
  }

  tree.forEach((root, index) => visit(root, null, index, [], 0))
  return { nodes, indexes }
}
