/**
 * The girl who speaks to the learner at the right moments (Mascot.tsx): which picture she shows and
 * what she says. Every moment has several sayings; they come in a shuffled order and the same one is
 * never shown twice in a row (nor again before the others have been shown).
 */

export type Moment =
  | 'entry' | 'comeback' | 'praise' | 'stop' | 'perfect' | 'passed' | 'failed' | 'beforeQuiz' | 'lessonDone' | 'review'

/** Her pictures (public/assets/mascot/<pose>.webp), one per emotion. */
export const POSES: Record<Moment, string[]> = {
  entry: ['01-ok'],
  comeback: ['07-wave'],
  praise: ['02-wow'],
  stop: ['03-stop'],
  perfect: ['11-clap'],
  passed: ['04-thumbs'],
  failed: ['10-heart'],
  beforeQuiz: ['12-cheer'],
  lessonDone: ['08-yes', '09-book', '06-point'],
  review: ['05-think']
}

type Sayings = Record<Moment, string[]>

const tg: Sayings = {
  entry: [
    'Имрӯз омодаед, то хонишро оғоз кунем?',
    '{name}, рӯзи нав — дониши нав. Оғоз мекунем?',
    'Салом, {name}! Як дарси кӯтоҳ имрӯз ба шумо чизи зебо меомӯзад.',
    'Имрӯз вақти хуб барои як мавзӯи нав аст. Биёед!',
    'Шумо баргаштед — ин аллакай ғалаба аст. Давом медиҳем?',
    'Як қадами хурд ҳар рӯз — ва дониш ба худ меояд. Омодаед?'
  ],
  comeback: [
    'Салом, {name}! Шуморо пазмон шудем.',
    'Чӣ хуб, ки баргаштед! Аз ҳамон ҷое, ки мондед, давом медиҳем?',
    'Хуш омадед боз! Имрӯз як дарси хурд ҳам бас аст.'
  ],
  praise: [
    'Хеле хуб, шумо ҳаракати олӣ доред!',
    'Офарин! Се ҷавоби дуруст паси ҳам!',
    'Ваҳ! Шумо имрӯз хеле зиракед.',
    'Аҷиб! Ҳамин тавр давом диҳед.',
    'Бисёр хуб! Дониши шумо намоён аст.'
  ],
  stop: [
    'Стоп, шумо пайдарпай хато мекунед. Каме оромтар хонед.',
    'Истед, як лаҳза нафас гиред ва саволро бодиққат хонед.',
    'Шитоб накунед — ҷавоби дуруст наздик аст.',
    'Биёед суръатро кам кунем: ҳар вариантро бодиққат бинед.',
    'Ду хато паси ҳам. Шояд дарсро як бори дигар хондан лозим аст?'
  ],
  perfect: [
    'Бе ягон хато! Шумо олӣ ҳастед!',
    'Сад дар сад! Ин натиҷаи ҳақиқии меҳнат аст.',
    'Ҳамааш дуруст! Ман аз шумо фахр мекунам.'
  ],
  passed: [
    'Тест супорида шуд! Офарин.',
    'Натиҷаи хуб! Каме дигар — ва комил мешавад.',
    'Шумо гузаштед! Дониш қадам ба қадам меафзояд.'
  ],
  failed: [
    'Ҳеҷ гап не — хато ҳам омӯзиш аст. Боз кӯшиш кунед.',
    'Ин дафъа нашуд, аммо шумо аллакай чизи нав омӯхтед.',
    'Дарсро як бори дигар бинед ва баргардед — шумо метавонед.'
  ],
  beforeQuiz: [
    'Шумо метавонед! Бодиққат хонед ва ба худ бовар кунед.',
    'Ором бошед — шумо ин дарсро хондаед.',
    'Ҳар савол — имконияти нав. Барори кор!'
  ],
  lessonDone: [
    'Дарс тамом шуд! Як қадам ба ҳадаф наздиктар.',
    'Офарин! Имрӯз шумо чизи нав омӯхтед.',
    'Боз як дарс! Донишатон рӯз то рӯз зиёд мешавад.',
    'Аъло! Акнун тест ё дарси навбатӣ?'
  ],
  review: [
    'Биёед такрор кунем — такрор модари илм аст.',
    'Ин мавзӯъҳоро дар хотир доред? Санҷем!'
  ]
}

