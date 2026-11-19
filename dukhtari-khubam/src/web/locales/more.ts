import type { UiKey } from '../i18n'

/** Uzbek, Turkish, Persian (Iran) and Dari: the main screens. Missing keys fall back to English. */

export const uz: Partial<Record<UiKey, string>> = {
  'nav.home': 'Bosh sahifa', 'nav.schools': 'Maktablar', 'nav.saved': 'Saqlanganlar', 'nav.profile': 'Profil',
  'home.greeting': 'Salom', 'home.continue_learning': 'Davom etish', 'home.all_schools': 'Barcha maktablar', 'home.words': 'Kun so‘zlari',
  'home.motto': 'Go‘zallik — bilimda.', 'home.continue_course': 'Kursni davom ettirish', 'home.start_learning': 'O‘qishni boshlash', 'home.choose_school': 'Maktab tanlash', 'home.all': 'Hammasi',
  'greet.morning': 'Xayrli tong', 'greet.day': 'Xayrli kun', 'greet.evening': 'Xayrli kech', 'greet.night': 'Xayrli tun',
  'start.subtitle': 'Go‘zallik — bilimda', 'start.name': 'Ismingiz', 'start.create': 'Davom etish', 'start.need_online': 'Kirish uchun internet kerak',
  'start.birthday': 'Tug‘ilgan sana', 'start.birthday_ph': 'kk.oo.yyyy', 'start.birthday_wrong': 'Sanani to‘g‘ri yozing: kun.oy.yil',
  'start.about_title': 'Tanishib olaylik', 'start.about_hint': 'Ismingiz va tug‘ilgan kuningizni yozing',
  'start.agree': '«Davom etish» yoki «Google orqali kirish» tugmasini bosib, siz [Foydalanish shartlari] va [Maxfiylik siyosati]ga rozilik bildirasiz.',
  'google.continue': 'Google orqali kirish', 'google.wait': 'Kuting', 'google.or': 'yoki', 'google.failed': 'Google orqali kirib bo‘lmadi. Yana urinib ko‘ring.',
  'email.label': 'Pochta', 'email.code_title': 'Xatdagi olti raqam', 'email.code_sent': 'Kod {email} manziliga yuborildi. Xat yo‘qmi — «Spam»ni tekshiring.',
  'email.confirm': 'Tasdiqlash', 'email.resend': 'Yangi kod yuborish', 'email.resend_in': 'Yangi kod {n} soniyadan so‘ng', 'email.wrong_code': 'Kod noto‘g‘ri yoki eskirgan',
  'pin.enter': 'PIN kodni kiriting', 'pin.wrong': 'PIN noto‘g‘ri', 'pin.forgot': 'PINni unutdingizmi?', 'pin.cancel': 'Bekor qilish', 'pin.new': 'Yangi PIN', 'pin.repeat': 'PINni takrorlang',
  'settings.title': 'Sozlamalar', 'settings.language': 'Til', 'settings.theme': 'Mavzu', 'settings.notifications': 'Kundalik bildirishnomalar', 'settings.text_size': 'Matn o‘lchami',
  'settings.privacy': 'Maxfiylik', 'settings.about': 'Ilova haqida', 'settings.version': 'Versiya', 'settings.other_apps': 'Boshqa ilovalar', 'settings.other_apps_soon': 'Tez orada',
  'theme.light': 'Oq', 'theme.peach': 'Shaftoli', 'theme.mint': 'Yalpiz', 'theme.dusk': 'Shafaq', 'theme.dark': 'Qorong‘i',
  'profile.signout': 'Chiqish', 'profile.signout_confirm': 'Chiqasizmi?', 'profile.streak': 'Ketma-ket kunlar', 'profile.achievements': 'Yutuqlar',
  'action.continue': 'Davom etish', 'action.back': 'Orqaga', 'action.next': 'Keyingi', 'action.search': 'Qidiruv', 'action.close': 'Yopish', 'action.save': 'Saqlash',
  'state.error': 'Xatolik yuz berdi', 'state.offline': 'Aloqa yo‘q',
  'welcome.next': 'Keyingi', 'welcome.skip': 'O‘tkazib yuborish', 'welcome.preparing': 'Darslaringiz tayyorlanmoqda', 'welcome.ready': 'Tayyor!',
  'poem.title': 'Ijod gulzori', 'splash.loading': 'Yuklanmoqda'
}

