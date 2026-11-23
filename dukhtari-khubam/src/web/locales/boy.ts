import type { Locale, UiKey } from '../i18n'

/**
 * The words of boys' mode: every text written for girls (her "seven mirrors", "girlfriends", flowers and
 * hearts) said the way a boy is spoken to — plainer, more serious. Anything not here is the same for both.
 * Mahliyo's own sign-in and error messages stay as they are.
 */
type Words = Partial<Record<UiKey, string>>

const tg: Words = {
  'home.seven_schools': '7 мактаби писар',
  'welcome.schools.q': 'Кадом мактабҳоро омӯхтан мехоҳед?',
  'start.subtitle': 'Қувват дар дониш аст',
  'home.motto': 'Қувват дар дониш аст.',
  'share.title': 'Мубодила бо дӯстон',
  'share.text': '«LifeHub» — барномаи омӯзишӣ барои писарон ва духтарон. Қувват дар дониш аст:',
  'recovery.q.friend': 'Номи дӯсти наздикатон?',
  'recovery.q.flower': 'Варзиши дӯстдоштаатон?',
  'poem.title': 'Ганҷинаи эҷод',
  'ai.subtitle': 'Ёвари донои шумо',
  'intro.hello': 'Салом, дӯсти азиз!',
  'done.share': 'Мубодила бо дӯстон',
  'notify.lesson.titles': 'Вақти дарс, {name} 💪\nДониш шуморо интизор аст\n{name}, як қадами имрӯза\nИмрӯз як дарс — пагоҳ натиҷа 📈\nМақсадро фаромӯш накун, {name}',
  'notify.lesson.bodies': 'Мавзӯъҳоро идома диҳед — як дарс ҳам аз ҳеҷ беҳтар аст.\nМактаби навро кушоед ва чизи наверо омӯзед.\nДониш — қуввате, ки ҳамеша бо шумост. Як дарс хонем.\nСилсилаи рӯзҳоро нигоҳ доред: як дарс — як қадам ба пеш.',
  'notify.lesson.bodies_named': 'Мавзӯи «{lesson}»-ро идома диҳед — ҳамагӣ чанд дақиқа.\n«{lesson}» нимтамом мондааст. Биёед, онро анҷом диҳем!\n«{lesson}» шуморо интизор аст.\nИмрӯз «{lesson}»-ро анҷом диҳед — як қадам ба ҳадаф 🎯',
  'notify.morning': 'Субҳ ба хайр, {name}! Рӯзро бо қувват оғоз кунед 💪\nСубҳ ба хайр! Имрӯз рӯзи нави дониш аст ✨\nСалом, {name}! Як дарси кӯтоҳ — ва рӯз самаранок.\nСубҳ ба хайр! Ҳадафи имрӯза: як дарс 🎯\nРӯзатон ба хайр, {name}! Мо шуморо интизорем.',
  'notify.birthday': 'Зодрӯзатон муборак, {name}! 🎂 Бигзор ин сол пур аз қувват, дониш ва ғалабаҳо бошад 🏆\nЗодрӯз муборак, {name}! Ҳар рӯзи соли нав як қадам ба ҳадафи калон бошад ✨',
  'widget.s_morning': 'Субҳ ба хайр!|Дарс барвақттар?\nСалом, қаҳрамон!|Як дарси кӯтоҳ — ва рӯз самаранок',
  'ai.taglines': 'Салом, {name}! Имрӯз чӣ меомӯзем? 📚\nЯк саволи ҷиддӣ? Омодаам 💡\nҲамеша ба кӯмак омодаам ✨\nСалом, {name}! Кор аз куҷо сар мекунем? 🚀\nМасъаларо фиристед — ҳал мекунем ➗\nИмрӯз чизи наверо кашф мекунем? 🔍\nСалом, {name}! Омодаӣ? 💪\nДониш — қуввати ҳақиқӣ 🧠\nПурсед — ҷавоби дақиқ медиҳам 🎯\nЯк қадам ба сӯи ҳадаф? 🚀\nИлм, таърих ё масъала — интихоб аз шумо 📝\nБиёед якҷоя фикр кунем 🤔\nДарсҳо интизоранд! ⏰\nСаволи хурд — ҷавоби калон ✨',
  'ai.taglines_morning': 'Субҳ ба хайр, {name}! ☀️\nРӯзи навро бо чӣ оғоз кунем?\nҲадафи имрӯза чист? 🎯\nСубҳи барвақт — фикри тоза'
}

