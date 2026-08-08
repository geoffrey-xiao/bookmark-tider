import type {
  BookmarkFolder,
  BookmarkItem,
  BookmarkNode,
  CleanupSuggestion,
} from '../types/bookmarks'

const GENERIC_FOLDER_WORDS = new Set([
  'bookmark', 'bookmarks', 'favorite', 'favorites', 'folder', 'links',
  'inbox', 'misc', 'miscellaneous', 'other', 'uncategorized', 'unsorted', '收藏', '书签', '未分类',
])

const CONTENT_PLATFORM_DOMAINS = [
  'bilibili.com', 'blog.csdn.net', 'dev.to', 'github.com', 'gitlab.com',
  'juejin.cn', 'medium.com', 'stackoverflow.com', 'youtube.com', 'zhihu.com',
]

type FolderProfile = {
  folder: BookmarkFolder
  titleTokens: string[]
  domainCounts: Map<string, number>
  bookmarkCount: number
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
      bookmarkCount: 0,
    }))
  const profileById = new Map(profiles.map((profile) => [profile.folder.id, profile]))

  for (const bookmark of nodes.filter((node): node is BookmarkItem => node.type === 'bookmark')) {
    if (!bookmark.domain) continue
    for (const folderId of ancestorFolderIds(bookmark, byId)) {
      const profile = profileById.get(folderId)
      if (!profile) continue
      profile.bookmarkCount += 1
      profile.domainCounts.set(bookmark.domain, (profile.domainCounts.get(bookmark.domain) ?? 0) + 1)
    }
  }

  return { profiles, byId }
}

function isContentPlatform(domain: string): boolean {
  return CONTENT_PLATFORM_DOMAINS.some((platform) =>
    domain === platform || domain.endsWith(`.${platform}`),
  )
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
    const userAncestors = profiles.filter((profile) => ancestorIds.has(profile.folder.id))
    if (userAncestors.some((profile) => profile.titleTokens.length > 0)) continue
    const bookmarkTitleTokens = new Set(tokens(bookmark.title))
    const currentStrength = currentDomainStrength(bookmark, profiles, ancestorIds)
    const candidates: Array<{ profile: FolderProfile; score: number; reason: string }> = []

    for (const profile of profiles) {
      if (profile.titleTokens.length === 0
        || ancestorIds.has(profile.folder.id)
        || unavailableFolders.has(profile.folder.id)) continue
      const domainCount = profile.domainCounts.get(bookmark.domain) ?? 0
      const domainConcentration = profile.bookmarkCount > 0 ? domainCount / profile.bookmarkCount : 0
      const folderMatches = profile.titleTokens.filter((folderToken) =>
        [...bookmarkTitleTokens].some((titleToken) =>
          titleToken === folderToken || (folderToken.length >= 4 && titleToken.startsWith(folderToken)),
        ),
      )
      let score = 0
      let reason = ''

      if (!isContentPlatform(bookmark.domain)
        && domainCount >= 2
        && domainCount > currentStrength
        && domainConcentration >= 0.5) {
        score = domainCount >= 3 ? 0.94 : 0.9
        reason = `${domainCount} bookmark${domainCount === 1 ? '' : 's'} from ${bookmark.domain} already live in this folder.`
      }

      if (folderMatches.length > 0) {
        const keywordScore = Math.min(0.9, 0.82 + (folderMatches.length - 1) * 0.04)
        if (keywordScore > score) {
          score = keywordScore
          reason = `The bookmark matches the folder keyword “${folderMatches[0]}”.`
        }
      }

      if (score >= 0.8) candidates.push({ profile, score, reason })
    }

    candidates.sort((left, right) => right.score - left.score
      || left.profile.folder.id.localeCompare(right.profile.folder.id))
    const best = candidates[0]
    if (!best) continue
    if (candidates[1]?.score === best.score) continue
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
