const TRACKING_PARAMETERS = new Set([
  'dclid',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'msclkid',
])

function isTrackingParameter(name: string): boolean {
  const normalizedName = name.toLowerCase()
  return normalizedName.startsWith('utm_') || TRACKING_PARAMETERS.has(normalizedName)
}

export function normalizeUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim()

  try {
    const url = new URL(trimmedUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmedUrl

    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParameter(name)) url.searchParams.delete(name)
    }
    url.searchParams.sort()

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    }

    return url.toString()
  } catch {
    return trimmedUrl
  }
}

export function getDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