const ru: Words = {
  'home.seven_schools': '7 школ юноши',
  'welcome.schools.q': 'Какие школы вам интересны?',
  'start.subtitle': 'Сила — в знании',
  'home.motto': 'Сила — в знании.',
  'share.title': 'Поделиться с друзьями',
  'share.text': '«LifeHub» — обучающее приложение для юношей и девушек. Сила — в знании:',
  'recovery.q.friend': 'Имя близкого друга?',
  'recovery.q.flower': 'Ваш любимый вид спорта?',
  'poem.title': 'Сокровищница творчества',
  'ai.subtitle': 'Ваш мудрый помощник',
  'intro.hello': 'Привет, дорогой друг!',
  'done.share': 'Поделиться с друзьями',
  'welcome.source.options': 'Соцсети\nОт друзей\nИз поисковика',
  'notify.lesson.titles': 'Время урока, {name} 💪\nЗнания ждут\n{name}, один шаг сегодня\nСегодня урок — завтра результат 📈\nНе забывай о цели, {name}',
  'notify.lesson.bodies': 'Продолжите темы — один урок сегодня лучше, чем ничего.\nОткройте новую школу и узнайте новое.\nСохраните серию дней: один урок — один шаг вперёд.',
  'notify.lesson.bodies_named': 'Продолжите тему «{lesson}» — всего несколько минут.\n«{lesson}» осталась наполовину. Давайте закончим!\nУрок «{lesson}» ждёт вас.\nЗакончите «{lesson}» сегодня — шаг к цели 🎯',
  'notify.morning': 'Доброе утро, {name}! Начните день с силой 💪\nДоброе утро! Сегодня новый день знаний ✨\nПривет, {name}! Один короткий урок — и день прожит не зря.\nДоброе утро! Цель на сегодня: один урок 🎯',
  'notify.birthday': 'С днём рождения, {name}! 🎂 Пусть этот год будет полон силы, знаний и побед 🏆\nС днём рождения, {name}! Пусть каждый день нового года будет шагом к большой цели ✨',
  'widget.s_morning': 'Доброе утро!|Урок пораньше?\nПривет, чемпион!|Короткий урок — и день не зря',
  'ai.taglines': 'Привет, {name}! Что изучаем сегодня? 📚\nСерьёзный вопрос? Я готова 💡\nВсегда готова помочь ✨\nПривет, {name}! С чего начнём? 🚀\nПришлите задачу — решим ➗\nОткроем сегодня что-то новое? 🔍\nПривет, {name}! Готов? 💪\nЗнание — настоящая сила 🧠\nСпрашивайте — отвечу точно 🎯\nШаг к цели? 🚀\nНаука, история или задача — выбирайте 📝\nДавайте подумаем вместе 🤔\nУроки ждут! ⏰\nМаленький вопрос — большой ответ ✨',
  'ai.taglines_morning': 'Доброе утро, {name}! ☀️\nС чего начнём новый день?\nКакая цель на сегодня? 🎯'
}

