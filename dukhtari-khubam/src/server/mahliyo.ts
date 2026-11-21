import Anthropic from '@anthropic-ai/sdk'

/**
 * Mahliyo AI: the app's teacher answers learners' questions in Tajik, about the app and about what its
 * seven schools teach. She is Claude (Anthropic API) with the app's guide and its published lessons in
 * front of her; written to in any other language, she says — in that language — that she does not know
 * it well and that the consultant can help. The key lives only on the server (ANTHROPIC_API_KEY).
 */

export const MODEL = 'claude-opus-5-5'

/** What the app is and how it works, as Mahliyo should know it (Tajik). */
export const GUIDE = `
# Дастури барнома

## Дар бораи барнома
Барнома барои духтарон ва занони ҷавон аст: дарсҳои кӯтоҳ дар ҳафт мактаб («7 оинаи духтар»), тестҳо, такрор ва шаҳодатнома. Барнома дар телефони Android (замимаи APK) ва дар сомона кор мекунад; пас аз боргирӣ бе интернет ҳам кор мекунад. Забони асосии мундариҷа тоҷикӣ аст; интерфейс ба 7 забон дастрас аст (тоҷикӣ, русӣ, англисӣ, ӯзбекӣ, туркӣ, форсӣ, дарӣ).

## Воридшавӣ ва бақайдгирӣ
- Бо Google ё бо почтаи электронӣ: ба почта коди 6-рақама меояд.
- Духтари нав ном ва санаи таваллудашро менависад. Баъд Маҳлиё бо ӯ шинос мешавад ва се саволи кӯтоҳ медиҳад: дар як рӯз чӣ қадар вақт меомӯзад, кадом мактабҳо ба ӯ писанданд, моро аз куҷо ёфт. Саволномаро гузаштан мумкин аст.
- Агар ҳисоб аллакай бошад, бо ҳамон почта ё Google пешрафт бармегардад.
- Логин ва парол низ сохтан мумкин аст (дар Танзимот), то бе код ворид шавед.

## Саҳифаи асосӣ
- Салом бо номи шумо ва шиор.
- «Оғози омӯзиш» ё «Давом додан»: дарси охирин, ки тамом нашудааст.
- «Такрори рӯз»: саволҳо аз тестҳои гузашта, ки бо усули такрори фосиладор (spaced repetition) бармегарданд — дуруст ҷавоб диҳед — савол дертар бармегардад, хато кунед — зудтар.
- «Суханҳои рӯз»: як сухан ё шеъри зебо, ҳар рӯз нав; агар дароз бошад, бо ангушт поён кашед.
- «7 оинаи духтар»: мактабҳо, ба паҳлӯ ҳаракат мекунанд; «Ҳамааш» рӯйхати пурраро мекушояд.
- Дар боло: аватар (профил), шумораи рӯзҳои пайдарпай (оташак), боргирӣ барои кор бе интернет, ҷустуҷӯ, танзимот.
- Агар болои саҳифаро поён кашед, имзои «Gratorslab» навишта мешавад ва дилакҳо мепаранд.

## Мактабҳо, курсҳо ва дарсҳо
- Ҳафт мактаб: Маърифати динӣ, Одоб ва ахлоқ, Рушди шахсият, Фарҳанги тоҷик, Оила ва муносибатҳо, Илм ва саломатӣ, Зиндагии муосир.
- Ҳар мактаб курсҳо (марҳилаҳо) дорад; ҳар курс аз дарсҳо иборат аст. Дарс матн, расм, видео, аудио, иқтибос ва манбаъҳо дорад (манбаъ ҳамчун нишонаи сомона нишон дода мешавад; пахш кунед — манбаъ кушода мешавад).
- Расмро пахш кунед — пурра кушода мешавад. Дарсро захира кардан мумкин аст (нишонаи захира).

## Тестҳо
- Ҳар дарс тести худро дорад: баъди «Анҷом» тест меояд.
- Дар вақти тест: ду ҷавоби хато пайдарпай — Маҳлиё маслиҳат медиҳад, ки каме истед; се ҷавоби дуруст пайдарпай — таъриф мекунад.
- Пас аз ҳамаи дарсҳо «Тести ниҳоии марҳила» меояд: аз тести ҳар дарс ду саволи тасодуфӣ. Барои гузаштан 70% лозим аст.
- Пас аз гузаштани марҳила: экрани табрик, шаҳодатнома (сабт дар галерея ва «Мубодила ба дӯстон»), баҳодиҳӣ ва «Такрори марҳила».

## Харитаи пешравӣ
Дар Профил → «Харитаи пешравӣ»: ҳар курси оғозшуда роҳи каҷу килеб аст, дарсҳо нуқтаҳо дар роҳ. Ранги нуқта натиҷаи тести дарс: сабз — олӣ (80% ва зиёд), зард — миёна (50–79%), сурх — бад (камтар аз 50%). Дарси навбатӣ бо тугмаи «бозӣ» медурахшад. Нуқтаро пахш кунед — дарс кушода мешавад.

## Профил
Акс (аз камера ё галерея, бо буридан), тоҷи тиллоӣ дар аватар, рӯзҳои пайдарпай, харитаи пешравӣ, дарсҳои захирашуда, дастовардҳо.

## «Гулбоғи эҷод»
Шеърҳо (ҳар мисра дар сатри худ) ва ҳикояҳо.

## Ҷустуҷӯ
Дарсҳо ва курсҳоро бо калима ёфтан мумкин аст. Агар ҳеҷ чиз ёфт нашавад, «Натиҷа ёфт нашуд» навишта мешавад.

## Танзимот
- Намуди зоҳирӣ: равшан, торик ва рангҳо; андозаи матн; забон.
- Пин-код: барномаро ҳангоми кушодан қуфл мекунад. Агар фаромӯш кунед: «Фаромӯш кардед?» → се саволи ҳаётӣ (агар интихоб карда бошед). Агар ҷавобҳоро ҳам дар хотир надоред → «Ҷавобҳоро низ дар хотир надоред?» → коди 6-рақама ба почта. Агар ба почта ҳам дастрасӣ набошад → «Ба почта низ дастрасӣ нест?» → чати дастгирӣ худкор кушода мешавад ва дархости шумо фиристода мешавад. Пас аз тасдиқ пин-коди нав гузоштан ё пин-кодро хомӯш кардан мумкин аст.
- Огоҳиҳо (ёдраскунии дарс), виҷетҳо барои экрани асосии телефон.
- «Дастгирӣ»: чат бо мушовир. Маҳлиё фавран ҷавоби кӯтоҳ медиҳад; вақте мушовир пайваст шуд, номаш навишта мешавад; пас аз анҷоми чат мушовирро баҳо додан мумкин аст.
- «Махфият», «Дар бораи барнома» ва «Версия» сомонаро дар браузер мекушоянд; версияи нави барнома аз сомона боргирӣ мешавад.
- Баҳо додан ба барнома ва мубодила бо дӯстон.

## Кор бе интернет
Мундариҷа дар телефон нигоҳ дошта мешавад; бо интернет худ нав мешавад. Пешрафт бо ҳисоби шумо нусхабардорӣ мешавад.
`.trim()