const ru: Sayings = {
  entry: [
    'Готовы сегодня начать чтение?',
    '{name}, новый день — новые знания. Начнём?',
    'Привет, {name}! Короткий урок сегодня научит вас чему-то прекрасному.',
    'Сегодня хорошее время для новой темы. Вперёд!',
    'Вы вернулись — это уже победа. Продолжим?',
    'Маленький шаг каждый день — и знания придут сами. Готовы?'
  ],
  comeback: [
    'Привет, {name}! Мы по вам скучали.',
    'Как хорошо, что вы вернулись! Продолжим с того места, где остановились?',
    'С возвращением! Сегодня хватит и одного маленького урока.'
  ],
  praise: [
    'Очень хорошо, у вас отличный темп!',
    'Браво! Три верных ответа подряд!',
    'Ух ты! Сегодня вы очень внимательны.',
    'Замечательно! Так держать.',
    'Прекрасно! Ваши знания видны.'
  ],
  stop: [
    'Стоп, вы ошибаетесь подряд. Читайте чуть спокойнее.',
    'Подождите, сделайте вдох и внимательно прочитайте вопрос.',
    'Не спешите — верный ответ уже близко.',
    'Давайте сбавим темп: внимательно посмотрите на каждый вариант.',
    'Две ошибки подряд. Может, стоит перечитать урок?'
  ],
  perfect: [
    'Ни одной ошибки! Вы великолепны!',
    'Сто из ста! Это настоящий результат труда.',
    'Всё верно! Я горжусь вами.'
  ],
  passed: [
    'Тест сдан! Браво.',
    'Хороший результат! Ещё немного — и будет идеально.',
    'Вы прошли! Знания растут шаг за шагом.'
  ],
  failed: [
    'Ничего страшного — ошибки тоже учат. Попробуйте ещё раз.',
    'В этот раз не вышло, но вы уже узнали новое.',
    'Посмотрите урок ещё раз и возвращайтесь — у вас получится.'
  ],
  beforeQuiz: [
    'У вас получится! Читайте внимательно и верьте в себя.',
    'Спокойно — вы прочитали этот урок.',
    'Каждый вопрос — новая возможность. Удачи!'
  ],
  lessonDone: [
    'Урок пройден! На шаг ближе к цели.',
    'Браво! Сегодня вы узнали новое.',
    'Ещё один урок! Ваши знания растут день ото дня.',
    'Отлично! Теперь тест или следующий урок?'
  ],
  review: [
    'Давайте повторим — повторение мать учения.',
    'Помните эти темы? Проверим!'
  ]
}

