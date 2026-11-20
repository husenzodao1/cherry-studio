/**
 * The girl who speaks to the learner at the right moments (Mascot.tsx): which picture she shows and
 * what she says. Every moment has several sayings; they come in a shuffled order and the same one is
 * never shown twice in a row (nor again before the others have been shown).
 */

export type Moment =
  | 'entry' | 'comeback' | 'praise' | 'stop' | 'perfect' | 'passed' | 'failed' | 'beforeQuiz' | 'lessonDone' | 'review'
  | 'courseStart' | 'stageDone'

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
  review: ['05-think'],
  courseStart: ['06-point', '01-ok'],
  stageDone: ['08-yes', '11-clap']
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
  ],
  courseStart: [
    'Интихоби олӣ! Биёед ин этапро якҷоя оғоз кунем.',
    'Курси нав — қадами нав. Ман бо шумо ҳастам!',
    'Аз дарси аввал оғоз мекунем — оҳиста ва бо диққат.'
  ],
  stageDone: [
    'Табрик! Шумо тамоми этапро анҷом додед!',
    'Офарин! Ин этап бо муваффақият тамом шуд — шаҳодатнома аз они шумост.'
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
  ],
  courseStart: [
    'Отличный выбор! Давайте начнём этот этап вместе.',
    'Новый курс — новый шаг. Я рядом!',
    'Начнём с первого урока — спокойно и внимательно.'
  ],
  stageDone: [
    'Поздравляю! Вы прошли весь этап!',
    'Браво! Этап успешно завершён — сертификат ваш.'
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
  ],
  courseStart: [
    'Great choice! Let’s start this stage together.',
    'A new course is a new step. I’m with you!',
    'We begin with the first lesson — calmly and carefully.'
  ],
  stageDone: [
    'Congratulations! You finished the whole stage!',
    'Bravo! The stage is complete — the certificate is yours.'
  ]
}

const uz: Sayings = {
  entry: [
    'Bugun o‘qishni boshlashga tayyormisiz?',
    '{name}, yangi kun — yangi bilim. Boshlaymizmi?',
    'Salom, {name}! Bugun qisqa bir dars sizga go‘zal narsa o‘rgatadi.',
    'Bugun yangi mavzu uchun ajoyib vaqt. Qani!',
    'Qaytib keldingiz — bu allaqachon g‘alaba. Davom etamizmi?',
    'Har kuni kichik qadam — va bilim o‘zi keladi. Tayyormisiz?'
  ],
  comeback: [
    'Salom, {name}! Sizni sog‘indik.',
    'Qaytganingiz qanday yaxshi! To‘xtagan joydan davom etamizmi?',
    'Yana xush kelibsiz! Bugun bitta kichik dars ham yetarli.'
  ],
  praise: [
    'Juda yaxshi, harakatingiz a’lo!',
    'Barakalla! Ketma-ket uchta to‘g‘ri javob!',
    'Voy! Bugun juda diqqatlisiz.',
    'Ajoyib! Shunday davom eting.',
    'Zo‘r! Bilimingiz ko‘rinib turibdi.'
  ],
  stop: [
    'To‘xtang, ketma-ket xato qilyapsiz. Biroz xotirjamroq o‘qing.',
    'Bir lahza nafas oling va savolni diqqat bilan o‘qing.',
    'Shoshilmang — to‘g‘ri javob yaqin.',
    'Keling, sekinlashamiz: har bir variantni diqqat bilan ko‘ring.',
    'Ketma-ket ikki xato. Balki darsni yana bir bor o‘qish kerakdir?'
  ],
  perfect: [
    'Birorta ham xato yo‘q! Siz ajoyibsiz!',
    'Yuzdan yuz! Bu haqiqiy mehnat natijasi.',
    'Hammasi to‘g‘ri! Siz bilan faxrlanaman.'
  ],
  passed: [
    'Test topshirildi! Barakalla.',
    'Yaxshi natija! Yana ozgina — va mukammal bo‘ladi.',
    'O‘tdingiz! Bilim qadam-baqadam o‘sadi.'
  ],
  failed: [
    'Hechqisi yo‘q — xato ham o‘rgatadi. Yana urinib ko‘ring.',
    'Bu safar bo‘lmadi, lekin siz allaqachon yangi narsa o‘rgandingiz.',
    'Darsni yana bir ko‘rib chiqing va qayting — siz uddalaysiz.'
  ],
  beforeQuiz: [
    'Siz uddalaysiz! Diqqat bilan o‘qing va o‘zingizga ishoning.',
    'Xotirjam bo‘ling — siz bu darsni o‘qigansiz.',
    'Har bir savol — yangi imkoniyat. Omad!'
  ],
  lessonDone: [
    'Dars tugadi! Maqsadga bir qadam yaqinroq.',
    'Barakalla! Bugun yangi narsa o‘rgandingiz.',
    'Yana bir dars! Bilimingiz kundan-kunga oshmoqda.',
    'A’lo! Endi test yoki keyingi dars?'
  ],
  review: [
    'Keling, takrorlaymiz — takror bilimning onasi.',
    'Bu mavzular esingizdami? Tekshiramiz!'
  ],
  courseStart: [
    'Ajoyib tanlov! Keling, bu bosqichni birga boshlaymiz.',
    'Yangi kurs — yangi qadam. Men siz bilanman!',
    'Birinchi darsdan boshlaymiz — xotirjam va diqqat bilan.'
  ],
  stageDone: [
    'Tabriklayman! Siz butun bosqichni tugatdingiz!',
    'Barakalla! Bosqich muvaffaqiyatli tugadi — sertifikat sizniki.'
  ]
}

