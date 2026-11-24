import type { Page } from '@playwright/test'

import { expect, signedIn, test } from './fixtures'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const args = (r: { request: () => { postDataJSON: () => unknown } }) => r.request().postDataJSON() as Record<string, unknown>

/** The database's api_social_* functions, kept in memory for one test. */
async function socialServer(page: Page) {
  const s = {
    me: { login: 'malika', links: {} as Record<string, string>, minor: true, requests: 1 },
    received: [{ login: 'zarina', name: 'Зарина Р.', note: '9-Б', at: '2026-11-20T10:00:00Z' }],
    contacts: [] as { login: string; name: string; links: Record<string, string> }[],
    sent: [] as { login: string; name: string }[],
    calls: [] as string[]
  }
  await page.route('**/rest/v1/rpc/api_social_*', async (r) => {
    const fn = /api_social_\w+/.exec(r.request().url())![0]
    const a = args(r)
    s.calls.push(fn)
    if (fn === 'api_social_me') return r.fulfill(json(s.me))
    if (fn === 'api_social_requests') return r.fulfill(json({ received: s.received, sent: s.sent, contacts: s.contacts }))
    if (fn === 'api_social_set_login') {
      if (a.p_login === 'taken') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'login_taken' }) })
      s.me.login = String(a.p_login)
      return r.fulfill(json({ login: s.me.login }))
    }
    if (fn === 'api_social_set_links') { s.me.links = a.p_links as Record<string, string>; return r.fulfill(json(s.me.links)) }
    if (fn === 'api_social_answer') {
      const p = s.received.shift()!
      if (a.p_accept) s.contacts.push({ login: p.login, name: p.name, links: { telegram: 'zarina_r' } })
      s.me.requests = 0
      return r.fulfill(json({ status: a.p_accept ? 'accepted' : 'declined' }))
    }
    if (fn === 'api_social_search') return r.fulfill(json(String(a.p_query).startsWith('nig') ? [{ login: 'nigora', name: 'Нигора С.' }] : []))
    if (fn === 'api_social_profile') {
      const sent = s.sent.some((p) => p.login === a.p_login)
      return r.fulfill(json({ login: a.p_login, name: 'Нигора С.', since: '2026-09-01', achievements: 5, lessons: 31,
        has: ['whatsapp', 'instagram'], links: null, status: sent ? 'sent' : 'none', can_request: true }))
    }
    if (fn === 'api_social_request') { s.sent.push({ login: String(a.p_login), name: 'Нигора С.' }); return r.fulfill(json({ status: 'pending' })) }
    return r.fulfill(json(null))
  })
  return s
}

test('friends: her login from her name, links only for contacts, a request accepted, a profile found by login', async ({ page, server: _, errors }) => {
  await signedIn(page)
  const s = await socialServer(page)
  await page.goto('/profile')
  await expect(page.locator('#splash')).toBeHidden({ timeout: 10_000 })
  // the login the server made from her name, under it
  await expect(page.locator('.profile-head .login-pill')).toHaveText('@malika')
  await page.locator('.menu-row[href="/friends"]').click()
  await expect(page).toHaveURL(/\/friends/)

  // a taken login is refused, a free one saved
  const login = page.getByLabel('Логини ман')
  await login.fill('taken')
  await page.getByRole('button', { name: 'Нигоҳ доштан' }).first().click()
  await expect(page.locator('.toast')).toContainText('Ин логин банд аст')
  await login.fill('malika.r')
  await page.getByRole('button', { name: 'Нигоҳ доштан' }).first().click()
  await expect.poll(() => s.me.login).toBe('malika.r')

  // under 16: the links are for her accepted classmates and teachers only
  await expect(page.getByText('дархост танҳо аз ҳамсолон меояд')).toBeVisible()
  // the teacher feature (classes) is off unless the panel turns it on
  await expect(page.getByText('Синфи ман')).toHaveCount(0)
  await page.getByLabel('telegram').fill('@malika_r')
  await page.getByRole('button', { name: 'Нигоҳ доштан' }).nth(1).click()
  await expect.poll(() => s.me.links.telegram).toBe('@malika_r')

  // Zarina's request, accepted: she becomes a contact with her Telegram open
  await expect(page.locator('.friends-row').first()).toContainText('Зарина Р.')
  await page.getByRole('button', { name: 'Қабул' }).click()
  await expect(page.locator('.social-icon[href*="t.me/zarina_r"]')).toBeVisible()
  await page.screenshot({ path: 'test-results/friends.png' })

  // found by login only (three letters), her profile: links locked, a request sent
  await page.getByLabel('Ёфтан бо логин').fill('nig')
  await page.locator('.friends-row[href*="nigora"]').click()
  await expect(page).toHaveURL(/\/u\/?\?login=nigora/)
  await expect(page.locator('.public-head')).toContainText('Нигора С.')
  await expect(page.locator('.public-stats')).toContainText('31')
  await expect(page.locator('.public-head .social-icon')).toHaveCount(2)
  await expect(page.locator('.public-head a.social-icon')).toHaveCount(0)
  await page.getByRole('button', { name: 'Дархост фиристодан' }).click()
  await expect(page.locator('.public-head')).toContainText('Дархост фиристода шуд')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/public-profile.png' })
  expect(s.calls).toContain('api_social_request')
  expect(errors).toEqual([])
})