/** How she speaks and what she may say (instructions for the model). */
export const RULES = `
You are Маҳлиё (Mahliyo), the warm and wise teacher inside the learning app «{APP}» for girls and young women in Tajikistan. You answer learners' questions in the app's chat.

Language:
- Always answer in Tajik (Cyrillic script), in correct literary Tajik, polite ("шумо"), simple and kind, like a caring teacher. Never answer in another language.
- Decide the language of the learner's LAST message. Tajik also counts when written without the special letters (e.g. "чи хел" for "чӣ хел") or in Latin letters. Russian, English, Uzbek, Persian, Turkish or any other language is NOT Tajik — even a single sentence.
- If the last message is not Tajik: set "tajik" to false and make "reply" ONLY one or two short sentences IN THAT LANGUAGE saying, in substance: "Sorry, my <that language> is not good. Please write your questions to the consultant." Name the language. Nothing else.

Content:
- Help with the app itself (use the app guide below — do not invent features that are not in it; if you are unsure how something works, say so and suggest the consultant in «Дастгирӣ»).
- Help with the topics of the seven schools (faith and religious knowledge, manners and ethics, personal growth, Tajik culture, family and relationships, science and health, modern life). Use the course materials below when they cover the question; otherwise answer from sound general knowledge, briefly.
- Religious rulings: give general, respectful, widely accepted knowledge and suggest asking a knowledgeable, trusted scholar for a personal ruling. Health: general guidance only, suggest a doctor; for anything urgent tell her to call an ambulance (103) or tell an adult she trusts at once. Legal or money matters: general guidance and a qualified person.
- Stay modest and age-appropriate; refuse gently anything harmful, and never ask for personal data (passwords, codes, addresses).
- Keep answers short: usually 2–6 sentences; a short list when steps are needed. No markdown headings or tables.

Answer as JSON matching the schema: "tajik" (whether the learner's last message is Tajik) and "reply" (your answer).
`.trim()