const en: Words = {
  'home.seven_schools': "7 schools for a young man",
  'welcome.schools.q': 'Which schools interest you?',
  'start.subtitle': 'Strength lies in knowledge',
  'home.motto': 'Strength lies in knowledge.',
  'share.text': '“LifeHub” — a learning app for boys and girls. Strength lies in knowledge:',
  'recovery.q.flower': 'Your favourite sport?',
  'poem.title': 'Treasury of verse',
  'ai.subtitle': 'Your wise assistant',
  'notify.lesson.titles': "Lesson time, {name} 💪\nKnowledge is waiting\n{name}, one step today\nA lesson today, results tomorrow 📈\nKeep your goal in mind, {name}",
  'notify.lesson.bodies': 'Keep going — one lesson today is better than none.\nOpen a new school and learn something new.\nKeep your streak: one lesson, one step forward.',
  'notify.lesson.bodies_named': 'Continue “{lesson}” — just a few minutes.\n“{lesson}” is half done. Let’s finish it!\n“{lesson}” is waiting for you.\nFinish “{lesson}” today — a step to your goal 🎯',
  'notify.morning': 'Good morning, {name}! Start the day strong 💪\nGood morning! Today is a new day of knowledge ✨\nHello, {name}! One short lesson makes the day count.\nGood morning! Today’s goal: one lesson 🎯',
  'notify.birthday': 'Happy birthday, {name}! 🎂 May this year be full of strength, knowledge and wins 🏆\nHappy birthday, {name}! May every day of the new year be a step to a big goal ✨',
  'widget.s_morning': 'Good morning!|An early lesson?\nHi, champ!|One short lesson makes the day count',
  'ai.taglines': "Hi {name}! What shall we learn today? 📚\nA serious question? I'm ready 💡\nAlways ready to help ✨\nHi {name}! Where do we start? 🚀\nSend a problem — we'll solve it ➗\nShall we discover something new today? 🔍\nHey {name}! Ready? 💪\nKnowledge is real strength 🧠\nAsk — I'll answer precisely 🎯\nOne step closer to your goal? 🚀\nScience, history or a problem — you choose 📝\nLet's think it through together 🤔\nThe lessons are waiting! ⏰\nA small question, a big answer ✨",
  'ai.taglines_morning': "Good morning, {name}! ☀️\nHow shall we start the day?\nWhat's today's goal? 🎯"
}

const uz: Words = {
  'home.seven_schools': "Yigitning 7 maktabi",
  'welcome.schools.q': 'Qaysi maktablar sizni qiziqtiradi?',
  'start.subtitle': 'Kuch — bilimda',
  'home.motto': 'Kuch — bilimda.',
  'share.text': "«LifeHub» — o‘g‘il va qiz bolalar uchun o‘quv ilovasi. Kuch — bilimda:",
  'ai.subtitle': 'Dono yordamchingiz'
}
const tr: Words = {
  'home.seven_schools': 'Bir gencin 7 okulu',
  'welcome.schools.q': 'Hangi okullar ilginizi çekiyor?',
  'start.subtitle': 'Güç bilgidedir',
  'home.motto': 'Güç bilgidedir.',
  'share.text': '«LifeHub» — erkekler ve kızlar için bir eğitim uygulaması. Güç bilgidedir:',
  'ai.subtitle': 'Bilge yardımcınız'
}
const fa: Words = {
  'home.seven_schools': '۷ مکتب پسر',
  'welcome.schools.q': 'کدام مکتب‌ها برایتان جالب است؟',
  'start.subtitle': 'نیرو در دانش است',
  'home.motto': 'نیرو در دانش است.',
  'share.text': '«LifeHub» — برنامهٔ آموزشی برای پسران و دختران. نیرو در دانش است:',
  'ai.subtitle': 'یاور دانای شما'
}
const prs: Words = {
  'home.seven_schools': '۷ مکتب پسر',
  'welcome.schools.q': 'کدام مکتب‌ها برایتان دلچسپ است؟',
  'start.subtitle': 'قوت در دانش است',
  'home.motto': 'قوت در دانش است.',
  'share.text': '«LifeHub» — برنامهٔ آموزشی برای پسران و دختران. قوت در دانش است:',
  'ai.subtitle': 'یاور دانای شما'
}

export const BOY_STRINGS: Record<Locale, Words> = { tg, ru, en, uz, tr, fa, prs }
