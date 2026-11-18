/** Built-in UI texts (short, precise — spec Part II §4). The CMS (ui_strings) overrides any key. */
export type Locale = 'tg' | 'ru' | 'ar'

const tg = {
  'app.name': 'Духтари хубам',
  'nav.home': 'Асосӣ', 'nav.schools': 'Мактабҳо', 'nav.saved': 'Захираҳо', 'nav.profile': 'Профил',
  'home.greeting': 'Салом', 'home.continue_learning': 'Идомаи омӯзиш', 'home.seven_schools': 'Ҳафт мактаби дониш',
  'home.all_schools': 'Ҳамаи мактабҳо', 'home.inspiration': 'Илҳоми рӯз',
  'glass.motto_1': 'Ту метавонӣ!', 'glass.motto_2': 'Хеле зебоед', 'glass.motto_3': 'Ба худ бовар кун',
  'action.continue': 'Идома', 'action.start_course': 'Оғози курс', 'action.save': 'Захира', 'action.saved': 'Захира шуд',
  'action.retry': 'Такрор', 'action.back': 'Бозгашт', 'action.next': 'Навбатӣ', 'action.prev': 'Қаблӣ',
  'action.check': 'Санҷиш', 'action.submit': 'Супоридан', 'action.signin': 'Воридшавӣ', 'action.signout': 'Баромад',
  'action.signup': 'Сабти ном', 'action.search': 'Ҷустуҷӯ', 'action.start': 'Оғоз', 'action.close': 'Пӯшидан',
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
  'lesson.source': 'Манбаъ', 'lesson.important': 'Муҳим',
  'auth.email': 'Почтаи электронӣ', 'auth.password': 'Рамз', 'auth.magic': 'Воридшавӣ бо коди почта',
  'auth.sent': 'Коди тасдиқ ба почтаи шумо фиристода шуд', 'auth.name': 'Ном', 'auth.have_account': 'Ҳисоб доред?', 'auth.no_account': 'Ҳисоб надоред?',
  'auth.code': 'Коди тасдиқ', 'auth.verify': 'Тасдиқ', 'auth.resend': 'Кодро аз нав фиристед', 'auth.resend_in': 'Аз нав фиристодан пас аз',
  'auth.change_email': 'Почтаи дигар', 'auth.code_wrong': 'Код нодуруст ё кӯҳна аст. Аз нав кӯшиш кунед.',
  'profile.free': 'Ҳисоби ройгон', 'profile.premium': 'Premium', 'profile.lessons': 'Дарсҳо', 'profile.courses': 'Курсҳо',
  'profile.quizzes': 'Тестҳо', 'profile.badges': 'Нишонҳо'
}

export type UiKey = keyof typeof tg

const ru: Partial<Record<UiKey, string>> = {
  'nav.home': 'Главная', 'nav.schools': 'Школы', 'nav.saved': 'Сохранённое', 'nav.profile': 'Профиль',
  'home.greeting': 'Здравствуйте', 'home.continue_learning': 'Продолжить', 'home.seven_schools': 'Семь школ знаний',
  'glass.motto_1': 'Ты сможешь!', 'glass.motto_2': 'Вы прекрасны', 'glass.motto_3': 'Верь в себя',
  'home.all_schools': 'Все школы', 'action.continue': 'Продолжить', 'action.back': 'Назад', 'action.next': 'Далее',
  'action.prev': 'Назад', 'action.signin': 'Войти', 'action.signout': 'Выйти', 'action.search': 'Поиск',
  'settings.title': 'Настройки', 'settings.language': 'Язык', 'settings.theme': 'Тема', 'settings.notifications': 'Уведомления',
  'settings.animation': 'Анимация', 'settings.text_size': 'Размер текста', 'settings.privacy': 'Конфиденциальность',
  'theme.light': 'Светлая', 'theme.dark': 'Тёмная', 'theme.system': 'Системная', 'state.error': 'Ошибка',
  'state.empty_courses': 'Пока нет курсов', 'state.not_configured': 'Сервер ещё не настроен'
}

const ar: Partial<Record<UiKey, string>> = {
  'nav.home': 'الرئيسية', 'nav.schools': 'المدارس', 'nav.saved': 'المحفوظات', 'nav.profile': 'الملف الشخصي',
  'home.greeting': 'مرحبًا', 'home.continue_learning': 'متابعة التعلّم', 'home.all_schools': 'كل المدارس',
  'glass.motto_1': 'أنتِ قادرة!', 'glass.motto_2': 'أنتِ جميلة جدًا', 'glass.motto_3': 'ثقي بنفسك',
  'action.continue': 'متابعة', 'action.back': 'رجوع', 'action.next': 'التالي', 'action.prev': 'السابق',
  'action.signin': 'تسجيل الدخول', 'action.signout': 'تسجيل الخروج', 'action.search': 'بحث',
  'settings.title': 'الإعدادات', 'settings.language': 'اللغة', 'settings.theme': 'المظهر', 'settings.notifications': 'الإشعارات',
  'settings.animation': 'الحركة', 'settings.text_size': 'حجم النص', 'settings.privacy': 'الخصوصية',
  'theme.light': 'فاتح', 'theme.dark': 'داكن', 'theme.system': 'النظام', 'state.error': 'حدث خطأ'
}

export const DEFAULT_STRINGS: Record<Locale, Partial<Record<UiKey, string>>> = { tg, ru, ar }
export const LOCALE_LABELS: Record<Locale, string> = { tg: 'Тоҷикӣ', ru: 'Русский', ar: 'العربية' }