/** A strings' walk over lesson content: the words of every block (ids, links and settings left out). */
const SKIP = new Set(['id', 'url', 'href', 'src', 'asset_id', 'mime_type', 'bucket', 'path', 'type', 'variant', 'kind', 'width', 'height', 'ref', 'slug', 'locale', 'at', 'schema_version'])
function words(x: unknown, key?: string): string[] {
  if (typeof x === 'string') return key && SKIP.has(key) ? [] : [x.trim()].filter(Boolean)
  if (Array.isArray(x)) return x.flatMap((v) => words(v, key))
  if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => words(v, k))
  return []
}

/** The most course material put in front of her (characters). */
export const KNOWLEDGE_CAP = 150_000

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** The published catalogue as plain text: schools, courses and every lesson's words (Tajik bundle). */
export function knowledgeOf(bundle: Json): string {
  const out: string[] = ['# Мундариҷаи барнома (мактабҳо, курсҳо ва дарсҳо)']
  for (const s of bundle.schools ?? []) {
    out.push(`\n## Мактаб: ${s.title}${s.description ? ` — ${s.description}` : ''}`)
    for (const c of bundle.schoolDetails?.[s.slug]?.courses ?? []) {
      const course = bundle.courses?.[c.id]
      out.push(`\n### Курс: ${c.title}`)
      const goals = words(course?.goals ?? [])
      if (goals.length) out.push(`Мақсадҳо: ${goals.join('; ')}`)
      for (const m of course?.modules ?? []) for (const t of m.topics ?? []) for (const l of t.lessons ?? []) {
        const lesson = bundle.lessons?.[l.id]
        out.push(`\n#### Дарс: ${lesson?.title ?? l.title}`)
        if (lesson) out.push(words(lesson.blocks).join('\n'))
      }
    }
  }
  const text = out.join('\n')
  return text.length > KNOWLEDGE_CAP ? `${text.slice(0, KNOWLEDGE_CAP)}\n…` : text
}

export interface Turn { role: 'user' | 'assistant'; content: string }
export interface Answer { tajik: boolean; reply: string }

const SCHEMA = {
  type: 'object',
  properties: { tajik: { type: 'boolean' }, reply: { type: 'string' } },
  required: ['tajik', 'reply'],
  additionalProperties: false
}

/** When she cannot answer (declined, or her answer could not be read). */
export const SORRY = 'Бубахшед, ба ин савол ҷавоб дода наметавонам. Лутфан, саволи худро ба мушовир дар «Дастгирӣ» нависед.'

let client: Anthropic | null = null
export const configured = () => !!process.env.ANTHROPIC_API_KEY

/** Her answer to the conversation (its last turn is the learner's question). */
export async function answer(turns: Turn[], appName: string, knowledge: string): Promise<Answer> {
  client ??= new Anthropic()
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    // a declined question is retried on the model Anthropic recommends for it
    fallbacks: 'default',
    // a chat: short answers, little deliberation
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [
      { type: 'text', text: RULES.replace('{APP}', appName) },
      // the guide and the course material change rarely: cached between questions
      { type: 'text', text: `${GUIDE}\n\n${knowledge}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: turns.map((t) => ({ role: t.role, content: t.content }))
  })
  if (response.stop_reason === 'refusal') return { tajik: true, reply: SORRY }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  try {
    const r = JSON.parse(text) as Partial<Answer>
    if (typeof r.reply === 'string' && r.reply.trim()) return { tajik: r.tajik !== false, reply: r.reply.trim().slice(0, 4000) }
  } catch {
    /* fall through */
  }
  return { tajik: true, reply: SORRY }
}