const tr: Sayings = {
  entry: [
    'Bugün okumaya başlamaya hazır mısın?',
    '{name}, yeni bir gün — yeni bilgiler. Başlayalım mı?',
    'Merhaba, {name}! Bugün kısa bir ders sana güzel bir şey öğretecek.',
    'Bugün yeni bir konu için güzel bir zaman. Haydi!',
    'Geri döndün — bu zaten bir zafer. Devam edelim mi?',
    'Her gün küçük bir adım ve bilgi kendiliğinden gelir. Hazır mısın?'
  ],
  comeback: [
    'Merhaba, {name}! Seni özledik.',
    'Döndüğün ne güzel! Kaldığın yerden devam edelim mi?',
    'Tekrar hoş geldin! Bugün küçük bir ders bile yeter.'
  ],
  praise: [
    'Çok iyi, harika gidiyorsun!',
    'Bravo! Üst üste üç doğru cevap!',
    'Vay! Bugün çok dikkatlisin.',
    'Harika! Böyle devam et.',
    'Mükemmel! Bilgin göz önünde.'
  ],
  stop: [
    'Dur, art arda hata yapıyorsun. Biraz daha sakin oku.',
    'Bekle, bir nefes al ve soruyu dikkatle oku.',
    'Acele etme — doğru cevap çok yakın.',
    'Biraz yavaşlayalım: her seçeneğe dikkatle bak.',
    'Üst üste iki hata. Belki dersi bir kez daha okumak gerekir?'
  ],
  perfect: [
    'Tek bir hata bile yok! Harikasın!',
    'Yüzde yüz! Bu gerçek bir emeğin sonucu.',
    'Hepsi doğru! Seninle gurur duyuyorum.'
  ],
  passed: [
    'Test geçildi! Bravo.',
    'İyi bir sonuç! Biraz daha ve mükemmel olacak.',
    'Geçtin! Bilgi adım adım büyüyor.'
  ],
  failed: [
    'Önemli değil — hatalar da öğretir. Tekrar dene.',
    'Bu sefer olmadı ama yine de yeni bir şey öğrendin.',
    'Derse bir kez daha göz at ve geri gel — başarabilirsin.'
  ],
  beforeQuiz: [
    'Başarabilirsin! Dikkatle oku ve kendine inan.',
    'Sakin ol — bu dersi okudun.',
    'Her soru yeni bir fırsat. Bol şans!'
  ],
  lessonDone: [
    'Ders bitti! Hedefe bir adım daha yakınsın.',
    'Bravo! Bugün yeni bir şey öğrendin.',
    'Bir ders daha! Bilgin günden güne artıyor.',
    'Harika! Şimdi test mi, sıradaki ders mi?'
  ],
  review: [
    'Haydi tekrar edelim — tekrar, öğrenmenin anasıdır.',
    'Bu konuları hatırlıyor musun? Bir bakalım!'
  ],
  courseStart: [
    'Harika bir seçim! Bu aşamaya birlikte başlayalım.',
    'Yeni bir kurs, yeni bir adım. Yanındayım!',
    'İlk dersle başlıyoruz — sakin ve dikkatle.'
  ],
  stageDone: [
    'Tebrikler! Bütün aşamayı bitirdin!',
    'Bravo! Aşama başarıyla tamamlandı — sertifika senin.'
  ]
}

