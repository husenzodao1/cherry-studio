import type { Locale, UiKey } from '../i18n'

/**
 * The words of boys' mode: every text written for girls (her "seven mirrors", "girlfriends", flowers and
 * hearts) said the way a boy is spoken to — plainer, more serious. Anything not here is the same for both.
 * Mahliyo's own sign-in and error messages stay as they are.
 */
type Words = Partial<Record<UiKey, string>>

const tg: Words = {
  'home.seven_schools': '7 мактаби писар',
  'widget.s_morning': "Субҳ ба хайр!|Дарс барвақттар?\nСалом, қаҳрамон!|Як дарси кӯтоҳ — ва рӯз самаранок\nСубҳи барвақт 💪|Мағз ҳоло тез кор мекунад\nҲадафи имрӯза?|Як мавзӯъ — як ғалаба\nРӯзи нав — имконияти нав|Аз 5 дақиқа оғоз кун\nБархостӣ? Офарин!|Биё як қадам ба пеш\nЧемпион бедор шуд 🏁|Вақти омӯзиш\nСубҳ ба хайр, дӯстам|Имрӯз чӣ меомӯзем?",
  'widget.s_win': "Офарин!|Имрӯз ғолибӣ 🏆\nДарс тамом!|Ҳамин хел давом деҳ 💪\nЯк қадам ба ҳадаф!|Натиҷа меояд\nАъло!|Дониш — қуввати ту\nКор анҷом шуд ✅|Пагоҳ боз\nТу тавонистӣ!|Ин хислати мард аст",
  'widget.s_fire': "{n} рӯз пай дар пай!|Оташро нигоҳ дор\nОташ месӯзад 🔥|{n} рӯз — интизоми ту\nСилсила — {n}!|Ирода пӯлодин\n{n} рӯз бе танаффус|Ин аллакай одат аст\nШӯъла баланд!|Пагоҳ ҳам меоӣ?\nҚаҳрамони {n} рӯз 🔥|Аз роҳ нагард",
  'widget.s_wait': "Ман интизорам…|Як дарси хурд?\nВақти дарс аст|Танҳо 5 дақиқа\nҲадафро фаромӯш накун|Мавзӯъ интизор аст\nТанаффус бас|Биё, як саҳифа\nНимаи рӯз ☀️|Вақти беҳтарин барои дарс\nМан ҳамин ҷоям 👋|Ҳар вақт омода бошӣ\nЯк савол ба ту|Имрӯз чӣ нав меомӯзем?\nТелефон дар даст?|Пас як дарс ҳам 📚",
  'widget.s_worry': "Силсила дар хатар!|{n} рӯз — нигоҳ дор\nВақт кам мондааст!|Як дарс — ва ҳама наҷот\nШом наздик аст|{n} рӯзро гум накунем\nҲанӯз вақт ҳаст|Як мавзӯи хурд бас\nМард аз ҳадаф намегардад|5 дақиқа ёб",
  'widget.s_last': "Имконияти охирин…|5 дақиқа бас аст\nНимашаб наздик!|{n} рӯзро наҷот деҳ\nСоат тик-так ⏳|Як дарс то нимашаб\nОхирин даври рӯз|Ғалабаро гум накун",
  'widget.s_sad': "Оташ хомӯш шуд…|Аз нав оғоз кунем?\nҲеҷ гап не|Ҳар рӯз имконияти нав\nЧемпионҳо ҳам меафтанд|ва боз мехезанд 💪\nБиё, дубора|Аз як дарс сар кунем",
  'widget.s_sleep': "Вақти хоб 💤|Пагоҳ бо қувват\nШаби хуш|Мағз дар хоб меомӯзад\nТелефонро гузор|Бадан ҳам истироҳат мехоҳад\nШаб ором аст 🌙|Пагоҳ ҳадафи нав",
  'widget.s_party': "Рекорд! {n} рӯз 🎉|Ту беҳтаринӣ\nҒалаба!|{n} рӯз пай дар пай 🏆\n{n} рӯз — сатҳи нав!|Ҳамин хел давом деҳ\nТу чемпионӣ!|{n} рӯз бе танаффус 🥇",
  'widget.s_cold': "Чанд рӯз нестӣ…|Ҳадафҳо интизоранд\nКуҷо рафтӣ?|Бозгашт аз як қадам\nСалом, дӯстам!|Як дарс — ва боз дар роҳ\nҲанӯз дер нест|Аз нав оғоз кун",
  'home.quote': 'Дониш — қуввате, ки ҳеҷ кас аз ту гирифта наметавонад.',
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
  'ai.taglines': 'Салом, {name}! Имрӯз чӣ меомӯзем? 📚\nЯк саволи ҷиддӣ? Омодаам 💡\nҲамеша ба кӯмак омодаам ✨\nСалом, {name}! Кор аз куҷо сар мекунем? 🚀\nМасъаларо фиристед — ҳал мекунем ➗\nИмрӯз чизи наверо кашф мекунем? 🔍\nСалом, {name}! Омодаӣ? 💪\nДониш — қуввати ҳақиқӣ 🧠\nПурсед — ҷавоби дақиқ медиҳам 🎯\nЯк қадам ба сӯи ҳадаф? 🚀\nИлм, таърих ё масъала — интихоб аз шумо 📝\nБиёед якҷоя фикр кунем 🤔\nДарсҳо интизоранд! ⏰\nСаволи хурд — ҷавоби калон ✨',
  'ai.taglines_morning': 'Субҳ ба хайр, {name}! ☀️\nРӯзи навро бо чӣ оғоз кунем?\nҲадафи имрӯза чист? 🎯\nСубҳи барвақт — фикри тоза'
}

