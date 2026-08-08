import { describe, expect, it } from 'vitest'
import { getDomain, normalizeUrl } from './normalizeUrl'

describe('normalizeUrl', () => {
  it('normalizes safe URL components and keeps identity-bearing fragments', () => {
    expect(normalizeUrl(' HTTPS://Example.COM:443/docs/?b=2&utm_source=test&a=1#part '))
      .toBe('https://example.com/docs?a=1&b=2#part')
  })

  it('keeps root paths and removes known click identifiers', () => {
    expect(normalizeUrl('https://example.com/?fbclid=abc')).toBe('https://example.com/')
  })

  it('does not reinterpret unsupported or invalid URLs', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)')
    expect(normalizeUrl('not a url')).toBe('not a url')
  })
})

describe('getDomain', () => {
  it('returns a lower-case hostname or an empty string', () => {
    expect(getDomain('https://WWW.Example.COM/path')).toBe('www.example.com')
    expect(getDomain('not a url')).toBe('')
  })
})

