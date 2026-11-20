import { describe, expect, it } from 'vitest'

import { fromRich, mergeCode, parseCode, toCode, type StoredBlock } from '@/lib/codehub'

const ID = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b'

describe('CodeHub: a lesson as simple tags', () => {
  it('turns tags into blocks (both ways of closing a tag)', () => {
    const { blocks, errors } = parseCode(`<сарлавҳа>Одоби сухан</сарлавҳа>
<сатр>Сухани нек калиди **дилҳост**.<сатр>
<рӯйхат>
- Салом диҳед
- Бо меҳр гӯед
</рӯйхат>
<иқтибос муаллиф="Рӯдакӣ", манбаъ="https://google.com">Ҳеҷ гап не.</иқтибос>
<маслиҳат сарлавҳа="Дар хона">Ба модар кумак кунед.</маслиҳат>
<видео ном="Дарс" тавсиф="Шарҳ" манбаъ="https://youtube.com">https://youtu.be/abcdefghijk</видео>
<аудио ном="Шеър" гӯянда="Нигина">медиа:${ID}</аудио>
<расм тавсиф="Гул" манбаъ="Instagram">медиа:${ID}</расм>
<манбаъ муаллиф="Фирдавсӣ" сол="1010">Шоҳнома</манбаъ>
<ҷудокунанда/>`)
    expect(errors).toEqual([])
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'bullet_list', 'quote', 'callout', 'youtube', 'audio', 'image', 'source', 'divider'])
    expect(fromRich(blocks[1].content)).toBe('Сухани нек калиди **дилҳост**.')
    expect((blocks[2].content as { items: unknown[] }).items.map(fromRich)).toEqual(['Салом диҳед', 'Бо меҳр гӯед'])
    expect(blocks[3].content).toMatchObject({ author: 'Рӯдакӣ', source: 'https://google.com' })
    expect(blocks[4]).toMatchObject({ props: { variant: 'tip' }, content: { title: 'Дар хона' } })
    expect(blocks[5]).toMatchObject({ props: { video_id: 'abcdefghijk' }, content: { title: 'Дарс', caption: 'Шарҳ', source: 'https://youtube.com' } })
    expect(blocks[6]).toMatchObject({ props: { asset_id: ID }, content: { title: 'Шеър', speaker: 'Нигина' } })
    expect(blocks[7]).toMatchObject({ props: { asset_id: ID }, content: { caption: 'Гул', source: 'Instagram' } })
    expect(blocks[8]).toMatchObject({ content: { title: 'Шоҳнома', author: 'Фирдавсӣ', year: '1010' } })
  })

  it('text outside tags becomes paragraphs; the age tag stays in its text', () => {
    const { blocks, errors } = parseCode('Сатри якум.\n\nСатри дуюм\nдавом.\n<сатр><синну сол>16</синну сол> Барои калонон.</сатр>')
    expect(errors).toEqual([])
    expect(blocks.map((b) => fromRich(b.content))).toEqual(['Сатри якум.', 'Сатри дуюм давом.', '<синну сол>16</синну сол> Барои калонон.'])
  })

  it('says what is wrong and on which line', () => {
    const msg = (code: string) => parseCode(code).errors.map((e) => `${e.line}: ${e.message}`)
    expect(msg('<сатр>Матн')[0]).toMatch(/^1: теги <сатр> пӯшида нашудааст/)
    expect(msg('<сатр>а</сатр>\n<саттр>б</саттр>')[0]).toMatch(/^2: теги <саттр> маълум нест/)
    expect(msg('<сатр>а\n<сарлавҳа>б</сарлавҳа></сатр>')[0]).toMatch(/^2: теги <сарлавҳа> дар дохили <сатр>/)
    expect(msg('<видео>https://vimeo.com/123</видео>')[0]).toMatch(/^1: пайванд хатост: дар <видео> танҳо пайванди YouTube/)
    expect(msg('<видео>youtube видео</видео>')[0]).toMatch(/пайванд хатост/)
    expect(msg('<манбаъ пайванд="google.com">Г</манбаъ>')[0]).toMatch(/пайванд хатост: «google.com»/)
    expect(msg('<расм тавсиф="x"></расм>')[0]).toMatch(/холӣ аст: файлро гиред/)
    expect(msg('<расм>https://site.tj/a.jpg</расм>')[0]).toMatch(/пайванди расм қабул намешавад/)
    expect(msg('<аудио ранг="сурх">медиа:' + ID + '</аудио>')[0]).toMatch(/атрибути «ранг» барои <аудио> нест/)
    expect(msg('<аудио ном=Шеър>медиа:' + ID + '</аудио>')[0]).toMatch(/дар нохунак нест/)
    expect(msg('</сатр>')[0]).toMatch(/кушода нашуда буд/)
  })

  it('writes a lesson back as code and keeps ids and other languages when saved again', () => {
    const stored: StoredBlock[] = [
      { id: 'h', type: 'heading', props: { level: 2 }, content: { tg: { spans: [{ text: 'Сарлавҳа' }] }, ru: { spans: [{ text: 'Заголовок' }] } } },
      { id: 'g', type: 'gallery', props: { asset_ids: [ID] }, content: {} },
      { id: 'p', type: 'paragraph', props: {}, content: { tg: { spans: [{ text: 'Матн' }] } } }
    ]
    const code = toCode(stored, 'tg')
    expect(code).toBe('<сарлавҳа>Сарлавҳа</сарлавҳа>\n\n<нигоҳ id="g"/>\n\n<сатр>Матн</сатр>')
    const edited = code.replace('Сарлавҳа</', 'Сарлавҳаи нав</')
    const merged = mergeCode(stored, parseCode(edited).blocks, 'tg')
    expect(merged.map((b) => b.id)).toEqual(['h', 'g', 'p'])
    expect(fromRich(merged[0].content.tg)).toBe('Сарлавҳаи нав')
    expect(fromRich(merged[0].content.ru)).toBe('Заголовок')
    expect(merged[1]).toBe(stored[1])
    // the code read back gives the same code
    expect(toCode(merged, 'tg')).toBe(edited)
  })
})
