import type {
  BookmarkFolder,
  BookmarkItem,
  BookmarkNode,
  ClassificationDiagnostics,
  CleanupSuggestion,
} from '../types/bookmarks'

const GENERIC_FOLDER_WORDS = new Set([
  'bookmark', 'bookmarks', 'favorite', 'favorites', 'folder', 'links',
  'imported', 'inbox', 'misc', 'miscellaneous', 'other', 'uncategorized', 'unsorted',
  '导入', '导入的书签', '已导入', '收藏', '书签', '未分类',
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

type ProfileMatch = {
  profile: FolderProfile
  score: number
  reason: string
  matchedByDomain: boolean
  matchedByKeyword: boolean
}

const MIN_DESTINATION_ADVANTAGE = 0.08

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

function scoreProfile(
  bookmark: BookmarkItem,
  bookmarkTitleTokens: Set<string>,
  profile: FolderProfile,
): ProfileMatch {
  const domainCount = profile.domainCounts.get(bookmark.domain) ?? 0
  const domainConcentration = profile.bookmarkCount > 0 ? domainCount / profile.bookmarkCount : 0
  const folderMatches = profile.titleTokens.filter((folderToken) =>
    [...bookmarkTitleTokens].some((titleToken) =>
      titleToken === folderToken || (folderToken.length >= 4 && titleToken.startsWith(folderToken)),
    ),
  )
  let score = 0
  let reason = ''
  let matchedByDomain = false
  let matchedByKeyword = false

  if (!isContentPlatform(bookmark.domain)
    && domainCount >= 2
    && domainConcentration >= 0.5) {
    score = domainCount >= 3 ? 0.94 : 0.9
    reason = `${domainCount} bookmark${domainCount === 1 ? '' : 's'} from ${bookmark.domain} already live in this folder.`
    matchedByDomain = true
  }

  if (folderMatches.length > 0) {
    const keywordScore = Math.min(0.9, 0.82 + (folderMatches.length - 1) * 0.04)
    matchedByKeyword = true
    if (keywordScore > score) {
      score = keywordScore
      reason = `The bookmark matches the folder keyword “${folderMatches[0]}”.`
    }
  }

  return { profile, score, reason, matchedByDomain, matchedByKeyword }
}

export function classifyBookmarksWithDiagnostics(
  nodes: BookmarkNode[],
  cleanupSuggestions: CleanupSuggestion[],
): { suggestions: CleanupSuggestion[]; diagnostics: ClassificationDiagnostics } {
  const { profiles, byId } = buildProfiles(nodes)
  const cleanupTargets = new Set(cleanupSuggestions.map((suggestion) => suggestion.targetId))
  const unavailableFolders = new Set(
    cleanupSuggestions
      .filter((suggestion) => suggestion.kind === 'delete-empty-folder')
      .map((suggestion) => suggestion.targetId),
  )
  const suggestions: CleanupSuggestion[] = []
  const diagnostics: ClassificationDiagnostics = {
    candidateFolders: profiles.filter((profile) => profile.titleTokens.length > 0).length,
    bookmarksVisited: 0,
    skippedCleanupTargets: 0,
    bookmarksAlreadyInMeaningfulFolder: 0,
    eligibleForClassification: 0,
    eligibleContentPlatformBookmarks: 0,
    bookmarksWithDomainCandidates: 0,
    bookmarksWithKeywordCandidates: 0,
    skippedNoCandidate: 0,
    skippedTopScoreTie: 0,
    skippedCurrentPlacementAsGoodOrBetter: 0,
    suggestionsCreated: 0,
  }

  for (const bookmark of nodes.filter((node): node is BookmarkItem => node.type === 'bookmark')) {
    diagnostics.bookmarksVisited += 1
    if (cleanupTargets.has(bookmark.id)) {
      diagnostics.skippedCleanupTargets += 1
      continue
    }
    const ancestorIds = new Set(ancestorFolderIds(bookmark, byId))
    const userAncestors = profiles.filter((profile) => ancestorIds.has(profile.folder.id))
    const meaningfulAncestors = userAncestors.filter((profile) => profile.titleTokens.length > 0)
    if (meaningfulAncestors.length > 0) diagnostics.bookmarksAlreadyInMeaningfulFolder += 1
    diagnostics.eligibleForClassification += 1
    if (isContentPlatform(bookmark.domain)) diagnostics.eligibleContentPlatformBookmarks += 1
    const bookmarkTitleTokens = new Set(tokens(bookmark.title))
    const currentScore = meaningfulAncestors.reduce((strongest, profile) =>
      Math.max(strongest, scoreProfile(bookmark, bookmarkTitleTokens, profile).score), 0)
    const candidates: ProfileMatch[] = []
    let hasDomainCandidate = false
    let hasKeywordCandidate = false

    for (const profile of profiles) {
      if (profile.titleTokens.length === 0
        || ancestorIds.has(profile.folder.id)
        || unavailableFolders.has(profile.folder.id)) continue
      const match = scoreProfile(bookmark, bookmarkTitleTokens, profile)
      if (match.matchedByDomain) hasDomainCandidate = true
      if (match.matchedByKeyword) hasKeywordCandidate = true
      if (match.score >= 0.8) candidates.push(match)
    }

    if (hasDomainCandidate) diagnostics.bookmarksWithDomainCandidates += 1
    if (hasKeywordCandidate) diagnostics.bookmarksWithKeywordCandidates += 1

    candidates.sort((left, right) => right.score - left.score
      || left.profile.folder.id.localeCompare(right.profile.folder.id))
    const best = candidates[0]
    if (!best) {
      diagnostics.skippedNoCandidate += 1
      continue
    }
    if (candidates[1]?.score === best.score) {
      diagnostics.skippedTopScoreTie += 1
      continue
    }
    if (meaningfulAncestors.length > 0
      && best.score < currentScore + MIN_DESTINATION_ADVANTAGE) {
      diagnostics.skippedCurrentPlacementAsGoodOrBetter += 1
      continue
    }
    suggestions.push({
      id: `move:${bookmark.id}:${best.profile.folder.id}`,
      kind: 'move-bookmark',
      targetId: bookmark.id,
      targetFolderId: best.profile.folder.id,
      groupKey: `move:${best.profile.folder.id}`,
      before: bookmark,
      confidence: best.score,
      reasons: [
        best.reason,
        meaningfulAncestors.length > 0
          ? 'This existing folder is a meaningfully stronger match than the current location.'
          : 'This suggestion reuses an existing folder.',
      ],
      selected: false,
    })
    diagnostics.suggestionsCreated += 1
  }

  return {
    suggestions: suggestions.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
  }
}

export function classifyBookmarks(
  nodes: BookmarkNode[],
  cleanupSuggestions: CleanupSuggestion[],
): CleanupSuggestion[] {
  return classifyBookmarksWithDiagnostics(nodes, cleanupSuggestions).suggestions
}