export const tr: Partial<Record<UiKey, string>> = {
  'nav.home': 'Ana sayfa', 'nav.schools': 'Okullar', 'nav.saved': 'Kaydedilenler', 'nav.profile': 'Profil',
  'home.greeting': 'Merhaba', 'home.continue_learning': 'Devam et', 'home.all_schools': 'Tüm okullar', 'home.words': 'Günün sözleri',
  'home.motto': 'Güzellik bilgidedir.', 'home.continue_course': 'Kursa devam et', 'home.start_learning': 'Öğrenmeye başla', 'home.choose_school': 'Okul seç', 'home.all': 'Tümü',
  'greet.morning': 'Günaydın', 'greet.day': 'İyi günler', 'greet.evening': 'İyi akşamlar', 'greet.night': 'İyi geceler',
  'start.subtitle': 'Güzellik bilgidedir', 'start.name': 'Adınız', 'start.create': 'Devam', 'start.need_online': 'Giriş için internet gerekli',
  'start.birthday': 'Doğum tarihi', 'start.birthday_ph': 'gg.aa.yyyy', 'start.birthday_wrong': 'Tarihi gün.ay.yıl olarak yazın',
  'start.about_title': 'Tanışalım', 'start.about_hint': 'Adınızı ve doğum tarihinizi yazın',
  'start.agree': '«Devam» veya «Google ile giriş» düğmesine basarak [Kullanım koşulları] ve [Gizlilik politikası]nı kabul etmiş olursunuz.',
  'google.continue': 'Google ile giriş', 'google.wait': 'Lütfen bekleyin', 'google.or': 'veya', 'google.failed': 'Google ile giriş yapılamadı. Tekrar deneyin.',
  'email.label': 'E-posta', 'email.code_title': 'E-postadaki altı rakam', 'email.code_sent': 'Kod {email} adresine gönderildi. E-posta yoksa «Spam» klasörüne bakın.',
  'email.confirm': 'Onayla', 'email.resend': 'Yeni kod gönder', 'email.resend_in': '{n} sn sonra yeni kod', 'email.wrong_code': 'Kod yanlış veya süresi dolmuş',
  'pin.enter': 'PIN girin', 'pin.wrong': 'Yanlış PIN', 'pin.forgot': 'PIN’i mi unuttunuz?', 'pin.cancel': 'İptal', 'pin.new': 'Yeni PIN', 'pin.repeat': 'PIN’i tekrarlayın',
  'settings.title': 'Ayarlar', 'settings.language': 'Dil', 'settings.theme': 'Tema', 'settings.notifications': 'Günlük bildirimler', 'settings.text_size': 'Yazı boyutu',
  'settings.privacy': 'Gizlilik', 'settings.about': 'Uygulama hakkında', 'settings.version': 'Sürüm', 'settings.other_apps': 'Diğer uygulamalar', 'settings.other_apps_soon': 'Yakında',
  'theme.light': 'Beyaz', 'theme.peach': 'Şeftali', 'theme.mint': 'Nane', 'theme.dusk': 'Alacakaranlık', 'theme.dark': 'Koyu',
  'profile.signout': 'Çıkış', 'profile.signout_confirm': 'Çıkış yapılsın mı?', 'profile.streak': 'Art arda gün', 'profile.achievements': 'Başarılar',
  'action.continue': 'Devam', 'action.back': 'Geri', 'action.next': 'İleri', 'action.search': 'Ara', 'action.close': 'Kapat', 'action.save': 'Kaydet',
  'state.error': 'Bir hata oluştu', 'state.offline': 'Bağlantı yok',
  'welcome.next': 'İleri', 'welcome.skip': 'Geç', 'welcome.preparing': 'Dersleriniz hazırlanıyor', 'welcome.ready': 'Hazır!',
  'poem.title': 'Şiir bahçesi', 'splash.loading': 'Yükleniyor'
}

