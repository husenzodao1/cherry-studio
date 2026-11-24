import { describe, expect, it } from 'vitest'

import { currencyOf, moneyText } from '@/lib/money'

const rates = { RUB: 8.89, UZS: 1302.9, USD: 0.1084, IRR: 209133 }
describe('prices in her currency', () => {
  it('knows where she lives by the time zone', () => {
    expect(currencyOf('Asia/Dushanbe')).toBe('TJS')
    expect(currencyOf('Asia/Tashkent')).toBe('UZS')
    expect(currencyOf('Europe/Moscow')).toBe('RUB')
    expect(currencyOf('Asia/Novosibirsk')).toBe('RUB')
    expect(currencyOf('Europe/Berlin')).toBe('EUR')
    expect(currencyOf('America/New_York')).toBe('USD')
    expect(currencyOf(undefined)).toBe('TJS')
    expect(currencyOf('UTC')).toBe('TJS')
  })

  it('somoni at home, about as much in her money elsewhere', () => {
    expect(moneyText(45, { currency: 'TJS', rates, tag: 'tg', somoniWord: 'сомонӣ' })).toBe('45 сомонӣ')
    expect(moneyText(45, { currency: 'RUB', rates, tag: 'ru', somoniWord: 'сомони' }).replace(/\s/g, ' ')).toBe('≈ 400 ₽')
    expect(moneyText(45, { currency: 'USD', rates, tag: 'en', somoniWord: 'somoni' })).toBe('≈ $4.88')
    expect(moneyText(99, { currency: 'UZS', rates, tag: 'uz', somoniWord: 'somoniy' })).toMatch(/^≈ 129[\s ,.]?000/)
    // no rate known: somoni
    expect(moneyText(45, { currency: 'KGS', rates, tag: 'ru', somoniWord: 'сомони' })).toBe('45 сомони')
  })
})
