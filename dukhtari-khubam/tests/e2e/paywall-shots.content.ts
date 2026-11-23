/**
 * What the plans' screen's pictures show, in each of the app's languages: the questions asked and Mahliyo's
 * answers, played back by paywall-shots.spec.ts.
 */
import type { Locale } from '../../src/web/i18n'

export interface ShotText {
  chat: { q: string; text: string; stepsTitle: string; steps: string[]; tipTitle: string; tip: string }
  slides: { q: string; text: string; title: string; about: string; pdfAbout: string; md: string; pdf: string; name: string }
  song: { q: string; text: string; title: string; lyrics: string }
  quiz: { q: string; title: string; intro: string; q2: string; q3: string; e1: string; e2: string; e3: string }
  lawyer: { q: string; text: string; stepsTitle: string; steps: string[]; warnTitle: string; warn: string; summary: string }
  mmt: { q: string; text: string; title: string; items: [string, string[]][]; tipTitle: string; tip: string }
  call: { title: string; text: string }
}

const fa: ShotText = {
  chat: {
    q: 'چرا آسمان آبی است؟',
    text: 'آسمان آبی دیده می‌شود، چون نور خورشید در جو **پراکنده** می‌شود — به این پدیده **پراکندگی ریلی** می‌گویند. 🌍☀️',
    stepsTitle: 'چه اتفاقی می‌افتد', steps: ['نور سفید از همهٔ رنگ‌ها ساخته شده است', 'مولکول‌های هوا موج‌های کوتاه (آبی) را بیشتر پراکنده می‌کنند', 'این نور آبی از هر سو به چشم ما می‌رسد'],
    tipTitle: 'جالب است', tip: 'غروب سرخ است، چون نور راه درازتری می‌پیماید و آبی پراکنده می‌شود.'
  },
  slides: {
    q: 'دربارهٔ رودکی اسلاید و PDF می‌خواهم', text: 'آماده است! ارائهٔ ۸ اسلایدی با سبک «شاهانه» 👑', name: 'رودکی',
    title: 'ابوعبدالله رودکی', about: '۸ اسلاید: زندگی، اشعار، میراث و نتیجه', pdfAbout: 'همین متن برای چاپ',
    md: '# ابوعبدالله رودکی\n## پدر شعر فارسی\n---\n# زندگی\n- زاده در پنجرود\n- شاعر دربار سامانیان', pdf: '# ابوعبدالله رودکی\n\nرودکی — پدر شعر فارسی.'
  },
  song: {
    q: 'یک آهنگ دربارهٔ وطن بساز', text: 'آهنگ شما در حال آماده شدن است 🎶', title: 'وطن من',
    lyrics: '[Verse 1]\nکوهسارانت بلند و رودهایت زلال،\nزیر آسمان تو یافتم من خیال.\n[Chorus]\nوطن، ای وطن، دل من از توست،\nهر صبح و شامم با نام تو خوش.'
  },
  quiz: {
    q: 'مرا در ریاضی امتحان کن', title: 'آزمون کوتاه: کسرها', intro: 'سه پرسش — ببینیم!',
    q2: '۰٫۲۵ با کدام کسر برابر است؟', q3: '۳/۵ از ۲۰ چند است؟', e1: '½ = 2/4، پس 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 : 5 × 3 = 12.'
  },
  lawyer: {
    q: 'اگر کارفرما دو ماه حقوقم را ندهد، چه کنم؟',
    text: 'طبق **قانون کار جمهوری تاجیکستان**، کارفرما موظف است مزد را دست‌کم دو بار در ماه بپردازد.',
    stepsTitle: 'چه باید کرد', steps: ['به کارفرما درخواست کتبی بدهید (رونوشتش را نگه دارید)', 'به بازرسی دولتی کار شکایت کنید', 'در مهلت تعیین‌شده به دادگاه مراجعه کنید'],
    warnTitle: 'مهلت‌ها را از دست ندهید', warn: 'برای اختلاف‌های کاری مهلت‌های معینی هست — با حقوق‌دان مشورت کنید.',
    summary: '**نتیجه:** حق شما محفوظ است — بدهی را با بهره‌اش مطالبه کنید.'
  },
  mmt: {
    q: 'مرا برای آزمون ملی (ММТ) شیمی آماده کن', text: 'بر پایهٔ منابع رسمی و پرسش‌های ۱۰ سال اخیر، این موضوع‌ها **بیشتر** می‌آیند 🎯', title: 'موضوع‌های محتمل',
    items: [['جدول تناوبی عناصر', ['ظرفیت', 'ویژگی گروه‌ها']], ['واکنش‌های اکسایش', ['ضریب‌ها', 'الکترون‌ها']], ['محلول‌ها و غلظت', ['درصد جرمی']]],
    tipTitle: 'برنامه', tip: 'دورهٔ ۴۵ روزه تا ۴۰۰ امتیاز — هر روز ۴۰ دقیقه.'
  },
  call: { title: 'تماس ماه‌لیا', text: 'وقت درس رسید! 📚' }
}

