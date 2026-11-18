/** Built-in UI texts (short, precise — spec Part II §4). The CMS (ui_strings) overrides any key. */
export type Locale = 'tg' | 'ru' | 'ar'

const tg = {
  'app.name': 'Духтари хубам',
  'nav.home': 'Асосӣ', 'nav.schools': 'Мактабҳо', 'nav.saved': 'Захираҳо', 'nav.profile': 'Профил',
  'home.greeting': 'Салом', 'home.continue_learning': 'Идомаи омӯзиш', 'home.seven_schools': 'Ҳафт мактаби дониш',
  'home.all_schools': 'Ҳамаи мактабҳо', 'home.inspiration': 'Илҳоми рӯз',
  'glass.motto_1': 'Ту метавонӣ!', 'glass.motto_2': 'Хеле зебоед', 'glass.motto_3': 'Ба худ бовар кун',
  'app.update': 'Версияи нави барнома омода аст', 'app.update_action': 'Навсозӣ',
  'start.welcome': 'Хуш омадед', 'start.tagline': 'Ҳамаи дарсҳо бе интернет ҳам кушода мешаванд.',
  'start.register': 'Бақайдгирӣ', 'start.login': 'Ворид', 'start.name': 'Номи шумо', 'start.create': 'Давом',
  'start.your_code': 'Коди шахсии шумо', 'start.keep_code': 'Ин кодро нависед ё акс гиред. Бо он пас аз насби дубора ё дар телефони дигар ҳамаи пешрафти шумо бармегардад.',
  'start.copy': 'Нусха гирифтан', 'start.copied': 'Нусха гирифта шуд', 'start.saved_it': 'Кодро сабт кардам',
  'start.enter_code': 'Коди 15-рақама', 'start.restore': 'Ворид шудан', 'start.not_found': 'Ин код ёфт нашуд. Рақамҳоро санҷед.',
  'start.need_online': 'Барои ворид шудан бо код як бор интернет лозим аст.',
  'profile.code': 'Коди воридшавӣ', 'profile.show_code': 'Нишон додан', 'profile.hide_code': 'Пинҳон кардан',
  'profile.synced': 'Нусхаи эҳтиётӣ сабт шуд', 'profile.sync_offline': 'Бе интернет: ҳангоми пайвастшавӣ сабт мешавад',
  'profile.signout_confirm': 'Баромадан? Бе коди 15-рақама пешрафт барнамегардад.', 'profile.signout': 'Баромадан аз ин телефон',
  'state.offline_empty': 'Мундариҷа ҳанӯз ба телефон бор нашудааст. Як бор ба интернет пайваст шавед.',
  'action.continue': 'Идома', 'action.start_course': 'Оғози курс', 'action.save': 'Захира', 'action.saved': 'Захира шуд',
  'action.retry': 'Такрор', 'action.back': 'Бозгашт', 'action.next': 'Навбатӣ', 'action.prev': 'Қаблӣ',
  'action.check': 'Санҷиш', 'action.submit': 'Супоридан', 'action.search': 'Ҷустуҷӯ', 'action.start': 'Оғоз', 'action.close': 'Пӯшидан',
  'action.text_size': 'Андозаи матн', 'action.more': 'Бештар', 'action.retry_quiz': 'Аз нав',
  'section.progress': 'Пешрафт', 'section.results': 'Натиҷаҳо', 'section.courses': 'Курсҳо', 'section.about': 'Тавсиф',
  'section.achievements': 'Дастовардҳо', 'section.lessons': 'Дарсҳо', 'section.goals': 'Ҳадафҳо', 'section.quizzes': 'Тестҳо',
  'settings.title': 'Танзимот', 'settings.language': 'Забон', 'settings.theme': 'Режими намоиш',
  'settings.notifications': 'Огоҳиҳо', 'settings.animation': 'Аниматсия', 'settings.text_size': 'Андозаи матн',
  'settings.privacy': 'Махфият', 'settings.about': 'Дар бораи барнома', 'settings.export': 'Маълумоти ман',
  'theme.light': 'Равшан', 'theme.dark': 'Торик', 'theme.system': 'Система',
  'motion.full': 'Пурра', 'motion.reduce': 'Кам',
  'state.empty_courses': 'Ҳанӯз курс нест', 'state.empty_saved': 'Ҳанӯз захира нест', 'state.empty_results': 'Ҳанӯз натиҷа нест',
  'state.empty_search': 'Чизе ёфт нашуд', 'state.error': 'Хато шуд', 'state.offline': 'Пайваст нест',
  'state.not_configured': 'Сервер ҳанӯз танзим нашудааст', 'state.locked': 'Барои Premium', 'state.signin_needed': 'Ворид шавед',
  'state.loading': 'Боркунӣ',
  'quiz.question': 'Савол', 'quiz.of': 'аз', 'quiz.passed': 'Гузашт', 'quiz.failed': 'Нагузашт', 'quiz.pending': 'Дар санҷиш',
  'quiz.correct': 'Дуруст', 'quiz.incorrect': 'Нодуруст', 'quiz.partial': 'Қисман', 'quiz.explanation': 'Шарҳ',
  'quiz.your_answer': 'Ҷавоб', 'quiz.score': 'Хол', 'quiz.match_pick': 'Интихоб',
  'lesson.of': 'аз', 'lesson.minutes': 'дақ.', 'lesson.completed': 'Анҷом ёфт', 'lesson.mark_done': 'Анҷом', 'lesson.lesson': 'Дарси',
  'lesson.source': 'Манбаъ', 'lesson.important': 'Муҳим', 'profile.lessons': 'Дарсҳо', 'profile.courses': 'Курсҳо',
  'profile.quizzes': 'Тестҳо', 'profile.badges': 'Нишонҳо'
}