const fa: Sayings = {
  entry: [
    'امروز آماده‌اید خواندن را شروع کنیم؟',
    '{name}، روزی تازه — دانشی تازه. شروع کنیم؟',
    'سلام، {name}! امروز یک درس کوتاه چیزی زیبا به شما می‌آموزد.',
    'امروز وقت خوبی برای یک موضوع تازه است. بیایید!',
    'برگشتید — همین خودش پیروزی است. ادامه بدهیم؟',
    'هر روز یک گام کوچک، و دانش خودش می‌آید. آماده‌اید؟'
  ],
  comeback: [
    'سلام، {name}! دلمان برایتان تنگ شده بود.',
    'چه خوب که برگشتید! از همان جایی که ماندید ادامه بدهیم؟',
    'دوباره خوش آمدید! امروز یک درس کوچک هم کافی است.'
  ],
  praise: [
    'خیلی خوب، تلاش شما عالی است!',
    'آفرین! سه پاسخ درست پشت سر هم!',
    'وای! امروز خیلی دقیق هستید.',
    'شگفت‌انگیز! همین‌طور ادامه دهید.',
    'عالی! دانش شما پیداست.'
  ],
  stop: [
    'ایست، پشت سر هم اشتباه می‌کنید. کمی آرام‌تر بخوانید.',
    'صبر کنید، یک نفس بکشید و پرسش را با دقت بخوانید.',
    'عجله نکنید — پاسخ درست نزدیک است.',
    'بیایید آهسته‌تر برویم: هر گزینه را با دقت ببینید.',
    'دو اشتباه پشت سر هم. شاید بهتر است درس را یک بار دیگر بخوانید؟'
  ],
  perfect: [
    'بدون حتی یک اشتباه! شما فوق‌العاده‌اید!',
    'صد در صد! این نتیجهٔ واقعی تلاش است.',
    'همه درست! به شما افتخار می‌کنم.'
  ],
  passed: [
    'آزمون را گذراندید! آفرین.',
    'نتیجهٔ خوبی است! کمی دیگر و کامل می‌شود.',
    'قبول شدید! دانش گام به گام می‌افزاید.'
  ],
  failed: [
    'اشکالی ندارد — اشتباه هم یاد می‌دهد. دوباره تلاش کنید.',
    'این بار نشد، اما شما چیزی تازه آموختید.',
    'درس را یک بار دیگر ببینید و برگردید — شما می‌توانید.'
  ],
  beforeQuiz: [
    'شما می‌توانید! با دقت بخوانید و به خودتان باور داشته باشید.',
    'آرام باشید — شما این درس را خوانده‌اید.',
    'هر پرسش فرصتی تازه است. موفق باشید!'
  ],
  lessonDone: [
    'درس تمام شد! یک گام به هدف نزدیک‌تر.',
    'آفرین! امروز چیزی تازه آموختید.',
    'یک درس دیگر! دانش شما روز به روز بیشتر می‌شود.',
    'عالی! حالا آزمون یا درس بعدی؟'
  ],
  review: [
    'بیایید مرور کنیم — تکرار مادر دانش است.',
    'این موضوع‌ها را به یاد دارید؟ بیایید ببینیم!'
  ],
  courseStart: [
    'انتخاب عالی! بیایید این مرحله را با هم آغاز کنیم.',
    'دوره‌ای تازه، گامی تازه. من کنار شما هستم!',
    'از درس نخست آغاز می‌کنیم — آرام و با دقت.'
  ],
  stageDone: [
    'شادباش! شما کل مرحله را به پایان رساندید!',
    'آفرین! مرحله با موفقیت به پایان رسید — گواهی‌نامه از آن شماست.'
  ]
}

/** Every interface language has her sayings; Dari reads the Persian ones. */
const SAYINGS: Record<string, Sayings> = { tg, ru, en, uz, tr, fa, prs: fa }

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

/** The moment to greet with on opening the app: after three days or more away "welcome back", else hello. */
export function greeting(today: string, lastDay: string | null): Moment {
  if (!lastDay) return 'entry'
  const days = (Date.parse(today) - Date.parse(lastDay)) / 86_400_000
  return days >= 3 ? 'comeback' : 'entry'
}

/** Every picture of hers, to load before she first appears. */
export const ALL_POSES = [...new Set(Object.values(POSES).flat())]

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
