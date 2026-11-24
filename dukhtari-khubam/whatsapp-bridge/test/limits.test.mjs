import assert from 'node:assert/strict'
import { test } from 'node:test'

import { authorized, cleanText, digitsOf, makeLimits, maySend, Window } from '../src/limits.mjs'

const SECRET = 'a-very-long-shared-secret-123456'

test('only the app server with the secret may call the bridge', () => {
  assert.equal(authorized(`Bearer ${SECRET}`, SECRET), true)
  assert.equal(authorized(`Bearer ${SECRET}x`, SECRET), false)
  assert.equal(authorized(SECRET, SECRET), false)
  assert.equal(authorized(undefined, SECRET), false)
  // a short secret is never accepted, even when it matches
  assert.equal(authorized('Bearer short', 'short'), false)
})

test('phone numbers become digits; anything else is refused', () => {
  assert.equal(digitsOf('+992 90 123-45-67'), '992901234567')
  assert.equal(digitsOf('(992) 901.234.567'), '992901234567')
  assert.equal(digitsOf('12345'), null)
  assert.equal(digitsOf('+0992901234567'), null)
  assert.equal(digitsOf('992-90-abc'), null)
  assert.equal(digitsOf(null), null)
})

test('a window lets max events through, then frees them as time passes', () => {
  let t = 0
  const w = new Window(2, 1000, () => t)
  assert.equal(w.take('a'), true)
  assert.equal(w.take('a'), true)
  assert.equal(w.take('a'), false)
  assert.equal(w.take('b'), true)
  t = 1001
  assert.equal(w.take('a'), true)
})

test('the number sends slowly: per person per hour, then per minute', () => {
  let t = 0
  const limits = makeLimits(() => t)
  for (let i = 0; i < 12; i++) assert.equal(maySend(limits, `99290000${String(i).padStart(4, '0')}`), null)
  // the 13th message in one minute waits, whoever it is for
  assert.equal(maySend(limits, '992911111111'), 'minute')
  t = 61_000
  for (let i = 0; i < 11; i++) assert.equal(maySend(limits, '992922222222'), null)
  t = 122_000
  assert.equal(maySend(limits, '992922222222'), null)
  assert.equal(maySend(limits, '992922222222'), 'person')
})

test('texts are trimmed and kept short', () => {
  assert.equal(cleanText('  SOS \r\n'), 'SOS')
  assert.equal(cleanText(''), null)
  assert.equal(cleanText('x'.repeat(2001)), null)
})