export type UiKey = keyof typeof tg

const ru: Partial<Record<UiKey, string>> = {
  'nav.home': 'Главная', 'nav.schools': 'Школы', 'nav.saved': 'Сохранённое', 'nav.profile': 'Профиль',
  'home.greeting': 'Здравствуйте', 'home.continue_learning': 'Продолжить', 'home.seven_schools': 'Семь школ знаний',
  'glass.motto_1': 'Ты сможешь!', 'glass.motto_2': 'Вы прекрасны', 'glass.motto_3': 'Верь в себя',
  'app.update': 'Доступна новая версия приложения', 'app.update_action': 'Обновить',
  'start.welcome': 'Добро пожаловать', 'start.tagline': 'Все уроки открываются и без интернета.',
  'start.register': 'Регистрация', 'start.login': 'Вход', 'start.name': 'Ваше имя', 'start.create': 'Далее',
  'start.your_code': 'Ваш личный код', 'start.keep_code': 'Запишите или сфотографируйте этот код: по нему весь прогресс вернётся после переустановки или на другом телефоне.',
  'start.copy': 'Копировать', 'start.copied': 'Скопировано', 'start.saved_it': 'Я сохранила код',
  'start.enter_code': 'Код из 15 цифр', 'start.restore': 'Войти', 'start.not_found': 'Код не найден. Проверьте цифры.',
  'start.need_online': 'Для входа по коду один раз нужен интернет.',
  'profile.code': 'Код входа', 'profile.show_code': 'Показать', 'profile.hide_code': 'Скрыть',
  'profile.synced': 'Резервная копия сохранена', 'profile.sync_offline': 'Нет сети: сохраним при подключении',
  'profile.signout_confirm': 'Выйти? Без кода из 15 цифр прогресс не вернуть.', 'profile.signout': 'Выйти на этом телефоне',
  'state.offline_empty': 'Материалы ещё не загружены. Подключитесь к интернету один раз.',
  'home.all_schools': 'Все школы', 'action.continue': 'Продолжить', 'action.back': 'Назад', 'action.next': 'Далее',
  'action.prev': 'Назад', 'action.search': 'Поиск',
  'settings.title': 'Настройки', 'settings.language': 'Язык', 'settings.theme': 'Тема', 'settings.notifications': 'Уведомления',
  'settings.animation': 'Анимация', 'settings.text_size': 'Размер текста', 'settings.privacy': 'Конфиденциальность',
  'theme.light': 'Светлая', 'theme.dark': 'Тёмная', 'theme.system': 'Системная', 'state.error': 'Ошибка',
  'state.empty_courses': 'Пока нет курсов', 'state.not_configured': 'Сервер ещё не настроен'
}

const ar: Partial<Record<UiKey, string>> = {
  'nav.home': 'الرئيسية', 'nav.schools': 'المدارس', 'nav.saved': 'المحفوظات', 'nav.profile': 'الملف الشخصي',
  'home.greeting': 'مرحبًا', 'home.continue_learning': 'متابعة التعلّم', 'home.all_schools': 'كل المدارس',
  'glass.motto_1': 'أنتِ قادرة!', 'glass.motto_2': 'أنتِ جميلة جدًا', 'glass.motto_3': 'ثقي بنفسك',
  'app.update': 'يتوفر إصدار جديد من التطبيق', 'app.update_action': 'تحديث',
  'start.welcome': 'أهلًا بكِ', 'start.tagline': 'كل الدروس تعمل دون إنترنت.',
  'start.register': 'تسجيل', 'start.login': 'دخول', 'start.name': 'اسمكِ', 'start.create': 'متابعة',
  'start.your_code': 'رمزكِ الشخصي', 'start.keep_code': 'احفظي هذا الرمز: به يعود تقدّمكِ بعد إعادة التثبيت أو على هاتف آخر.',
  'start.copy': 'نسخ', 'start.copied': 'تم النسخ', 'start.saved_it': 'حفظتُ الرمز',
  'start.enter_code': 'رمز من 15 رقمًا', 'start.restore': 'دخول', 'start.not_found': 'لم يُعثر على الرمز. تحققي من الأرقام.',
  'start.need_online': 'يلزم الإنترنت مرة واحدة للدخول بالرمز.',
  'profile.code': 'رمز الدخول', 'profile.show_code': 'إظهار', 'profile.hide_code': 'إخفاء',
  'profile.synced': 'حُفظت النسخة الاحتياطية', 'profile.sync_offline': 'دون إنترنت: ستُحفظ عند الاتصال',
  'profile.signout_confirm': 'الخروج؟ لا يعود التقدّم دون الرمز.', 'profile.signout': 'الخروج من هذا الهاتف',
  'state.offline_empty': 'لم يُحمّل المحتوى بعد. اتصلي بالإنترنت مرة واحدة.',
  'action.continue': 'متابعة', 'action.back': 'رجوع', 'action.next': 'التالي', 'action.prev': 'السابق', 'action.search': 'بحث',
  'settings.title': 'الإعدادات', 'settings.language': 'اللغة', 'settings.theme': 'المظهر', 'settings.notifications': 'الإشعارات',
  'settings.animation': 'الحركة', 'settings.text_size': 'حجم النص', 'settings.privacy': 'الخصوصية',
  'theme.light': 'فاتح', 'theme.dark': 'داكن', 'theme.system': 'النظام', 'state.error': 'حدث خطأ'
}

export const DEFAULT_STRINGS: Record<Locale, Partial<Record<UiKey, string>>> = { tg, ru, ar }
export const LOCALE_LABELS: Record<Locale, string> = { tg: 'Тоҷикӣ', ru: 'Русский', ar: 'العربية' }