const ru: Words = {
  'home.seven_schools': '7 школ для юношей',
  'widget.s_morning': "Доброе утро!|Урок пораньше?\nПривет, чемпион!|Короткий урок — и день не зря\nРаннее утро 💪|Мозг сейчас работает быстро\nЦель на сегодня?|Одна тема — одна победа\nНовый день — новый шанс|Начни с 5 минут\nВстал? Отлично!|Шаг вперёд\nЧемпион проснулся 🏁|Время учиться\nДоброе утро, друг|Что изучаем сегодня?",
  'widget.s_win': "Отлично!|Сегодня ты победил 🏆\nУрок пройден!|Так держать 💪\nШаг к цели!|Результат придёт\nПревосходно!|Знание — твоя сила\nСделано ✅|Завтра снова\nТы смог!|Это характер",
  'widget.s_fire': "{n} дней подряд!|Держи огонь\nОгонь горит 🔥|{n} дней — твоя дисциплина\nСерия — {n}!|Стальная воля\n{n} дней без перерыва|Это уже привычка\nПламя высоко!|Завтра придёшь?\nГерой {n} дней 🔥|Не сворачивай",
  'widget.s_wait': "Я жду…|Один маленький урок?\nВремя урока|Всего 5 минут\nНе забывай о цели|Тема ждёт\nХватит перерыва|Одна страница\nСередина дня ☀️|Лучшее время учиться\nЯ здесь 👋|Когда будешь готов\nВопрос к тебе|Что нового узнаем?\nТелефон в руке?|Тогда и урок 📚",
  'widget.s_worry': "Серия в опасности!|{n} дней — сохрани\nВремени мало!|Один урок — и всё спасено\nСкоро вечер|Не потеряем {n} дней\nВремя ещё есть|Хватит одной темы\nМужчина не сходит с пути|Найди 5 минут",
  'widget.s_last': "Последний шанс…|5 минут достаточно\nСкоро полночь!|Спаси {n} дней\nЧасы тикают ⏳|Один урок до полуночи\nПоследний раунд дня|Не упусти победу",
  'widget.s_sad': "Огонь погас…|Начнём заново?\nНичего страшного|Каждый день — новый шанс\nЧемпионы тоже падают|и встают снова 💪\nДавай снова|С одного урока",
  'widget.s_sleep': "Пора спать 💤|Завтра с силами\nСпокойной ночи|Мозг учится во сне\nОтложи телефон|Телу тоже нужен отдых\nНочь тихая 🌙|Завтра новая цель",
  'widget.s_party': "Рекорд! {n} дней 🎉|Ты лучший\nПобеда!|{n} дней подряд 🏆\n{n} дней — новый уровень!|Так держать\nТы чемпион!|{n} дней без перерыва 🥇",
  'widget.s_cold': "Тебя давно нет…|Цели ждут\nКуда пропал?|Вернись одним шагом\nПривет, друг!|Один урок — и снова в строю\nЕщё не поздно|Начни заново",
  'home.quote': 'Знание — сила, которую никто у тебя не отнимет.',
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
  'ai.taglines': 'Привет, {name}! Что изучаем сегодня? 📚\nСерьёзный вопрос? Я готова 💡\nВсегда готова помочь ✨\nПривет, {name}! С чего начнём? 🚀\nПришлите задачу — решим ➗\nОткроем сегодня что-то новое? 🔍\nПривет, {name}! Готов? 💪\nЗнание — настоящая сила 🧠\nСпрашивайте — отвечу точно 🎯\nШаг к цели? 🚀\nНаука, история или задача — выбирайте 📝\nДавайте подумаем вместе 🤔\nУроки ждут! ⏰\nМаленький вопрос — большой ответ ✨',
  'ai.taglines_morning': 'Доброе утро, {name}! ☀️\nС чего начнём новый день?\nКакая цель на сегодня? 🎯'
}

