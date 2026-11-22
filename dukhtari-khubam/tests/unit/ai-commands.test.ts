import { describe, expect, it } from 'vitest'

import { AI_COMMAND_GROUPS, AI_COMMANDS, commandNote, findCommands, splitCommand, withCommand } from '@/lib/aiCommands'

describe('ready commands', () => {
  it('offers more than a thousand topics, each once', () => {
    expect(AI_COMMANDS.length).toBeGreaterThanOrEqual(1000)
    const titles = AI_COMMANDS.map((c) => c.title.toLowerCase())
    expect(new Set(titles).size).toBe(titles.length)
    for (const t of titles) expect(t).not.toMatch(/\n|^\/|^\s|\s$/)
  })

  it('names the duplicates the catalogue drops', () => {
    const all = AI_COMMAND_GROUPS.flatMap((g) => g.items.split('|').map((s) => s.trim().toLowerCase()))
    const twice = all.filter((t, i) => all.indexOf(t) !== i)
    expect(twice).toEqual([])
  })

  it('finds the titles that start with the words first', () => {
    const found = findCommands('ош')
    expect(found[0].title).toBe('ош')
    expect(found.some((c) => c.title === 'оши палов')).toBe(true)
    expect(findCommands('').length).toBe(AI_COMMANDS.length)
    expect(findCommands('zzzz')).toEqual([])
  })

  it('goes with the question as its first line and is read back', () => {
    const q = withCommand('манту', '  барои 6 нафар ')
    expect(q).toBe('/манту\nбарои 6 нафар')
    expect(splitCommand(q)).toMatchObject({ command: { title: 'манту' }, rest: 'барои 6 нафар' })
    expect(splitCommand('/манту').rest).toBe('')
    expect(splitCommand('/чизи нав\nсалом').command).toBeNull()
    expect(splitCommand('салом').command).toBeNull()
  })

  it('tells the model how to answer that kind of topic', () => {
    expect(commandNote('/ош')).toMatch(/recipe/)
    expect(commandNote('/физика\nқонуни ом')).toMatch(/lesson on «физика»/)
    expect(commandNote('салом')).toBe('')
  })
})
