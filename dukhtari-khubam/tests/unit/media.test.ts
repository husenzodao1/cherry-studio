import { describe, expect, it } from 'vitest'

import { bundleImageUrls } from '@/web/offline/media'

describe('images kept for offline use', () => {
  it('collects public image URLs from a content bundle and skips video, audio and premium files', () => {
    const bundle = {
      schools: [{ icon: { kind: 'image', url: 'https://cdn.test/icon.webp' } }],
      lessons: {
        l1: {
          assets: {
            a: { kind: 'image', url: 'https://cdn.test/photo.webp' },
            b: { kind: 'video', url: 'https://cdn.test/clip.mp4', poster: { url: 'https://cdn.test/poster.webp' } },
            c: { kind: 'image', url: null, protected: true },
            d: { kind: 'image', url: 'https://cdn.test/photo.webp' }
          }
        }
      }
    }
    expect(bundleImageUrls(bundle).sort()).toEqual(['https://cdn.test/icon.webp', 'https://cdn.test/photo.webp', 'https://cdn.test/poster.webp'])
  })
})