export const fa: Partial<Record<UiKey, string>> = {
  'nav.home': 'خانه', 'nav.schools': 'مدرسه‌ها', 'nav.saved': 'ذخیره‌ها', 'nav.profile': 'نمایه',
  'home.greeting': 'سلام', 'home.continue_learning': 'ادامه', 'home.all_schools': 'همه مدرسه‌ها', 'home.words': 'سخنان روز',
  'home.motto': 'زیبایی در دانش است.', 'home.continue_course': 'ادامه دوره', 'home.start_learning': 'شروع یادگیری', 'home.choose_school': 'انتخاب مدرسه', 'home.all': 'همه',
  'greet.morning': 'صبح بخیر', 'greet.day': 'روز بخیر', 'greet.evening': 'عصر بخیر', 'greet.night': 'شب بخیر',
  'start.subtitle': 'زیبایی در دانش است', 'start.name': 'نام شما', 'start.create': 'ادامه', 'start.need_online': 'برای ورود به اینترنت نیاز است',
  'start.birthday': 'تاریخ تولد', 'start.birthday_ph': 'روز.ماه.سال', 'start.birthday_wrong': 'تاریخ را به شکل روز.ماه.سال بنویسید',
  'start.about_title': 'بیایید آشنا شویم', 'start.about_hint': 'نام و تاریخ تولد خود را بنویسید',
  'start.agree': 'با زدن «ادامه» یا «ورود با Google» با [شرایط استفاده] و [سیاست حریم خصوصی] موافقت می‌کنید.',
  'google.continue': 'ورود با Google', 'google.wait': 'لطفاً صبر کنید', 'google.or': 'یا', 'google.failed': 'ورود با Google ممکن نشد. دوباره تلاش کنید.',
  'email.label': 'ایمیل', 'email.code_title': 'شش رقم از ایمیل', 'email.code_sent': 'کد به {email} فرستاده شد. اگر نیامد، پوشه «Spam» را ببینید.',
  'email.confirm': 'تأیید', 'email.resend': 'ارسال کد تازه', 'email.resend_in': 'کد تازه پس از {n} ثانیه', 'email.wrong_code': 'کد نادرست است یا منقضی شده',
  'pin.enter': 'PIN را وارد کنید', 'pin.wrong': 'PIN نادرست است', 'pin.forgot': 'PIN را فراموش کرده‌اید؟', 'pin.cancel': 'لغو', 'pin.new': 'PIN تازه', 'pin.repeat': 'PIN را تکرار کنید',
  'settings.title': 'تنظیمات', 'settings.language': 'زبان', 'settings.theme': 'پوسته', 'settings.notifications': 'اعلان‌های روزانه', 'settings.text_size': 'اندازه متن',
  'settings.privacy': 'حریم خصوصی', 'settings.about': 'درباره برنامه', 'settings.version': 'نسخه', 'settings.other_apps': 'برنامه‌های دیگر', 'settings.other_apps_soon': 'به‌زودی',
  'theme.light': 'سفید', 'theme.peach': 'هلویی', 'theme.mint': 'نعنایی', 'theme.dusk': 'شفق', 'theme.dark': 'تیره', 'theme.sakura': 'ساکورا',
  'profile.signout': 'خروج', 'profile.signout_confirm': 'خارج می‌شوید؟', 'profile.streak': 'روزهای پیاپی', 'profile.achievements': 'دستاوردها',
  'action.continue': 'ادامه', 'action.back': 'بازگشت', 'action.next': 'بعدی', 'action.search': 'جستجو', 'action.close': 'بستن', 'action.save': 'ذخیره',
  'state.error': 'خطایی رخ داد', 'state.offline': 'بدون اتصال',
  'welcome.next': 'بعدی', 'welcome.skip': 'رد شدن', 'welcome.preparing': 'درس‌های شما آماده می‌شود', 'welcome.ready': 'آماده است!',
  'poem.title': 'گلستان سخن', 'splash.loading': 'در حال بارگذاری'
}

/** Dari (Afghanistan): close to Persian, with its own everyday words. */
export const prs: Partial<Record<UiKey, string>> = {
  ...fa,
  'nav.home': 'صفحه اصلی', 'nav.profile': 'پروفایل', 'home.greeting': 'سلام', 'greet.day': 'روز تان بخیر',
  'start.name': 'نام تان', 'start.about_hint': 'نام و تاریخ تولد تان را بنویسید', 'start.need_online': 'برای ورود انترنت لازم است',
  'settings.theme': 'رنگ‌ها', 'settings.about': 'در باره برنامه', 'state.offline': 'انترنت نیست', 'google.wait': 'لطفاً منتظر باشید',
  'profile.signout_confirm': 'خارج می‌شوید؟', 'email.label': 'ایمیل', 'welcome.preparing': 'درس‌های تان آماده می‌شود'
}
