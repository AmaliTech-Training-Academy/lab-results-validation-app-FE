import { describe, it, expect } from 'vitest'
import { formatFileVersion } from '@/utils/sharepoint'

describe('formatFileVersion', () => {
  it('shows "v{revision}" when a revision is available', () => {
    expect(formatFileVersion(89, 'c:{6B0CF5FB-13F3-4368-AF03-84091F227C3E},89')).toBe('v89')
  })

  it('falls back to the raw cTag when no revision was parsed', () => {
    expect(formatFileVersion(null, 'unrecognized-shape')).toBe('unrecognized-shape')
    expect(formatFileVersion(undefined, 'unrecognized-shape')).toBe('unrecognized-shape')
  })

  it('falls back to an em dash when there is nothing at all', () => {
    expect(formatFileVersion(null, null)).toBe('—')
    expect(formatFileVersion(undefined, undefined)).toBe('—')
  })

  it('prefers the revision even when it is 0', () => {
    expect(formatFileVersion(0, 'c:{6B0CF5FB-13F3-4368-AF03-84091F227C3E},0')).toBe('v0')
  })
})