export const SHOT_TEXT: Record<Locale, ShotText> = {
  tg: {
    chat: {
      q: 'Чаро осмон кабуд аст?',
      text: 'Осмон кабуд менамояд, зеро нури офтоб дар атмосфера **пароканда** мешавад — ин ҳодисаро **пароканиши Рэлей** меноманд. 🌍☀️',
      stepsTitle: 'Чӣ рӯй медиҳад', steps: ['Нури сафед аз ҳамаи рангҳо иборат аст', 'Молекулаҳои ҳаво мавҷҳои кӯтоҳро (кабуд) бештар мепароканад', 'Ин нури кабуд аз ҳар тараф ба чашми мо мерасад'],
      tipTitle: 'Ҷолиб', tip: 'Ғуруби офтоб сурх аст, чунки нур роҳи дарозтарро тай мекунад ва кабуд пароканда мешавад.'
    },
    slides: {
      q: 'Дар бораи Рӯдакӣ слайдҳо ва PDF лозим', text: 'Тайёр! Презентатсияи 8 слайдӣ бо услуби «Шоҳона» 👑', name: 'Рӯдакӣ',
      title: 'Абӯабдуллоҳи Рӯдакӣ', about: '8 слайд: ҳаёт, ашъор, мерос ва хулоса', pdfAbout: 'ҳамон матн барои чоп',
      md: '# Абӯабдуллоҳи Рӯдакӣ\n## Падари шеъри форсу тоҷик\n---\n# Ҳаёт\n- Таваллуд дар Панҷрӯд\n- Шоири дарбори Сомониён', pdf: '# Абӯабдуллоҳи Рӯдакӣ\n\nРӯдакӣ — падари шеъри форсу тоҷик.'
    },
    song: {
      q: 'Суруд дар бораи Ватан бисоз', text: 'Суруди шумо омода мешавад 🎶', title: 'Ватани ман',
      lyrics: '[Verse 1]\nКӯҳсорони ту баланд, дарёҳоят зулол,\nЗери осмони ту ман ёфтам хаёл.\n[Chorus]\nВатан, эй Ватан, дили ман аз туст,\nҲар субҳу шомам бо номи ту хуш.'
    },
    quiz: {
      q: 'Маро аз математика санҷед', title: 'Санҷиши хурд: касрҳо', intro: 'Се савол — биёед бубинем!',
      q2: '0,25 ба кадом каср баробар аст?', q3: '3/5 аз 20 чанд аст?', e1: '½ = 2/4, пас 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 : 5 × 3 = 12.'
    },
    lawyer: {
      q: 'Агар корфармо маошро 2 моҳ надиҳад, чӣ кор кунам?',
      text: 'Мувофиқи **Кодекси меҳнати Ҷумҳурии Тоҷикистон**, корфармо вазифадор аст музди меҳнатро на камтар аз ду маротиба дар як моҳ пардохт кунад.',
      stepsTitle: 'Чӣ бояд кард', steps: ['Ба корфармо аризаи хаттӣ диҳед (нусхаашро нигоҳ доред)', 'Ба Нозироти давлатии меҳнат шикоят кунед', 'Дар муддати муқарраршуда ба суд муроҷиат намоед'],
      warnTitle: 'Мӯҳлатҳоро гум накунед', warn: 'Барои баҳсҳои меҳнатӣ мӯҳлатҳои муайян ҳаст — бо ҳуқуқшинос маслиҳат кунед.',
      summary: '**Хулоса:** ҳуқуқи шумо ҳимоя шудааст — қарзро бо фоизаш талаб кунед.'
    },
    mmt: {
      q: 'Барои ММТ аз химия маро омода кун', text: 'Аз рӯи маводи расмӣ ва саволҳои 10 соли охир, ин мавзӯъҳо **бештар** меоянд 🎯', title: 'Мавзӯъҳои эҳтимолӣ',
      items: [['Ҷадвали даврии элементҳо', ['Валентнокӣ', 'Хосиятҳои гурӯҳҳо']], ['Реаксияҳои оксидшавӣ', ['Коэффитсиентҳо', 'Электронҳо']], ['Маҳлулҳо ва консентратсия', ['Ҳиссаи массавӣ']]],
      tipTitle: 'Нақша', tip: 'Курси 45-рӯза то 400 хол — ҳар рӯз 40 дақиқа.'
    },
    call: { title: 'Занги Маҳлиё', text: 'Вақти дарс расид! 📚' }
  },
  ru: {
    chat: {
      q: 'Почему небо голубое?',
      text: 'Небо кажется голубым, потому что солнечный свет **рассеивается** в атмосфере — это явление называют **рэлеевским рассеянием**. 🌍☀️',
      stepsTitle: 'Что происходит', steps: ['Белый свет состоит из всех цветов', 'Молекулы воздуха сильнее рассеивают короткие (синие) волны', 'Этот синий свет доходит до глаз со всех сторон'],
      tipTitle: 'Интересно', tip: 'Закат красный: свет проходит более длинный путь, и синий рассеивается по дороге.'
    },
    slides: {
      q: 'Нужны слайды и PDF про Рудаки', text: 'Готово! Презентация на 8 слайдов в стиле «Царский» 👑', name: 'Рудаки',
      title: 'Абу Абдуллах Рудаки', about: '8 слайдов: жизнь, стихи, наследие и выводы', pdfAbout: 'тот же текст для печати',
      md: '# Абу Абдуллах Рудаки\n## Отец персидско-таджикской поэзии\n---\n# Жизнь\n- Родился в Панджруде\n- Придворный поэт Саманидов', pdf: '# Абу Абдуллах Рудаки\n\nРудаки — отец персидско-таджикской поэзии.'
    },
    song: {
      q: 'Сочини песню о Родине', text: 'Ваша песня уже создаётся 🎶', title: 'Моя Родина',
      lyrics: '[Verse 1]\nГоры твои высоки, реки чисты,\nПод твоим небом сбылись мечты.\n[Chorus]\nРодина, Родина, сердце моё,\nУтро и вечер — всё имя твоё.'
    },
    quiz: {
      q: 'Проверь меня по математике', title: 'Мини-тест: дроби', intro: 'Три вопроса — посмотрим!',
      q2: 'Какой дроби равно 0,25?', q3: 'Сколько будет 3/5 от 20?', e1: '½ = 2/4, значит 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 : 5 × 3 = 12.'
    },
    lawyer: {
      q: 'Работодатель 2 месяца не платит зарплату. Что делать?',
      text: 'По **Трудовому кодексу Республики Таджикистан** работодатель обязан выплачивать зарплату не реже двух раз в месяц.',
      stepsTitle: 'Что делать', steps: ['Подайте работодателю письменное заявление (сохраните копию)', 'Пожалуйтесь в Государственную инспекцию труда', 'Обратитесь в суд в установленный срок'],
      warnTitle: 'Не пропустите сроки', warn: 'Для трудовых споров есть определённые сроки — посоветуйтесь с юристом.',
      summary: '**Итог:** ваши права защищены — требуйте долг с процентами.'
    },
    mmt: {
      q: 'Подготовь меня к НЦТ по химии', text: 'По официальным материалам и вопросам за 10 лет **чаще всего** попадаются эти темы 🎯', title: 'Вероятные темы',
      items: [['Периодическая таблица', ['Валентность', 'Свойства групп']], ['Окислительные реакции', ['Коэффициенты', 'Электроны']], ['Растворы и концентрация', ['Массовая доля']]],
      tipTitle: 'План', tip: 'Курс на 45 дней до 400 баллов — по 40 минут в день.'
    },
    call: { title: 'Звонок Махлиё', text: 'Пора на урок! 📚' }
  },
  en: {
    chat: {
      q: 'Why is the sky blue?',
      text: 'The sky looks blue because sunlight is **scattered** in the atmosphere — this is called **Rayleigh scattering**. 🌍☀️',
      stepsTitle: 'What happens', steps: ['White light is made of all colours', 'Air molecules scatter short (blue) waves the most', 'That blue light reaches our eyes from every direction'],
      tipTitle: 'Fun fact', tip: 'Sunsets are red because light travels a longer path and the blue gets scattered away.'
    },
    slides: {
      q: 'I need slides and a PDF about Rudaki', text: 'Done! An 8-slide presentation in the “Royal” style 👑', name: 'Rudaki',
      title: 'Abu Abdullah Rudaki', about: '8 slides: life, poems, legacy and conclusion', pdfAbout: 'the same text, ready to print',
      md: '# Abu Abdullah Rudaki\n## Father of Persian poetry\n---\n# Life\n- Born in Panjrud\n- Court poet of the Samanids', pdf: '# Abu Abdullah Rudaki\n\nRudaki is the father of Persian poetry.'
    },
    song: {
      q: 'Write a song about my homeland', text: 'Your song is being made 🎶', title: 'My Homeland',
      lyrics: '[Verse 1]\nYour mountains are high, your rivers run clear,\nUnder your sky my dreams felt near.\n[Chorus]\nHomeland, my homeland, my heart is yours,\nMorning and night, your name endures.'
    },
    quiz: {
      q: 'Test me in maths', title: 'Mini quiz: fractions', intro: 'Three questions — let’s see!',
      q2: 'Which fraction equals 0.25?', q3: 'What is 3/5 of 20?', e1: '½ = 2/4, so 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 ÷ 5 × 3 = 12.'
    },
    lawyer: {
      q: 'My employer hasn’t paid me for 2 months. What can I do?',
      text: 'Under the **Labour Code of the Republic of Tajikistan**, an employer must pay wages at least twice a month.',
      stepsTitle: 'What to do', steps: ['Give your employer a written request (keep a copy)', 'File a complaint with the State Labour Inspectorate', 'Go to court within the set time limit'],
      warnTitle: 'Don’t miss the deadlines', warn: 'Labour disputes have fixed time limits — talk to a lawyer.',
      summary: '**In short:** your rights are protected — claim the debt with interest.'
    },
    mmt: {
      q: 'Prepare me for the national chemistry exam', text: 'From the official materials and 10 years of past questions, these topics come up **most** 🎯', title: 'Likely topics',
      items: [['The periodic table', ['Valency', 'Group properties']], ['Oxidation reactions', ['Coefficients', 'Electrons']], ['Solutions and concentration', ['Mass fraction']]],
      tipTitle: 'Plan', tip: 'A 45-day course to 400 points — 40 minutes a day.'
    },
    call: { title: 'Mahliyo is calling', text: 'Time for your lesson! 📚' }
  },
  uz: {
    chat: {
      q: 'Nega osmon koʻk?',
      text: 'Osmon koʻk koʻrinadi, chunki quyosh nuri atmosferada **sochiladi** — bu hodisa **Reley sochilishi** deyiladi. 🌍☀️',
      stepsTitle: 'Nima sodir boʻladi', steps: ['Oq nur barcha ranglardan iborat', 'Havo molekulalari qisqa (koʻk) toʻlqinlarni koʻproq sochadi', 'Bu koʻk nur har tomondan koʻzimizga yetib keladi'],
      tipTitle: 'Qiziq', tip: 'Quyosh botishi qizil, chunki nur uzunroq yoʻl bosadi va koʻki sochilib ketadi.'
    },
    slides: {
      q: 'Rudakiy haqida slaydlar va PDF kerak', text: 'Tayyor! «Shohona» uslubida 8 slaydli taqdimot 👑', name: 'Rudakiy',
      title: 'Abu Abdulloh Rudakiy', about: '8 slayd: hayoti, sheʼrlari, merosi va xulosa', pdfAbout: 'chop etish uchun xuddi shu matn',
      md: '# Abu Abdulloh Rudakiy\n## Fors-tojik sheʼriyatining otasi\n---\n# Hayoti\n- Panjrudda tugʻilgan\n- Somoniylar saroy shoiri', pdf: '# Abu Abdulloh Rudakiy\n\nRudakiy — fors-tojik sheʼriyatining otasi.'
    },
    song: {
      q: 'Vatan haqida qoʻshiq yarat', text: 'Qoʻshigʻingiz tayyorlanmoqda 🎶', title: 'Mening Vatanim',
      lyrics: '[Verse 1]\nTogʻlaring baland, daryolaring zilol,\nOsmoning ostida topdim men xayol.\n[Chorus]\nVatan, ey Vatan, yuragim seniki,\nTongu shomim — barchasi seniki.'
    },
    quiz: {
      q: 'Meni matematikadan tekshir', title: 'Kichik test: kasrlar', intro: 'Uchta savol — koʻraylik!',
      q2: '0,25 qaysi kasrga teng?', q3: '20 ning 3/5 qismi nechaga teng?', e1: '½ = 2/4, demak 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 : 5 × 3 = 12.'
    },
    lawyer: {
      q: 'Ish beruvchi 2 oydan beri maosh bermayapti. Nima qilay?',
      text: '**Tojikiston Respublikasi Mehnat kodeksi**ga koʻra, ish beruvchi maoshni oyiga kamida ikki marta toʻlashi shart.',
      stepsTitle: 'Nima qilish kerak', steps: ['Ish beruvchiga yozma ariza bering (nusxasini saqlang)', 'Davlat mehnat inspeksiyasiga shikoyat qiling', 'Belgilangan muddatda sudga murojaat qiling'],
      warnTitle: 'Muddatlarni oʻtkazib yubormang', warn: 'Mehnat nizolari uchun aniq muddatlar bor — huquqshunos bilan maslahatlashing.',
      summary: '**Xulosa:** huquqingiz himoyalangan — qarzni foizi bilan talab qiling.'
    },
    mmt: {
      q: 'Meni kimyodan milliy testga tayyorla', text: 'Rasmiy materiallar va soʻnggi 10 yil savollariga koʻra, bu mavzular **koʻproq** tushadi 🎯', title: 'Ehtimoliy mavzular',
      items: [['Davriy jadval', ['Valentlik', 'Guruhlar xossalari']], ['Oksidlanish reaksiyalari', ['Koeffitsiyentlar', 'Elektronlar']], ['Eritmalar va konsentratsiya', ['Massa ulushi']]],
      tipTitle: 'Reja', tip: '400 ballgacha 45 kunlik kurs — har kuni 40 daqiqa.'
    },
    call: { title: 'Mahliyo qoʻngʻirogʻi', text: 'Dars vaqti keldi! 📚' }
  },
  tr: {
    chat: {
      q: 'Gökyüzü neden mavi?',
      text: 'Gökyüzü mavi görünür, çünkü güneş ışığı atmosferde **saçılır** — bu olaya **Rayleigh saçılması** denir. 🌍☀️',
      stepsTitle: 'Ne oluyor', steps: ['Beyaz ışık bütün renklerden oluşur', 'Hava molekülleri kısa (mavi) dalgaları daha çok saçar', 'Bu mavi ışık her yönden gözümüze ulaşır'],
      tipTitle: 'İlginç', tip: 'Gün batımı kırmızıdır, çünkü ışık daha uzun yol alır ve mavi saçılıp gider.'
    },
    slides: {
      q: 'Rudaki hakkında slayt ve PDF lazım', text: 'Hazır! “Kraliyet” stilinde 8 slaytlık sunum 👑', name: 'Rudaki',
      title: 'Ebu Abdullah Rudaki', about: '8 slayt: hayatı, şiirleri, mirası ve sonuç', pdfAbout: 'yazdırmak için aynı metin',
      md: '# Ebu Abdullah Rudaki\n## Fars şiirinin babası\n---\n# Hayatı\n- Pencrud’da doğdu\n- Samanoğulları’nın saray şairi', pdf: '# Ebu Abdullah Rudaki\n\nRudaki, Fars şiirinin babasıdır.'
    },
    song: {
      q: 'Vatan hakkında bir şarkı yap', text: 'Şarkınız hazırlanıyor 🎶', title: 'Vatanım',
      lyrics: '[Verse 1]\nDağların yüce, ırmakların duru,\nGöğünün altında buldum umudu.\n[Chorus]\nVatan, ey vatan, gönlüm seninle,\nSabah akşam hep adınla.'
    },
    quiz: {
      q: 'Beni matematikten sına', title: 'Mini test: kesirler', intro: 'Üç soru — bakalım!',
      q2: '0,25 hangi kesre eşittir?', q3: '20’nin 3/5’i kaçtır?', e1: '½ = 2/4, yani 2/4 + 1/4 = 3/4.', e2: '25/100 = 1/4.', e3: '20 : 5 × 3 = 12.'
    },
    lawyer: {
      q: 'İşverenim 2 aydır maaş ödemiyor. Ne yapmalıyım?',
      text: '**Tacikistan Cumhuriyeti İş Kanunu**’na göre işveren ücreti ayda en az iki kez ödemek zorundadır.',
      stepsTitle: 'Ne yapmalı', steps: ['İşverene yazılı dilekçe verin (bir kopyasını saklayın)', 'Devlet İş Müfettişliği’ne şikâyette bulunun', 'Belirlenen süre içinde mahkemeye başvurun'],
      warnTitle: 'Süreleri kaçırmayın', warn: 'İş uyuşmazlıklarının belirli süreleri var — bir hukukçuya danışın.',
      summary: '**Sonuç:** haklarınız korunuyor — alacağınızı faiziyle isteyin.'
    },
    mmt: {
      q: 'Beni ulusal sınava kimyadan hazırla', text: 'Resmî kaynaklara ve son 10 yılın sorularına göre bu konular **en çok** çıkıyor 🎯', title: 'Olası konular',
      items: [['Periyodik tablo', ['Değerlik', 'Grup özellikleri']], ['Yükseltgenme tepkimeleri', ['Katsayılar', 'Elektronlar']], ['Çözeltiler ve derişim', ['Kütlece yüzde']]],
      tipTitle: 'Plan', tip: '400 puana 45 günlük kurs — her gün 40 dakika.'
    },
    call: { title: 'Mahliyo arıyor', text: 'Ders zamanı! 📚' }
  },
  fa,
  prs: { ...fa, call: { title: 'زنگ ماه‌لیا', text: 'وقت درس رسید! 📚' }, quiz: { ...fa.quiz, q: 'مرا در ریاضی امتحان کنید' } }
}