const en: Sayings = {
  entry: [
    'Ready to start reading today?',
    '{name}, a new day brings new knowledge. Shall we begin?',
    'Hello, {name}! A short lesson today will teach you something beautiful.',
    'Today is a good time for a new topic. Let’s go!',
    'You came back — that is already a win. Shall we continue?',
    'A small step every day, and knowledge comes by itself. Ready?'
  ],
  comeback: [
    'Hello, {name}! We missed you.',
    'So good to have you back! Shall we pick up where you left off?',
    'Welcome back! One small lesson is enough today.'
  ],
  praise: [
    'Very good, you are doing great!',
    'Bravo! Three right answers in a row!',
    'Wow! You are so attentive today.',
    'Wonderful! Keep it up.',
    'Excellent! Your knowledge shows.'
  ],
  stop: [
    'Stop, you are making mistakes in a row. Read a little more calmly.',
    'Wait, take a breath and read the question carefully.',
    'Don’t rush — the right answer is close.',
    'Let’s slow down: look at every option carefully.',
    'Two mistakes in a row. Maybe read the lesson once more?'
  ],
  perfect: [
    'Not a single mistake! You are wonderful!',
    'A hundred percent! That is real effort paying off.',
    'All correct! I am proud of you.'
  ],
  passed: [
    'Test passed! Bravo.',
    'A good result! A little more and it will be perfect.',
    'You passed! Knowledge grows step by step.'
  ],
  failed: [
    'It’s all right — mistakes teach too. Try again.',
    'Not this time, but you have already learned something new.',
    'Look through the lesson once more and come back — you can do it.'
  ],
  beforeQuiz: [
    'You can do it! Read carefully and believe in yourself.',
    'Stay calm — you have read this lesson.',
    'Every question is a new chance. Good luck!'
  ],
  lessonDone: [
    'Lesson done! One step closer to your goal.',
    'Bravo! You learned something new today.',
    'One more lesson! Your knowledge grows day by day.',
    'Excellent! A test or the next lesson now?'
  ],
  review: [
    'Let’s review — repetition is the mother of learning.',
    'Do you remember these topics? Let’s check!'
  ]
}

/** Lessons and texts exist in Tajik, Russian and English; the other interface languages read Tajik. */
const SAYINGS: Record<string, Sayings> = { tg, ru, en }

export const sayingsFor = (locale: string): Sayings => SAYINGS[locale] ?? tg

/** What is remembered between showings: the order still to come for each moment, and the last one shown. */
export interface Memory { bags: Partial<Record<Moment, number[]>>; last: Partial<Record<Moment, number>> }

/**
 * The next saying of a moment: the first of its shuffled order; when the order is used up a new one is
 * shuffled, never starting with the one just shown. Returns the index and the updated memory.
 */
export function nextSaying(moment: Moment, count: number, memory: Memory, random: () => number = Math.random): { index: number; memory: Memory } {
  let bag = (memory.bags[moment] ?? []).filter((n) => n < count)
  const last = memory.last[moment]
  if (!bag.length) {
    bag = Array.from({ length: count }, (_, n) => n)
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    if (count > 1 && bag[0] === last) bag.push(bag.shift()!)
  }
  const [index, ...rest] = bag
  return { index, memory: { bags: { ...memory.bags, [moment]: rest }, last: { ...memory.last, [moment]: index } } }
}

/** A saying with the learner's name put in (or, with no name, the words around it tidied). */
export function withName(text: string, name: string | null | undefined): string {
  const n = name?.trim()
  if (n) return text.replaceAll('{name}', n)
  return text.replace(/^\{name\},\s*/, '').replace(/,\s*\{name\}/g, '').replaceAll('{name}', '').replace(/^\p{Ll}/u, (c) => c.toUpperCase())
}

/** The moment to greet with on opening the app: once a day; after three days or more away, "welcome back". */
export function greeting(today: string, lastDay: string | null): Moment | null {
  if (lastDay === today) return null
  if (!lastDay) return 'entry'
  const days = (Date.parse(today) - Date.parse(lastDay)) / 86_400_000
  return days >= 3 ? 'comeback' : 'entry'
}

/** The moment after a finished test. */
export function afterQuiz(percent: number, passed: boolean): Moment {
  if (percent >= 100) return 'perfect'
  return passed ? 'passed' : 'failed'
}

/**
 * During a test (answers so far, true = right): the second wrong answer in a row asks her to stop; the
 * third right one in a row earns praise. Each only once per run, not again on the fourth and fifth.
 */
export function duringQuiz(results: boolean[]): Moment | null {
  let run = 0
  const lastOk = results[results.length - 1]
  for (let i = results.length - 1; i >= 0 && results[i] === lastOk; i--) run++
  if (lastOk === false && run === 2) return 'stop'
  if (lastOk === true && run === 3) return 'praise'
  return null
}
