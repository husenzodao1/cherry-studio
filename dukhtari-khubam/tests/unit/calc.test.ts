import { describe, expect, it } from 'vitest'

import { evaluate, formatNumber } from '@/lib/calc'
import { cleanBlocks } from '@/server/mahliyo'

describe('live calculator formulas', () => {
  it('works out arithmetic on the inputs, with functions and powers', () => {
    expect(evaluate('price*count - cost', { price: 40, count: 3, cost: 22.14 })).toBeCloseTo(97.86)
    expect(evaluate('round(a / 3, 2)', { a: 10 })).toBe(3.33)
    expect(evaluate('max(a, b) + 2^3', { a: 1, b: 5 })).toBe(13)
    expect(evaluate('-a × 2 ÷ 4', { a: 6 })).toBe(-3)
  })
  it('refuses anything that is not plain arithmetic on known values', () => {
    for (const f of ['alert(1)', 'a +', 'constructor', 'b * 2', '1/0', 'process.exit()', '']) expect(evaluate(f, { a: 1 })).toBeNull()
  })
  it('writes numbers with spaces between thousands', () => {
    expect(formatNumber(1234567)).toBe('1 234 567')
    expect(formatNumber(2.4)).toBe('2,4')
  })
})

describe('her new blocks, cleaned', () => {
  it('keeps one first pick among choices, and a calculator whose formulas work', () => {
    const blocks = cleanBlocks([
      { type: 'choices', title: 'Провайдер', intro: '', items: [
        { name: 'Smartpay', badge: 'Интихоби аввалини ман', tone: 'best', points: ['Visa'], note: '' },
        { name: 'Z Pay', badge: '', tone: 'best', points: [], note: '' }] },
      { type: 'callout', tone: 'danger', title: 'Хатар', text: 'Пули зиёд' },
      { type: 'calc', title: 'Буҷа', note: '', inputs: [{ id: 'price', label: 'Нарх', value: 40, min: 0, max: 100, step: 5, unit: 'сомонӣ', options: [25, 40] }],
        outputs: [{ label: 'Фоида', formula: 'price - 22.14', unit: 'сомонӣ', tone: 'best', big: true }, { label: 'бад', formula: 'evil()', unit: '', tone: 'risk', big: false }] },
      { type: 'clarify', question: 'Нафаҳмидам', options: ['А', 'Б', 'В'] },
      { type: 'follow', items: ['Техникаҳои ранг', 'Стилҳои манга', 'x', 'y'] },
      { type: 'quiz', title: 'Хислат', intro: '', comment: 'Дар бораи худ нақл кунед…', questions: [{ question: 'Савол', options: ['а', 'б'], answer: -1, explanation: '' }] }
    ])
    expect(blocks.map((b) => b.type)).toEqual(['choices', 'callout', 'calc', 'clarify', 'follow', 'quiz'])
    const choices = blocks[0] as Extract<typeof blocks[number], { type: 'choices' }>
    expect(choices.items.map((i) => i.tone)).toEqual(['best', 'good'])
    const calc = blocks[2] as Extract<typeof blocks[number], { type: 'calc' }>
    expect(calc.outputs).toHaveLength(1)
    expect((blocks[4] as { items: string[] }).items).toHaveLength(3)
    expect((blocks[5] as { comment?: string }).comment).toBe('Дар бораи худ нақл кунед…')
  })
})
