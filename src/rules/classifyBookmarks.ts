import type {
  BookmarkFolder,
  BookmarkItem,
  BookmarkNode,
  CleanupSuggestion,
} from '../types/bookmarks'

const GENERIC_FOLDER_WORDS = new Set([
  'bookmark', 'bookmarks', 'favorite', 'favorites', 'folder', 'links',
  'misc', 'miscellaneous', 'other', 'uncategorized', '收藏', '书签', '未分类',
])

type FolderProfile = {
  folder: BookmarkFolder
  titleTokens: string[]
  domainCounts: Map<string, number>
}

function tokens(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2 && !GENERIC_FOLDER_WORDS.has(token)),
  )]
}

function ancestorFolderIds(node: BookmarkNode, byId: Map<string, BookmarkNode>): string[] {
  const ids: string[] = []
  let parentId = node.parentId
  const visited = new Set<string>()

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent || parent.type !== 'folder') break
    ids.push(parent.id)
    parentId = parent.parentId
  }
  return ids
}

function buildProfiles(nodes: BookmarkNode[]): {
  profiles: FolderProfile[]
  byId: Map<string, BookmarkNode>
} {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const profiles = nodes
    .filter((node): node is BookmarkFolder => node.type === 'folder' && !node.isProtected)
    .map((folder) => ({
      folder,
      titleTokens: tokens(folder.title),
      domainCounts: new Map<string, number>(),
    }))
  const profileById = new Map(profiles.map((profile) => [profile.folder.id, profile]))

  for (const bookmark of nodes.filter((node): node is BookmarkItem => node.type === 'bookmark')) {
    if (!bookmark.domain) continue
    for (const folderId of ancestorFolderIds(bookmark, byId)) {
      const profile = profileById.get(folderId)
      if (!profile) continue
      profile.domainCounts.set(bookmark.domain, (profile.domainCounts.get(bookmark.domain) ?? 0) + 1)
    }
  }

  return { profiles, byId }
}

function currentDomainStrength(
  bookmark: BookmarkItem,
  profiles: FolderProfile[],
  ancestorIds: Set<string>,
): number {
  return profiles
    .filter((profile) => ancestorIds.has(profile.folder.id))
    .reduce((strongest, profile) =>
      Math.max(strongest, profile.domainCounts.get(bookmark.domain) ?? 0), 0)
}

export function classifyBookmarks(
  nodes: BookmarkNode[],
  cleanupSuggestions: CleanupSuggestion[],
): CleanupSuggestion[] {
  const { profiles, byId } = buildProfiles(nodes)
  const cleanupTargets = new Set(cleanupSuggestions.map((suggestion) => suggestion.targetId))
  const unavailableFolders = new Set(
    cleanupSuggestions
      .filter((suggestion) => suggestion.kind === 'delete-empty-folder')
      .map((suggestion) => suggestion.targetId),
  )
  const suggestions: CleanupSuggestion[] = []

  for (const bookmark of nodes.filter((node): node is BookmarkItem => node.type === 'bookmark')) {
    if (cleanupTargets.has(bookmark.id)) continue
    const ancestorIds = new Set(ancestorFolderIds(bookmark, byId))
    const bookmarkTextTokens = new Set(tokens(`${bookmark.title} ${bookmark.domain} ${bookmark.url}`))
    const currentStrength = currentDomainStrength(bookmark, profiles, ancestorIds)
    let best: { profile: FolderProfile; score: number; reason: string } | null = null

    for (const profile of profiles) {
      if (ancestorIds.has(profile.folder.id) || unavailableFolders.has(profile.folder.id)) continue
      const domainCount = profile.domainCounts.get(bookmark.domain) ?? 0
      const folderMatches = profile.titleTokens.filter((token) => bookmarkTextTokens.has(token))
      let score = 0
      let reason = ''

      if (domainCount > currentStrength) {
        score = domainCount >= 2 ? 0.94 : 0.86
        reason = `${domainCount} bookmark${domainCount === 1 ? '' : 's'} from ${bookmark.domain} already live in this folder.`
      }

      if (folderMatches.length > 0) {
        const keywordScore = Math.min(0.9, 0.82 + (folderMatches.length - 1) * 0.04)
        if (keywordScore > score) {
          score = keywordScore
          reason = `The bookmark matches the folder keyword “${folderMatches[0]}”.`
        }
      }

      if (score >= 0.8 && (!best || score > best.score
        || (score === best.score && profile.folder.id.localeCompare(best.profile.folder.id) < 0))) {
        best = { profile, score, reason }
      }
    }

    if (!best) continue
    suggestions.push({
      id: `move:${bookmark.id}:${best.profile.folder.id}`,
      kind: 'move-bookmark',
      targetId: bookmark.id,
      targetFolderId: best.profile.folder.id,
      groupKey: `move:${best.profile.folder.id}`,
      before: bookmark,
      confidence: best.score,
      reasons: [best.reason, 'This suggestion reuses an existing folder.'],
      selected: false,
    })
  }

  return suggestions.sort((left, right) => left.id.localeCompare(right.id))
}

