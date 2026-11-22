import { describe, expect, it } from 'vitest'

import { sunset } from '@/lib/sun'
import { sceneAt } from '@/web/components/NightGuard'

const at = (h: number, m: number, month = 11, day = 23) => new Date(2026, month - 1, day, h, m)

describe('time-of-day scenes', () => {
  it('night, early morning, breakfast, lunch, and none in between', () => {
    expect(sceneAt(at(23, 10))?.scene).toBe('night')
    expect(sceneAt(at(2, 0))?.period).toBe(sceneAt(at(23, 10, 11, 22))?.period)
    expect(sceneAt(at(6, 0))?.scene).toBe('morning')
    expect(sceneAt(at(7, 45))?.scene).toBe('breakfast')
    expect(sceneAt(at(12, 45))?.scene).toBe('lunch')
    expect(sceneAt(at(10, 30))).toBeNull()
  })
  it('dinner follows the sunset: earlier in winter than in summer', () => {
    const winter = sunset(at(12, 0, 12, 21), 38.56, 68.78)!
    const summer = sunset(at(12, 0, 6, 21), 38.56, 68.78)!
    const mins = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes()
    expect(mins(summer) - mins(winter)).toBeGreaterThan(150)
  })
})