const en: Words = {
  'home.seven_schools': "7 schools for a young man",
  'widget.s_morning': "Good morning!|An early lesson?\nHey, champion!|One short lesson — a productive day\nEarly morning 💪|Your mind is quick now\nToday's goal?|One topic — one win\nA new day — a new chance|Start with 5 minutes\nUp already? Great!|One step forward\nThe champion is awake 🏁|Time to learn\nMorning, friend|What do we learn today?",
  'widget.s_win': "Well done!|You won today 🏆\nLesson done!|Keep it up 💪\nA step to the goal!|Results will come\nExcellent!|Knowledge is your strength\nDone ✅|Again tomorrow\nYou did it!|That's character",
  'widget.s_fire': "{n} days in a row!|Keep the fire\nThe fire burns 🔥|{n} days — your discipline\nStreak — {n}!|Iron will\n{n} days non-stop|It's a habit now\nHigh flame!|Back tomorrow?\n{n}-day hero 🔥|Stay on track",
  'widget.s_wait': "I'm waiting…|One little lesson?\nLesson time|Just 5 minutes\nRemember your goal|A topic is waiting\nEnough of a break|One page\nMidday ☀️|The best time to learn\nI'm here 👋|Whenever you're ready\nA question for you|What's new today?\nPhone in hand?|Then a lesson too 📚",
  'widget.s_worry': "Streak in danger!|{n} days — keep them\nTime is short!|One lesson saves it all\nEvening is near|Let's not lose {n} days\nThere's still time|One small topic will do\nStay on your path|Find 5 minutes",
  'widget.s_last': "Last chance…|5 minutes is enough\nMidnight is near!|Save {n} days\nThe clock is ticking ⏳|One lesson before midnight\nThe day's last round|Don't miss the win",
  'widget.s_sad': "The fire went out…|Start again?\nNo worries|Every day is a new chance\nChampions fall too|and get up again 💪\nLet's go again|Start with one lesson",
  'widget.s_sleep': "Time to sleep 💤|Strong tomorrow\nGood night|Your brain learns while you sleep\nPut the phone down|Your body needs rest too\nA quiet night 🌙|A new goal tomorrow",
  'widget.s_party': "Record! {n} days 🎉|You're the best\nVictory!|{n} days in a row 🏆\n{n} days — next level!|Keep going\nYou're a champion!|{n} days non-stop 🥇",
  'widget.s_cold': "You've been away…|Your goals are waiting\nWhere did you go?|Come back with one step\nHey, friend!|One lesson — back on track\nIt's not too late|Start again",
  'home.quote': 'Knowledge is a strength no one can take from you.',
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
