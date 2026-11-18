# ДУХТАРИ ХУБАМ
# MASTER PRODUCT & ENGINEERING PROMPT — VERSION 2.0
## Ягона спецификатсияи мукаммал: SRS + Visual Design + CMS + Full Text Editor + Manual Quiz Builder + Production Engineering

**Мақсад:** сохтани платформаи воқеии таълимии «Духтари хубам», на макети намоишӣ ё прототипи бе Backend.  
**Платформаҳо:** Android Native (Kotlin + Jetpack Compose), Web, Admin Panel.  
**Backend:** Django + Django REST Framework + PostgreSQL (ё интихоби беҳтари асоснокшуда, агар repository аллакай меъмории мувофиқ дошта бошад).  
**Забонҳои ибтидоӣ:** тоҷикӣ, русӣ, арабӣ.  
**Ҳуҷҷат:** Master Prompt v2.0.  
**Ҳолат:** талаботи асосии иҷро ва қабули маҳсулот.

---

# 0. ДАСТУРИ АСОСӢ БА AI AGENT

Ту ҳамчун як дастаи пурраи муҳандисӣ амал мекунӣ: Product Architect, UX/UI Designer, Backend Engineer, Android Kotlin Engineer, Web Engineer, CMS Engineer, Database Architect, QA Engineer, Security Engineer ва DevOps Engineer.

Вазифа сохтани маҳсулоти воқеӣ, пурра коркунанда, васеъшаванда, амн ва барои Production омода мебошад. Ин супоришро ҳамчун як прототипи муваққатӣ, landing page ё чанд screenshot қабул накун.

**Қоидаи муҳим:** се расми визуалӣ, ки соҳиби маҳсулот пешниҳод мекунад, танҳо Reference Design мебошанд. Онҳо бояд забони визуалиро муайян кунанд, аммо худи маҳсулот бояд пурра интерактивӣ ва бо маълумоти воқеии Backend сохта шавад. Ҳама экранҳои иловагӣ низ бояд ба ҳамон Design System пайравӣ кунанд.

## 0.1. Меъёри асосии муваффақият

Соҳиби маҳсулот барномасоз нест. Ӯ бояд тавонад бе навиштани код аз Admin Panel:
- ҳафт мактабро идора кунад;
- курс, модул, мавзӯъ ва дарс созад;
- матн, расм, видео ва аудиоро дар ҳар тартиб ҷойгир кунад;
- блокҳои матниро ранг, услуб ва формат диҳад;
- тест ва ҳар саволи онро дастӣ созад;
- ҷавобҳои дуруст, хол ва шарҳро худаш муайян кунад;
- Daily Inspiration, иқтибос ва огоҳиҳоро ворид ва ҷадвалбандӣ кунад;
- тарҷумаҳо ва нашрро идора кунад;
- натиҷаро дар Preview бинад ва Publish кунад.

Ҳамаи мундариҷаи нашршуда бояд ба Android ва Web аз як Backend ва як Database расад. Тағйири мундариҷа набояд талаб кунад, ки APK/AAB аз нав ҷамъ карда шавад.

## 0.2. «Пурра идорашаванда» чӣ маъно дорад

Ҳамаи маълумот ва мундариҷаи таълимӣ, расонаҳо, сохтори курсҳо, тестҳо, тарҷумаҳо, матнҳои UI-и идорашаванда, Daily Inspiration, баннерҳо ва саҳифаҳои CMS бояд аз Admin Panel тағйир дода шаванд. Барои тағйири мундариҷаи оддӣ тағйири код талаб нашавад.

Функсияҳои нав, тағйири меъморӣ ё навсозии мантиқи худи барнома метавонанд кори муҳандисӣ талаб кунанд. Ин маҳдудиятро пинҳон накун.

## 0.3. Қоидаи мундариҷаи инсонӣ

AI набояд худсарона матни таълимӣ, ҳукми динӣ, маълумоти тиббӣ/ҳуқуқӣ/таърихӣ, иқтибоси ба шахс нисбатдодашуда, саволи тестӣ, ҷавоби дуруст ё шарҳи ҷавобро тавлид карда, ҳамчун мундариҷаи тайёр ба система ворид кунад.

**Ҳамаи маводи омӯзишӣ ва ҳамаи саволҳои тестиро соҳиби маҳсулот ё муаллифи ваколатдор дастӣ ворид мекунад.** Агент танҳо муҳаррир, база, интерфейс, workflow, санҷиш ва механизми намоишро месозад.

## 0.4. Ду маънои «тест»-ро ҷудо нигоҳ дор

1. **Тестҳои таълимӣ / Quiz:** саволҳо ва ҷавобҳое, ки хонанда дар барнома мегузаронад. Онҳоро одамон аз Admin Panel дастӣ месозанд.
2. **Software QA Tests:** unit, integration, API, UI ва end-to-end tests, ки муҳандисон барои санҷиши дурустии код месозанд. Инҳо вазифаи AI Agent мебошанд.

Ҳеҷ гоҳ ин ду навъи тестро омехта накун.

## 0.5. Тартиби бартарии талабот

Ҳангоми ихтилофи ҷузъиёти такрорӣ:
1. Ин Master Prompt v2.0 ҳуҷҷати ягонаи роҳбарикунанда мебошад.
2. Қисми Visual Specification дар поён барои Reference Images, матни кӯтоҳи UI, Real 3D Glass ва Full Text Editor талаботи мушаххастар медиҳад.
3. Қисми SRS талаботи умумии меъморӣ, CMS, амният, санҷиш ва Production-ро муайян мекунад.
4. Қарорҳои техникии мавҷудаи repository танҳо вақте нигоҳ дошта шаванд, ки бо талабот мувофиқ, бехатар ва ҳуҷҷатшуда бошанд.

Агар ягон талабот иҷронашаванда бошад, онро пинҳонӣ пастсифат накун. Маҳдудият, таъсир ва роҳи алтернативиро сабт кун.

---

# ҚИСМИ I — SRS: ТАЛАБОТИ МАҲСУЛОТ ВА МЕЪМОРӢ

# ДУХТАРИ ХУБАМ

# APPENDIX A — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Версияи мукаммали талаботи маҳсулот, меъморӣ, UX/UI, CMS ва татбиқи Production

**Ҳуҷҷат:** Software Requirements Specification\
**Маҳсулот:** Духтари хубам (Dukhtari Khubam)\
**Версия:** 1.0\
**Статус:** Базаи расмии талабот барои таҳия\
**Платформаҳо:** Android (Native Kotlin), Web, Admin Panel\
**Забонҳои ибтидоӣ:** Тоҷикӣ, русӣ, арабӣ\
**Принсипи асосӣ:** як Backend, як базаи марказӣ, як CMS ва чанд
интерфейси муштарӣ.

------------------------------------------------------------------------

# 1. Муқаддима

## 1.1. Мақсади ҳуҷҷат

Ин ҳуҷҷат талаботи пурраи функсионалӣ ва ғайрифунксионалии платформаи
«Духтари хубам»-ро муайян мекунад. Он бояд ҳамчун манбаи асосии қарорҳо
барои Product Design, UX/UI, Backend, Android, Web, CMS, QA, Security ва
DevOps истифода шавад.

Ин ҳуҷҷат танҳо тавсифи идея ё прототип нест. Ҳадаф сохтани маҳсулоти
воқеӣ, васеъшаванда, амн, санҷидашуда ва барои истифодаи Production
омода мебошад.

Ҳар талабот бояд: - ID-и беназир дошта бошад; - натиҷаи санҷидашаванда
дошта бошад; - дар коди воқеӣ татбиқ шавад; - бо меъёри қабули муайян
тасдиқ гардад.

## 1.2. Мақсади маҳсулот

«Духтари хубам» платформаи таълимӣ мебошад, ки ба корбарон имкони
омӯзиши мустақилона тавассути ҳафт мактаби таълимӣ медиҳад. Мундариҷаро
соҳиби маҳсулот ва муаллифони ваколатдор ворид мекунанд.

Платформа бояд ҳамзамон: - таҷрибаи зебо ва осони омӯзиш пешниҳод
кунад; - мундариҷаи матнӣ, тасвирӣ, видеоӣ ва аудиоиро дастгирӣ кунад; -
омӯзишро дар Android ва Web таъмин намояд; - аз Admin Panel пурра идора
шавад; - бе тағйири код мундариҷаи нав қабул кунад; - барои васеъшавии
забонӣ ва кишварҳои дигар омода бошад.

## 1.3. Қоидаи қатъӣ оид ба мундариҷаи таълимӣ

AI ё система набояд худсарона матни дарсӣ, ҳукми динӣ, маълумоти тиббӣ,
таърихӣ, ҳуқуқӣ ё иқтибоси мансуб ба шахси воқеиро ихтироъ кунад.

Мундариҷаи таълимиро соҳиби маҳсулот, муаллифон ва мутахассисони
тасдиқкунанда ворид мекунанд.

Система вазифадор аст инфрасохтори эҷод, таҳрир, тарҷума, санҷиш,
тасдиқ, нашр ва бойгонии мундариҷаро таъмин кунад.

## 1.4. Истилоҳот

  -----------------------------------------------------------------------
  Истилоҳ                             Маъно
  ----------------------------------- -----------------------------------
  School                              Яке аз ҳафт мактаби таълимӣ

  Course                              Курси мустақил дар дохили мактаб

  Module                              Қисми сохтории курс

  Topic                               Мавзӯи дохили модул

  Lesson                              Дарси мушаххас

  Content Block                       Қисми мустақили мундариҷаи дарс

  CMS                                 Системаи идоракунии мундариҷа

  Admin Panel                         Панели идоракунии маҳсулот

  Asset                               Расм, видео, аудио, файл ё модели
                                      3D

  Liquid Glass                        Маводи визуалии шишагӣ бо рефраксия
                                      ва хусусиятҳои оптикӣ

  Production                          Муҳити воқеии истифодабарӣ
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Доираи маҳсулот

## 2.1. Платформаҳои дохилшаванда

1.  Барномаи Android бо Kotlin ва Jetpack Compose.
2.  Вебсайти истифодабарандагон.
3.  Admin Panel барои идоракунии мундариҷа ва система.
4.  Backend API.
5.  PostgreSQL Database.
6.  Media Storage ва CDN.
7.  Системаи мониторинг, логҳо ва нусхаҳои эҳтиётӣ.

## 2.2. Ҳафт мактаби таълимӣ

1.  Маърифати динӣ.
2.  Одоб ва ахлоқ.
3.  Фарҳанги тоҷик.
4.  Оила ва муносибатҳо.
5.  Илм ва саломатӣ.
6.  Рушди шахсият.
7.  Зиндагии муосир.

Ҳар мактаб бояд мустақилона фаъолият кунад. Корбар метавонад ба ҳар
мактаб ворид шавад, бе он ки курсҳои мактабҳои дигарро хатман анҷом дода
бошад.

## 2.3. Чизҳое, ки ба версияи аввал дохил намешаванд

Ин хусусиятҳо метавонанд дар марҳилаҳои баъдӣ илова шаванд: - шабакаи
иҷтимоии пурра; - паёмрасонии мустақими байни корбарон; -
видеоконфронс; - бозори муаллифон; - AI-тьютори таълимӣ; - пардохтҳои
байналмилалӣ, то интихоби провайдер; - системаи сертификатсияи расмӣ.

Меъморӣ бояд имкони васеъ кардани маҳсулотро нигоҳ дорад, аммо
хусусиятҳои оянда набояд ҳамчун кори анҷомёфта вонамуд карда шаванд.

------------------------------------------------------------------------

# 3. Гурӯҳҳои истифодабарандагон ва иҷозатҳо

## 3.1. Намудҳои корбарон

-   Меҳмон.
-   Корбари сабтиномшуда.
-   Корбари дорои дастрасии Premium.
-   Муаллиф.
-   Муҳаррир.
-   Мутахассиси санҷанда.
-   Мудири мундариҷа.
-   Мудири расонаҳо.
-   Super Admin.

## 3.2. RBAC

Система бояд Role-Based Access Control дошта бошад.

  Нақш               Иҷозатҳои асосӣ
  ------------------ ---------------------------------------
  Super Admin        Идоракунии пурраи система ва иҷозатҳо
  Content Admin      Идоракунии мактабҳо, курсҳо ва дарсҳо
  Author             Эҷод ва таҳрири мундариҷаи худ
  Editor             Таҳрир ва омода кардани мундариҷа
  Reviewer           Санҷиш ва тасдиқи мундариҷа
  Media Manager      Идоракунии файлҳо ва Asset Library
  Analytics Viewer   Танҳо дидани омор
  User               Омӯзиш ва идоракунии профили худ

Иҷозатҳо бояд дар Backend санҷида шаванд. Пинҳон кардани тугма дар
Frontend муҳофизати кофӣ нест.

## 3.3. Ҳимояи корбарони ноболиғ

Азбаски аудитория метавонад ноболиғонро дар бар гирад: - маълумоти шахсӣ
бояд ҳадди ақал ҷамъоварӣ шавад; - махфият ва амният аз аввал ба назар
гирифта шавад; - хусусиятҳои иҷтимоӣ, агар илова шаванд, бояд moderation
ва safeguarding дошта бошанд; - синну сол ва ризоияти зарурӣ бояд
мутобиқи қонунгузории татбиқшаванда баррасӣ шаванд; - ҳеҷ гуна механикаи
шармандасозӣ ё фишори иҷтимоӣ истифода нашавад.

------------------------------------------------------------------------

# 4. Меъмории техникӣ

## 4.1. Меъмории умумӣ

Android ва Web бояд аз як Backend API ва як манбаи ягонаи маълумот
истифода баранд.

``` text
                 ADMIN PANEL
                      |
                      v
             BACKEND API / CMS
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
   PostgreSQL     Media Storage   Redis/Jobs
        |             |             |
        +-------------+-------------+
                      |
                 API / CDN
                 /       \
                v         v
          ANDROID APP   WEB APP
          Kotlin        Next.js
```

## 4.2. Технологияҳои тавсияшаванда

### Backend

-   Python.
-   Django.
-   Django REST Framework.
-   PostgreSQL.
-   Redis танҳо дар ҷойҳое, ки воқеан зарур аст.
-   Celery ё механизми монанди он барои вазифаҳои заминавӣ.
-   S3-compatible object storage барои файлҳо.
-   OpenAPI/Swagger барои ҳуҷҷатгузории API.

### Android

-   Kotlin.
-   Jetpack Compose.
-   MVVM ё Clean Architecture-и оқилона.
-   Kotlin Coroutines.
-   Retrofit ё Ktor.
-   Room барои cache/offline data.
-   DataStore барои танзимот.
-   Android Media3 барои аудио ва видео.

Барномаи Android бояд Native бошад. WebView ҳамчун ивазкунандаи барномаи
Native қабул намешавад.

### Web

-   Next.js.
-   TypeScript.
-   Компонентҳои reusable.
-   Responsive design.
-   SSR/SSG мувофиқи намуди саҳифа.
-   API integration.
-   Дастгирии RTL барои арабӣ.

### Infrastructure

-   Docker барои муҳити такроршавандаи development ва deployment.
-   CI/CD.
-   HTTPS.
-   CDN.
-   Мониторинг ва логҳо.
-   Backup ва restore.

## 4.3. Қоидаҳои меъморӣ

-   Android ва Web мундариҷаро hardcode намекунанд.
-   Ҳамаи мундариҷаи омӯзишӣ аз API гирифта мешавад.
-   Admin Panel низ аз API истифода мебарад.
-   API бояд versioning дошта бошад.
-   Database migration бояд идорашаванда бошад.
-   Система бояд аз муҳити Development ба Staging ва Production ҷудо
    бошад.
-   Сирҳо ва паролҳо дар repository нигоҳ дошта намешаванд.

------------------------------------------------------------------------

# 5. Системаи пурраи CMS ва Admin Panel

## 5.1. Талаботи асосӣ

**FR-CMS-001:** Соҳиби маҳсулот бояд тавонад тамоми мундариҷаи омӯзиширо
бе тағйири коди барнома идора кунад.

**FR-CMS-002:** Эҷод, таҳрир, нашр, бекор кардани нашр ва бойгонии
мундариҷа бояд аз Admin Panel иҷро шавад.

**FR-CMS-003:** Тағйири мундариҷа бояд баъд аз нашр дар Android ва Web
тавассути API дастрас шавад, бе он ки APK/AAB аз нав сохта шавад.

**FR-CMS-004:** Система бояд пеш аз нашр Preview-и воқеии мундариҷаро
нишон диҳад.

## 5.2. Dashboard

Dashboard бояд нишон диҳад: - шумораи мактабҳо; - шумораи курсҳо; -
модулҳо ва дарсҳо; - видеоҳо ва аудиоҳо; - файлҳои медиавӣ; - Draft; -
Pending Review; - Published; - Scheduled; - фаъолияти охирин; - омори
корбарон; - ҳаҷми Storage; - хатогиҳои муҳими система.

Омор бояд аз маълумоти воқеӣ гирифта шавад, на аз рақамҳои сохта.

## 5.3. Идоракунии мактабҳо

**FR-SCHOOL-001:** Эҷоди мактаби нав.

**FR-SCHOOL-002:** Тағйири ном, тавсиф ва тартиби намоиш.

**FR-SCHOOL-003:** Иваз кардани иконка, Hero Image ва ранги мавзӯӣ.

**FR-SCHOOL-004:** Идоракунии забонҳои мактаб.

**FR-SCHOOL-005:** Publish/Unpublish/Archive.

**FR-SCHOOL-006:** Пайваст кардани курсҳо ба мактаб.

## 5.4. Идоракунии курсҳо

Admin бояд тавонад: - курс эҷод кунад; - номи курсро тағйир диҳад; -
тавсиф ва ҳадафҳоро ворид кунад; - тасвир ва 3D Asset илова кунад; -
сатҳи омӯзишро муайян кунад; - prerequisite гузорад; - давомнокии
тахминиро сабт кунад; - тартиби курсро тағйир диҳад; - дастрасии
Free/Premium-ро таъин кунад; - курсро нашр ё бойгонӣ кунад.

## 5.5. Идоракунии модул ва мавзӯъ

Ҳар курс бояд дорои сохтори чандсатҳа бошад:

``` text
Мактаб
  └── Курс
       └── Модул
            └── Мавзӯъ
                 └── Дарс
                      └── Content Blocks
```

Система бояд тартиби ҳар сатҳро бо drag-and-drop тағйир дода тавонад.

Ҳар сатҳ бояд ID-и устувор дошта бошад, то пайвандҳо ва пешрафти корбар
вайрон нашаванд.

## 5.6. Муҳаррири блокии дарс

Ин яке аз вазифаҳои муҳимтарини система мебошад.

Дарс набояд танҳо як майдони калони Text бошад.

Муҳаррир бояд блокҳои зеринро дастгирӣ кунад:

1.  Heading.
2.  Subheading.
3.  Paragraph.
4.  Rich Text.
5.  Ordered List.
6.  Bullet List.
7.  Image.
8.  Image Gallery.
9.  Video.
10. Audio.
11. Quote.
12. Important Note.
13. Warning.
14. Information Box.
15. Table.
16. Source/Reference.
17. Downloadable File.
18. Practical Task.
19. Quiz.
20. Related Lesson.
21. Divider.
22. Custom Illustration.
23. Full-width Media.
24. Side-by-side Text and Image.

Ҳар блок бояд: - илова шавад; - таҳрир шавад; - нусха бардошта шавад; -
ҳазф шавад; - ҷойиваз шавад; - Preview дошта бошад; - дар ҳолати зарурӣ
тарҷума шавад.

### Намунаи сохтори як дарс

``` text
Сарлавҳа
Муқаддима
Расм
Матни шарҳдиҳанда
Блоки муҳим
Галереяи тасвирҳо
Видео
Матни иловагӣ
Аудио
Супориши амалӣ
Манбаъҳо
```

Система бояд ин тартибро дар Android ва Web бо як renderer-и мувофиқ
намоиш диҳад.

## 5.7. Rich Text ва бехатарӣ

-   HTML-и иҷрошаванда қабул нашавад.
-   JavaScript-и воридшуда иҷро нашавад.
-   Rich Text sanitize карда шавад.
-   URL ва файлҳо санҷида шаванд.
-   Маҳдудияти андоза ва навъи файлҳо татбиқ шавад.
-   Content Block schema version дошта бошад, то тағйироти оянда ба
    мундариҷаи пешина зарар нарасонад.

## 5.8. Идоракунии видео

Admin бояд тавонад: - видео бор кунад; - видеои мавҷударо иваз кунад; -
ном ва тавсифро таҳрир кунад; - thumbnail бор кунад; - subtitle ворид
кунад; - забони видеоро муайян кунад; - видеоро ба як ё чанд дарс
пайваст кунад; - видеоро Preview кунад; - видеоро unpublished ё archive
кунад.

Видео бояд тавассути object storage ва CDN пешниҳод шавад.

Барои видеоҳои дароз adaptive streaming, масалан HLS, баррасӣ ва татбиқ
шавад.

Файлҳои видеоӣ набояд ба PostgreSQL ҳамчун binary нигоҳ дошта шаванд.

## 5.9. Идоракунии аудио

Дастгирӣ: - Upload; - Replace; - Title; - Description; - Language; -
Thumbnail; - Transcript; - Duration; - Lesson association; - Preview; -
Publish/Unpublish.

## 5.10. Media Library

Media Library бояд дорои: - ҷустуҷӯ; - филтр аз рӯйи навъи файл; -
категория ва папка; - Preview; - андоза ва формат; - alt text; - санаи
боркунӣ; - uploader; - истифода дар кадом дарсҳо; - ивазкунӣ; - ҳазфи
бехатар; - optimized variants.

Агар Asset дар дарси нашршуда истифода шавад, пеш аз ҳазф система бояд
огоҳӣ диҳад.

## 5.11. Daily Inspiration ва Quote of the Day

Admin бояд тавонад: - матн ворид кунад; - манбаъ ва муаллифро муайян
кунад; - расм пайваст кунад; - забонро интихоб кунад; - сана ва вақти
нашрро таъин кунад; - Schedule кунад; - Publish/Unpublish кунад; - ҷойи
намоишро интихоб кунад.

Система набояд иқтибоси бе манбаъро ба шахси машҳур нисбат диҳад.

## 5.12. Quiz Management

-   эҷоди Quiz;
-   саволҳои гуногун;
-   вариантҳои ҷавоб;
-   ҷавоби дуруст;
-   шарҳи ҷавоб;
-   тасвир дар савол;
-   тартиби савол;
-   маҳдудияти кӯшиш;
-   меъёри гузариш;
-   натиҷа ва таърихи кӯшиш.

------------------------------------------------------------------------

# 6. Workflow-и нашри мундариҷа

Ҳолатҳои мундариҷа:

1.  Draft.
2.  In Review.
3.  Changes Requested.
4.  Approved.
5.  Scheduled.
6.  Published.
7.  Archived.

Workflow:

``` text
Author creates content
        |
        v
      Draft
        |
        v
    In Review
        |
   +----+-----+
   |          |
   v          v
Approved   Changes Requested
   |          |
   v          v
Scheduled   Author edits
   |
   v
Published
   |
   v
Archived (when required)
```

Ҳар тағйироти муҳим бояд Revision History дошта бошад.

Admin бояд тавонад: - версияҳои пешинаро бинад; - фарқиятро муқоиса
кунад; - версияи пешинаро барқарор кунад; - муаллиф ва вақти тағйирро
бинад.

------------------------------------------------------------------------

# 7. Талаботи визуалӣ ва Design System

## 7.1. Самти умумӣ

Ҳувияти расмии визуалӣ:

**ARTISTIC FEMININE + ULTRA MINIMALISM + PREMIUM REAL 3D OBJECTS +
PHYSICALLY BASED LIQUID GLASS**

Ин интерфейс набояд ба шаблони умумии барномаи таълимӣ монанд бошад.

Хусусиятҳо: - минимализми воқеӣ; - фазои холии кофӣ; - композицияҳои
асимметрӣ; - кортҳои камшумор ва мақсаднок; - иллюстрацияҳои ҳаҷмнок; -
рангҳои пастелӣ; - маводи шишагии физикӣ; - иконкаҳои махсус; -
ҳаракатҳои нарм.

## 7.2. Палитраи Light Mode

  Token              HEX
  ------------------ -----------
  Background         `#FBF9FD`
  Surface            `#FFFFFF`
  Lavender Surface   `#EEE7F6`
  Lilac              `#DCCCEB`
  Primary            `#A78BCB`
  Deep Plum          `#59446E`
  Dusty Rose         `#EBDCE4`
  Champagne          `#E8D7B9`
  Soft Sage          `#DDE9DF`

## 7.3. Палитраи Dark Mode

  Token              HEX
  ------------------ -----------
  Background         `#17131E`
  Surface            `#211B2A`
  Elevated Surface   `#30263B`
  Primary            `#B7A0D3`
  Lilac              `#D8C8EA`
  Text               `#F4EFF8`
  Dusty Rose         `#B78FA4`
  Champagne          `#CBB58F`

Рангҳо бояд Design Tokens бошанд, на арзишҳои парокандаи hardcoded.

## 7.4. Typography

Шрифтҳои пешниҳодшуда: - Manrope барои интерфейс; - Lora барои
сарлавҳаҳои интихобшуда; - Noto Naskh Arabic барои матни арабӣ.

Пеш аз қабул, glyph coverage-и ҳарфҳои тоҷикӣ ҳатман санҷида шавад:

`ӣ, қ, ғ, ҳ, ҷ, ӯ`

Сатҳҳои андоза: - Hero: 28--34sp; - Page Heading: 24--28sp; - Section
Heading: 18--22sp; - Card Heading: 16--18sp; - Body: 15--17sp; -
Secondary: 12--14sp.

Шрифтҳои дастӣ танҳо барои акцентҳои кӯтоҳ истифода шаванд.

## 7.5. Layout

Spacing: `4, 8, 12, 16, 24, 32, 40`

Radius: - Small: 12dp; - Standard Card: 20dp; - Hero: 28dp; - Floating
Dock: 28--36dp.

Қоида: - ҳар экран як нуқтаи диққати асосӣ дошта бошад; - кортҳо танҳо
дар ҳолати зарурат истифода шаванд; - аз grid-и якхела дар ҳамаи экранҳо
худдорӣ шавад; - матн ва амалҳои асосӣ аз ороиш муҳимтаранд.

------------------------------------------------------------------------

# 8. Талаботи махсус: REAL 3D LIQUID GLASS

## 8.1. Таърифи маҳсулот

Liquid Glass дар ин лоиҳа маънои `backdrop-filter: blur()` ё шаффофияти
оддии CSS-ро надорад.

Мақсад сохтани намуди маводи воқеии шиша ё кристалл аст, ки хусусиятҳои
оптикии зеринро нишон диҳад: - refraction; - Fresnel reflection; -
specular highlights; - optical distortion; - thickness/depth; - edge
highlights; - internal reflections; - subtle dispersion; - surface
imperfections; - realistic shadowing.

**CSS Blur танҳо fallback ё эффекти ёрирасон буда метавонад. Он иҷрои
талаботи Real 3D Glass ҳисобида намешавад.**

## 8.2. Тафовути CSS Blur ва Real 3D Glass

  Хусусият                         CSS Blur                Real 3D Glass
  -------------------------------- ----------------------- -----------------------
  Blur-и пасзамина                 Ҳа                      Метавонад дошта бошад
  Шикасти нур                      Не, на ба таври воқеӣ   Ҳа
  Деформатсияи тасвири паси шиша   Не                      Ҳа
  Ғафсии физикӣ                    Не                      Ҳа
  Fresnel reflection               Не                      Ҳа
  Геометрияи канор                 Одатан не               Ҳа
  Шикасти дохилии нур              Не                      Ҳа
  Модели маводи физикӣ             Не                      Ҳа
  Сояи вобаста ба геометрия        Маҳдуд                  Ҳа

## 8.3. Модели физикии мавод

Барои шишаи визуалӣ аз принсипҳои Physically Based Rendering истифода
шавад.

Параметрҳои санҷишӣ барои шишаи шаффофи умумӣ: - Index of Refraction
(IOR): тақрибан 1.45--1.52, вобаста ба маводи интихобшуда; - Roughness:
паст, вале на ҳатман сифр; - Transmission: баланд; - Thickness: мувофиқи
геометрияи объект; - Normal: сатҳи воқеии геометрӣ ё normal map-и
босифат; - Fresnel: вобаста ба кунҷи дидан; - Reflection: аз муҳити
воқеӣ ё HDR environment.

Инҳо параметрҳои ибтидоии art direction мебошанд, на арзишҳои ҳатмии
ҳамаи объектҳо.

## 8.4. Real Refraction

Шиша бояд тасвири паси худро вобаста ба ғафсӣ, кунҷ ва шакли сатҳ
деформатсия кунад.

Талабот: - объектҳои паси шиша бояд ба таври визуалӣ шикаста шаванд; -
канорҳои ғафс refraction-и бештар нишон диҳанд; - сатҳи каҷ деформатсияи
мутобиқ дошта бошад; - ҳаракати пасзамина набояд бо шиша ҳамчун як
қабати blur омехта шавад.

## 8.5. Fresnel ва Reflection

Инъикос бояд вобаста ба кунҷи дидан тағйир ёбад.

Дар канорҳои шиша инъикос метавонад бештар намоён бошад.

Истифодаи HDRI ё муҳити равшании мувофиқ барои инъикоси табиӣ баррасӣ
шавад.

## 8.6. Real Cracked / Fractured Glass

Талаботи махсуси шишаи шикаста:

-   геометрияи воқеии тарқишҳо;
-   хатҳои шикасти номуназзам;
-   ғафсии канорҳо;
-   сатҳҳои гуногуни шикаст;
-   refraction-и алоҳида дар ҳар сатҳ;
-   specular highlights дар канорҳо;
-   соя ва инъикоси мутобиқ;
-   набудани намуди sticker ё расми оддии тарқиш.

Агар тарқиш танҳо ҳамчун texture гузошта шавад ва ба нур ё геометрия
таъсир накунад, он **Real Fractured Glass** ҳисобида намешавад. Texture
метавонад танҳо барои ҷузъиёти сатҳӣ истифода шавад.

## 8.7. Crystal / Liquid Geometry

Барои баъзе унсурҳои ороишӣ: - сатҳҳои каҷ; - канорҳои polished; -
қисмҳои шаффофи бисёрқабата; - шикасти нур; - инъикоси муҳит; -
деформатсияи нозуки сатҳ.

Эффекти моеъ набояд бо пластикаи шаффоф ё желеи оддӣ омехта шавад.

## 8.8. Ҷойҳои истифода

  Элемент                      Сатҳи Glass
  ---------------------------- -----------------------------
  Bottom Navigation            Premium Real Glass
  Floating controls            Real Glass
  Selected Hero object         Crystal Glass
  Selected course decoration   Subtle Glass
  Dialog                       Light Glass
  Main reading surface         No heavy glass
  Long text                    Opaque readable surface
  Quiz                         Clear high-contrast surface

## 8.9. Технологияи татбиқ

### Android

Jetpack Compose худ аз худ маводи пурраи физикии шишаро таъмин
намекунад.

Барои қисмҳои махсус арзёбӣ ва истифодаи яке аз роҳҳои зерин иҷозат дода
мешавад: - Filament ё renderer-и мувофиқи 3D; - OpenGL ES ё Vulkan дар
ҳолати зарурат; - Runtime shader-и оптимизатсияшуда; - Pre-rendered
assets барои ороишҳои мураккаб.

Қарори ниҳоӣ бояд аз санҷиши воқеӣ дар дастгоҳҳои Android гирифта шавад.

### Web

Барои Web метавон истифода бурд: - Three.js ё renderer-и мувофиқ; -
WebGL; - WebGPU дар дастгоҳҳои дастгиркунанда; - custom shader; - CSS
танҳо барои қабатҳои ёрирасон.

WebGL/WebGPU fallback бояд дошта бошад.

### Performance fallback

Агар дастгоҳ ё браузер рефраксияи пурраро дастгирӣ накунад: - версияи
сабуктар истифода шавад; - шаффофият ва edge highlight нигоҳ дошта
шаванд; - интерфейс шикаста ё холӣ намонад; - матн хонданбоб бимонад.

## 8.10. Меъёрҳои қабули Liquid Glass

Қабул танҳо баъд аз санҷиш: 1. Шиша танҳо blur набошад. 2. Тасвири паси
он дар минтақаи шиша деформатсия шавад. 3. Канорҳо ғафсӣ ва инъикоси
намоён дошта бошанд. 4. Reflection вобаста ба кунҷ ва муҳит бошад. 5.
Cracked Glass геометрия ё оптикаи воқеинамо дошта бошад. 6. Ҳаракатҳои
интерфейс бо glass material ҳамоҳанг бошанд. 7. Дар дастгоҳи миёнарав
интерфейс ба таври қобили қабул кор кунад. 8. Fallback кор кунад. 9.
Матн ва иконкаҳо хонданбоб бошанд.

------------------------------------------------------------------------

# 9. Системаи дороиҳои визуалӣ: REAL ASSETS ONLY

## 9.1. Принсипи манбаъ

**Дар ин маҳсулот истифодаи тасвирҳои AI-generated ҳамчун дороии асосии
визуалӣ иҷозат дода намешавад.**

Дороиҳои визуалӣ бояд аз яке аз манбаъҳои зерин бошанд:

1.  Аксҳои воқеии фармоишӣ.
2.  Stock photography бо иҷозатномаи тиҷоратӣ.
3.  Моделҳои касбии 3D, ки аз ҷониби рассом/дизайнер сохта шудаанд.
4.  Моделҳои 3D-и литсензиядор.
5.  Рендерҳои касбӣ аз геометрияи воқеии 3D.
6.  Иллюстрацияҳои дастӣ аз ҷониби рассомони инсонӣ.

Ҳар Asset бояд манбаъ ва ҳуқуқи истифода дошта бошад.

## 9.2. Фарқи AI-generated ва 3D-rendered

3D-rendered будан маънои AI-generated буданро надорад.

Модели 3D метавонад аз геометрия, material, texture, light ва camera дар
Blender ё дигар воситаи касбӣ сохта шуда, бо renderer бароварда шавад.

Ин гуна Asset қабул мешавад, агар: - модели аслӣ вуҷуд дошта бошад; -
геометрия ва мавод воқеӣ сохта шуда бошанд; - ҳуқуқи истифода равшан
бошад; - файлҳои аслӣ ё provenance ҳифз шаванд.

## 9.3. Asset Library

Барои ҳар Asset сабт шавад: - Asset ID; - номи файл; - категория; -
формат; - муаллиф ё манбаъ; - иҷозатнома; - санаи қабул; - андоза; -
resolution; - alt text; - забон, агар зарур бошад; - ҷойҳои истифода; -
версия.

## 9.4. Real Photography

Барои аксҳои одамон: - ҳуқуқи истифода бояд равшан бошад; - барои
моделҳои шинохташаванда release/permission мувофиқ гирифта шавад; -
аксҳои тасодуфӣ аз Google ё шабакаҳои иҷтимоӣ истифода нашаванд; - шахс
набояд ҳамчун хонанда, омӯзгор ё мутахассиси воқеӣ муаррифӣ шавад, агар
ин ҳақиқат надошта бошад; - аксҳо бояд ба аудитория ва фарҳанги маҳсулот
мувофиқ бошанд.

## 9.5. 3D Object Art Direction

Объектҳои 3D бояд: - geometry-и тоза дошта бошанд; - material-и физикӣ
дошта бошанд; - lighting-и табиӣ дошта бошанд; - shadow-и дуруст дошта
бошанд; - composition-и минималӣ дошта бошанд; - рангашон ба Design
Tokens мувофиқ бошад; - дар ҳамаи мактабҳо як забони визуалӣ дошта
бошанд.

## 9.6. Гулҳо ва ботаника

Гулҳо бояд бо ҷузъиёти воқеинамо сохта шаванд: - шакли алоҳидаи ҳар
барг; - ғафсӣ ва curvature-и гулбаргҳо; - vein/detail дар баргҳо; -
material-и сатҳ; - равшании мулоим; - сояи тамос; - transparencies дар
канорҳо, агар ба навъи гул мувофиқ бошад.

Композицияҳои иҷозатдодашуда: - гул қисман аз болои корт барояд; - як
барг аз канори корт гузарад; - шоха аз боло ба поён хам шавад; - чанд
гулбарг дар фазои холӣ қарор гирад.

Ин overlap бояд ба тарҳи корт халал нарасонад.

## 9.7. Asset formats

Мувофиқи вазифа: - WebP/AVIF барои тасвирҳои Web; - PNG барои
transparency дар ҳолатҳои зарурӣ; - SVG барои иконкаҳои векторӣ; -
GLB/glTF барои моделҳои 3D-и интерактивӣ; - KTX2 ё форматҳои мувофиқ
барои texture-и оптимизатсияшуда; - MP4/H.264 ё формати мувофиқ барои
видео; - HLS барои streaming дар ҳолати зарурат.

Ҳамаи Asset-ҳо бояд optimized delivery дошта бошанд.

------------------------------------------------------------------------

# 10. Iconography System

## 10.1. Ду оилаи иконка

### Minimal Line

Барои: - Navigation; - Search; - Settings; - Bookmark; - Audio
controls; - Video controls; - Back; - Close.

### Premium Soft 3D

Барои: - Ҳафт мактаб; - категорияҳо; - achievement; - hero
illustrations; - махсусиятҳои курсҳо.

## 10.2. Қоидаҳои мутобиқат

-   ҳамаи иконкаҳо бояд ба як Art Direction тааллуқ дошта бошанд;
-   stroke ва geometry мутобиқ бошанд;
-   рангҳо аз Design Tokens гирифта шаванд;
-   3D icon-ҳо бояд як намуди lighting дошта бошанд;
-   омехтаи тасодуфии icon packs манъ аст.

## 10.3. Ҳуқуқи Asset

Иконкаҳои литсензиядор ё фармоишӣ истифода шаванд. Истифодаи Asset-и
дорои ҳуқуқи номуайян қабул намешавад.

------------------------------------------------------------------------

# 11. Animation and Motion Specification

## 11.1. Қоидаҳои умумӣ

Аниматсия бояд: - мақсад дошта бошад; - ба амалҳои корбар ҷавоб диҳад; -
ба хондан халал нарасонад; - батареяро беҳуда истифода набарад; - Reduce
Motion-ро дастгирӣ кунад.

## 11.2. Timing

  Навъ                        Вақт
  ------------------- ------------
  Micro interaction     150--250ms
  Card transition       250--350ms
  Page transition       300--450ms
  Hero transition       600--900ms
  Decorative loop            3--6s

## 11.3. Hero carousel

-   расмҳо ҳар 3--4 сония иваз шаванд;
-   Crossfade истифода шавад;
-   scale-и нозук иҷозат аст;
-   ҳангоми interaction ҳаракат таваққуф кунад;
-   бо Reduce Motion ғайрифаъол ё статикӣ шавад;
-   дар экранҳои дарсӣ аниматсияи пасзамина кам карда шавад.

## 11.4. Interaction

-   press feedback;
-   selected navigation state;
-   progress animation;
-   smooth sheet/dialog;
-   subtle glass highlight;
-   bookmark feedback;
-   quiz feedback.

------------------------------------------------------------------------

# 12. Тарҳи экранҳои Android ва Web

## 12.1. Splash

-   background-и мувофиқ;
-   logo/mark;
-   аниматсияи кӯтоҳ;
-   loading-и воқеӣ, на loading-и сунъӣ.

## 12.2. Onboarding

-   муаррифии мақсад;
-   ҳафт мактаб;
-   интихоби забон;
-   танзими Light/Dark/System;
-   имкони skip.

## 12.3. Home

Қисмҳо: 1. Header ва Profile. 2. Hero / Daily Inspiration. 3. Continue
Learning. 4. Ҳафт мактаб. 5. Мундариҷаи тавсияшаванда. 6. Recent
Activity. 7. Floating Glass Bottom Navigation.

Ҳар блок бояд аз API ва CMS идора шавад.

## 12.4. Schools

-   рӯйхати ҳафт мактаб;
-   иконка ва ранг;
-   тавсифи кӯтоҳ;
-   шумораи курсҳо;
-   тартиби аз CMS идорашаванда.

## 12.5. School Details

-   Hero Asset;
-   номи мактаб;
-   тавсиф;
-   курсҳои он;
-   пешрафти корбар;
-   филтр ва ҷустуҷӯ.

## 12.6. Course Details

-   мақсад;
-   сатҳ;
-   модулҳо;
-   давомнокии тахминӣ;
-   prerequisite;
-   free/premium;
-   progress;
-   start/resume.

## 12.7. Module and Topic

-   тавсиф;
-   рӯйхати мавзӯъҳо;
-   тартиби омӯзиш;
-   completion state.

## 12.8. Lesson Reader

-   typography-и хонданбоб;
-   content blocks;
-   image gallery;
-   video;
-   audio;
-   source references;
-   previous/next lesson;
-   bookmark;
-   reading progress.

## 12.9. Quiz

-   савол;
-   ҷавобҳо;
-   тасвир;
-   progress;
-   submit;
-   натиҷа;
-   explanation, агар муаллиф ворид карда бошад.

## 12.10. Saved

-   рӯйхати дарсҳои захирашуда;
-   филтр аз рӯйи мактаб;
-   ҷустуҷӯ;
-   хориҷ кардан аз Saved.

## 12.11. Profile

-   маълумоти ҳадди ақали профил;
-   пешрафт;
-   курсҳои фаъол;
-   дастовардҳо;
-   танзимот.

## 12.12. Settings

-   Language;
-   Theme;
-   Animation;
-   Notifications;
-   Privacy;
-   Accessibility;
-   Downloads;
-   Account.

## 12.13. Web-specific

-   responsive public home;
-   school catalog;
-   course pages;
-   lesson reader;
-   account;
-   search;
-   SEO;
-   legal pages;
-   accessible navigation.

------------------------------------------------------------------------

# 13. Multilingual and RTL Requirements

Забонҳои ибтидоӣ: - тоҷикӣ; - русӣ; - арабӣ.

Талабот: - translation барои ҳар content item; - тарҷумаи мустақил барои
title, description ва blocks; - RTL барои арабӣ; - дурустии
mixed-direction text; - интихоби font мувофиқи забон; - нишон додани
translation-и нопурра дар Admin; - нашри як забон бе интизори тарҷумаи
дигар забонҳо.

Сохтори база набояд забонро ба як сутуни ягонаи hardcoded маҳдуд кунад.

------------------------------------------------------------------------

# 14. User Learning Features

Система бояд дастгирӣ кунад: - lesson completion; - course progress; -
resume learning; - saved content; - learning history; - quiz history; -
achievements; - notifications; - preferences; - appropriate offline
cache.

Пешрафти корбар бояд дар Backend нигоҳ дошта шавад, то байни Android ва
Web ҳамоҳанг бошад.

Агар корбар offline бошад, маълумоти cacheшуда бояд бо нишон додани
ҳолати offline дастрас бошад. Ҳангоми барқарор шудани интернет
синхронизатсия бояд бехатар иҷро шавад.

------------------------------------------------------------------------

# 15. Free and Premium Access

CMS бояд имкон диҳад: - мактаб free/premium шавад; - курс free/premium
шавад; - дарс free/premium шавад; - дастрасӣ ба мундариҷа аз рӯйи
entitlement санҷида шавад.

Backend бояд дастрасиро санҷад. Пинҳон кардани мундариҷаи Premium танҳо
дар интерфейс кофӣ нест.

Агар провайдери пардохт ҳанӯз интихоб нашуда бошад, танҳо entitlement
architecture ва integration point сохта шавад. Пардохти сохта ё fake
checkout қабул нест.

------------------------------------------------------------------------

# 16. Search

Ҷустуҷӯ бояд дар бар гирад: - мактаб; - курс; - модул; - мавзӯъ; -
дарс; - калимаҳои дохили матн, дар ҳудуди сиёсати индексатсия; - забон.

Натиҷаҳо бояд аз рӯйи забон ва иҷозати корбар филтр шаванд.

Admin Panel бояд Global Search дошта бошад.

------------------------------------------------------------------------

# 17. Security Requirements

Талаботи ҳатмӣ: - password hashing-и дуруст; - authentication-и амн; -
authorization дар Backend; - rate limiting; - input validation; - upload
validation; - CSRF/CORS configuration-и дуруст; - XSS protection; - SQL
injection protection; - secure cookies ё token strategy-и дуруст; -
HTTPS; - secrets management; - audit logs; - backup; - error handling бе
ошкор кардани маълумоти ҳассос.

Ҳамаи API endpoint-ҳои Admin бояд иҷозати мувофиқ талаб кунанд.

------------------------------------------------------------------------

# 18. Non-Functional Requirements

## 18.1. Performance

Ҳадафҳо бояд дар Staging ва дастгоҳҳои воқеӣ санҷида шаванд.

-   экранҳои асосӣ бояд зуд кушода шаванд;
-   тасвирҳо бояд lazy-load шаванд;
-   рӯйхатҳо pagination ё lazy loading дошта бошанд;
-   видео streaming истифода барад;
-   API response-ҳо аз ҳад калон набошанд;
-   database query-ҳо оптимизатсия шаванд;
-   аниматсияҳо дар дастгоҳҳои миёнарав smooth бошанд.

Ҳеҷ рақами performance набояд бе ченкунӣ ҳамчун натиҷаи кафолатнок эълон
шавад.

## 18.2. Availability

-   health checks;
-   logging;
-   monitoring;
-   error tracking;
-   backup;
-   restore testing;
-   deployment rollback plan.

## 18.3. Scalability

Архитектура бояд афзоиши: - корбарон; - дарсҳо; - расонаҳо; - забонҳо; -
кишварҳо; - муаллифонро дастгирӣ кунад.

## 18.4. Accessibility

-   контрасти кофӣ;
-   TalkBack;
-   keyboard navigation дар Web;
-   screen reader labels;
-   dynamic text sizing;
-   Reduce Motion;
-   touch targets-и муносиб;
-   focus states.

## 18.5. Reliability

-   network failure states;
-   retry mechanism;
-   upload progress;
-   safe draft autosave;
-   conflict handling;
-   version history;
-   graceful fallback.

------------------------------------------------------------------------

# 19. Backup, Restore and Data Protection

-   PostgreSQL backup-и мунтазам;
-   media backup ё storage redundancy;
-   backup encryption;
-   retention policy;
-   restore procedure;
-   restore test;
-   audit trail;
-   deletion policy;
-   data export дар ҳолати зарурат.

Backup танҳо мавҷуд буданаш кофӣ нест. Барқарорсозӣ бояд санҷида шавад.

------------------------------------------------------------------------

# 20. Testing and Quality Assurance

## 20.1. Backend

-   unit tests;
-   API tests;
-   permission tests;
-   database migration tests;
-   content lifecycle tests;
-   media upload tests;
-   multilingual tests;
-   security tests.

## 20.2. Android

-   UI tests;
-   navigation tests;
-   offline tests;
-   media playback tests;
-   theme tests;
-   accessibility checks;
-   performance profiling.

## 20.3. Web

-   component tests;
-   integration tests;
-   responsive tests;
-   RTL tests;
-   keyboard navigation;
-   browser compatibility;
-   API failure tests.

## 20.4. CMS End-to-End Acceptance Test

Ин санҷиш ҳатмӣ аст:

1.  Admin ворид мешавад.
2.  Мактаби нав эҷод мекунад.
3.  Курс месозад.
4.  Модул месозад.
5.  Мавзӯъ ва дарс месозад.
6.  Матн ворид мекунад.
7.  Расмро байни ду параграф мегузорад.
8.  Видео бор мекунад.
9.  Аудио бор мекунад.
10. Quiz илова мекунад.
11. Preview мекунад.
12. Дарсро Publish мекунад.
13. Дарс дар Android намоён мешавад.
14. Ҳамон дарс дар Web намоён мешавад.
15. Admin видеоро иваз мекунад.
16. Android ва Web версияи навро мегиранд.
17. APK/AAB аз нав сохта намешавад.
18. Revision History тағйиротро нишон медиҳад.

Агар ин workflow кор накунад, CMS анҷомёфта ҳисобида намешавад.

## 20.5. Visual QA

-   муқоисаи экран бо Reference Image;
-   санҷиши Light/Dark;
-   санҷиши андозаҳои гуногуни экран;
-   санҷиши glass refraction;
-   санҷиши real asset provenance;
-   санҷиши readability;
-   санҷиши motion;
-   санҷиши fallback.

------------------------------------------------------------------------

# 21. Deployment and DevOps

Муҳитҳо: - Development; - Staging; - Production.

Талабот: - Docker configuration; - environment variables; - database
migrations; - CI pipeline; - test pipeline; - secure secrets; -
production logging; - monitoring; - backup; - rollback; - API
documentation; - release notes.

Android: - signed release configuration; - APK/AAB generation; - signing
keys аз соҳиби маҳсулот; - versioning.

Web: - production build; - hosting configuration; - domain and HTTPS; -
CDN.

Backend: - production server; - PostgreSQL; - storage; - worker
processes; - monitoring.

Натиҷаи deployment бояд воқеан санҷида шавад. Танҳо мавҷуд будани
конфигуратсия маънои deployed буданро надорад.

------------------------------------------------------------------------

# 22. Development Phases and Deliverables

## Phase 1: Discovery and Architecture

Deliverables: - repository audit; - architecture diagram; - database
ERD; - API contract; - design tokens; - technical decision records; -
implementation backlog.

## Phase 2: Backend Foundation

Deliverables: - Django project; - PostgreSQL; - authentication; -
RBAC; - API versioning; - migrations; - automated tests.

## Phase 3: CMS and Admin Panel

Deliverables: - dashboard; - school management; - course management; -
module/topic management; - block editor; - media library; - publication
workflow; - revision history; - audit logs.

## Phase 4: Design System and Visual Assets

Deliverables: - Light/Dark tokens; - typography; - icon family; - glass
components; - real 3D asset library; - responsive components; - motion
system; - asset provenance register.

## Phase 5: Web Application

Deliverables: - public pages; - course catalog; - lesson reader; - user
profile; - learning progress; - search; - API integration.

## Phase 6: Native Android

Deliverables: - Kotlin app; - Compose UI; - API integration; - local
cache; - media player; - learning progress; - accessibility; - release
build.

## Phase 7: QA and Production Readiness

Deliverables: - end-to-end tests; - security review; - performance
report; - deployment guide; - backup/restore test; - release
checklist; - known limitations report.

------------------------------------------------------------------------

# 23. Definition of Done

Хусусият танҳо дар ҳолатҳои зерин анҷомёфта ҳисобида мешавад:

1.  Код навишта шудааст.
2.  Ба Backend/Database пайваст аст, агар талаб шавад.
3.  UI ҳолатҳои loading/error/empty/success дорад.
4.  Permission checks кор мекунанд.
5.  Тестҳои мувофиқ гузаштаанд.
6.  Дар Android ва Web санҷида шудааст, агар ҳар ду дахл дошта бошанд.
7.  Documentation нав шудааст.
8.  Ҳеҷ тугмаи сохта ё placeholder-и пинҳон боқӣ намондааст.
9.  Маҳдудиятҳои боқимонда ошкоро сабт шудаанд.

------------------------------------------------------------------------

# 24. Final Acceptance Criteria

Маҳсулот танҳо дар сурати иҷрои ҳамаи шартҳои асосӣ барои Production
Ready арзёбӣ мешавад:

-   Native Android бо Kotlin кор мекунад.
-   Web Application кор мекунад.
-   Admin Panel кор мекунад.
-   Backend API кор мекунад.
-   PostgreSQL ва migrations дурустанд.
-   Ҳамаи се интерфейс як манбаи маълумот доранд.
-   Соҳиб метавонад ҳафт мактабро идора кунад.
-   Курс, модул, мавзӯъ ва дарс динамикӣ эҷод мешаванд.
-   Дарс аз блокҳои гуногун сохта мешавад.
-   Расм дар ҳар ҷойи тартиби дарс ворид мешавад.
-   Видео ва аудио бор ва иваз мешаванд.
-   Daily Inspiration идора мешавад.
-   Revision History кор мекунад.
-   Publish/Unpublish кор мекунад.
-   Мундариҷа дар Android ва Web бе rebuild нав мешавад.
-   Тоҷикӣ, русӣ ва арабӣ дастгирӣ мешаванд.
-   RTL кор мекунад.
-   Light/Dark/System кор мекунанд.
-   Liquid Glass танҳо CSS blur нест.
-   Refraction ва optical distortion санҷида шудаанд.
-   Cracked Glass дорои геометрия ё optical behavior-и воқеинамо аст.
-   Real asset provenance сабт шудааст.
-   AI-generated imagery ҳамчун asset-и асосӣ истифода нашудааст.
-   Security ва permission checks санҷида шудаанд.
-   Critical tests гузаштаанд.
-   Backup/restore санҷида шудааст.
-   Deployment documentation мавҷуд аст.
-   APK/AAB ва Web build status дақиқ нишон дода шудааст.

------------------------------------------------------------------------

# 25. Супориши ниҳоӣ ба AI Agent

Ту вазифадор ҳастӣ, ки ин SRS-ро ҳамчун талаботи расмии сохтани маҳсулот
иҷро кунӣ.

Пеш аз оғоз: 1. Ҳамаи файлҳои repository-ро санҷ. 2. Технология ва кори
мавҷударо муайян кун. 3. Тасвирҳои Reference-ро бодиққат омӯз. 4. Нақшаи
марҳилавӣ ва рӯйхати вазифаҳоро соз. 5. Database schema ва API
contract-ро муайян кун. 6. Design System-ро пеш аз сохтани экранҳои зиёд
омода кун.

Баъд корро марҳила ба марҳила иҷро кун.

Қоидаҳои қатъӣ: - танҳо mockup насоз; - функсияҳои сохта истифода
накун; - маълумоти таълимиро hardcode накун; - AI-generated educational
content насоз; - AI-generated visual assets-ро ҳамчун дороии асосӣ
истифода накун; - CSS blur-ро Real 3D Glass наном; - бе санҷиш
feature-ро complete эълон накун; - кори анҷомнаёфтаро пинҳон накун; - аз
соҳиби маҳсулот талаб накун, ки барои илова кардани дарс код нависад.

Агар ягон талабот аз ҷиҳати техникӣ дар дастгоҳ ё муҳити мавҷуда
иҷронашаванда бошад: 1. Маҳдудиятро шарҳ деҳ. 2. Роҳи беҳтарини амалӣ
пешниҳод кун. 3. Таъсири он ба сифат ва performance-ро нишон деҳ. 4. Бе
иҷозати соҳиб талаботро ба варианти пастсифат иваз накун.

Дар анҷом ҳисоботи воқеӣ пешниҳод кун: - чӣ сохта шуд; - чӣ санҷида
шуд; - кадом тестҳо гузаштанд; - кадом қисмҳо Production Ready
мебошанд; - кадом қисмҳо ҳанӯз конфигуратсия ё иҷозати беруна
мехоҳанд; - чӣ маҳдудиятҳо боқӣ мондаанд.

**МАҚСАДИ НИҲОӢ:**

Соҳиби «Духтари хубам» бояд танҳо ба Admin Panel ворид шавад, мактабро
интихоб кунад, курс ва дарсро созад, матн, расм, видео, аудио ва дигар
блокҳоро ҷойгир кунад, Preview ва Publish намояд.

Система бояд боқимондаи корро автоматӣ иҷро кунад ва мундариҷаи
нашршударо дар Android ва Web бо ҳамон Design System намоиш диҳад.

**Ин маҳсулот бояд як платформаи воқеии таълимӣ бошад, на прототипи
зебои бе функсия.**


---

# ҚИСМИ II — VISUAL DESIGN, REFERENCE IMAGE EXECUTION ВА CONTENT AUTHORING

# ДУХТАРИ ХУБАМ

# APPENDIX B — OFFICIAL VISUAL DESIGN & CONTENT AUTHORING SPECIFICATION

## Қоидаи расмии дизайн аз рӯйи 3 Reference Image ва муҳаррири пурраи мундариҷа

**Версия:** 1.1\
**Платформаҳо:** Android Native (Kotlin + Jetpack Compose), Web, Admin
Panel\
**Забонҳо:** Тоҷикӣ, русӣ, арабӣ\
**Статус:** Талаботи ҳатмӣ барои татбиқ

> Се расми Reference, ки соҳиби маҳсулот ба агент мефиристад, манбаи
> асосии самти визуалӣ мебошанд. Онҳо намунаи услуб, композиция, мавод,
> рӯшноӣ ва муносибати объектҳо мебошанд, на скриншоти тайёри маҳсулот.

------------------------------------------------------------------------

# 1. Супориши асосӣ ба AI Agent

Мақсад сохтани маҳсулоти воқеӣ, пурра интерактивӣ ва Production-grade
мебошад. Се расми Reference-ро бодиққат омӯз ва аз онҳо Design
Language-и ягона барор.

**Интерфейсро танҳо ҳамчун скриншоти зебо нусхабардорӣ накун. Ҳамаи
экранҳоро ҳамчун интерфейси воқеии коркунанда бо ҳамон услуби визуалӣ аз
нав соз.**

Расмҳо самти визуалиро муайян мекунанд, на маҳдудияти функсионалиро.
Ҳамаи саҳифаҳои иловагӣ, Loading, Error, Empty State, Dialog, Responsive
ва ҳолатҳои интерактивӣ низ бояд бо ҳамон Design System сохта шаванд.

Натиҷаи қабулшаванда: - Android Native; - Web-и responsive; - Admin
Panel-и пурра идорашаванда; - Backend ва Database-и воқеӣ; -
компонентҳои reusable; - маълумоти динамикӣ; - визуалҳои воқеӣ ва дорои
ҳуқуқи истифода; - матнҳои кӯтоҳ, ҷиддӣ ва дақиқ; - Full Text Editor-и
визуалӣ.

Прототипи статикӣ, тугмаҳои бе амал, маълумоти сохта ва экранҳои бе
Backend қабул намешаванд.

# 2. Қоидаи истифодаи Reference Images

## 2.1. Хусусиятҳое, ки бояд аз расмҳо гирифта шаванд

1.  Таносуби экран ва ҷойгиршавии элементҳо.
2.  Фазои холӣ ва зичии интерфейс.
3.  Радиуси кунҷҳои кортҳо.
4.  Шаффофият, қабатнокӣ ва ғафсии шиша.
5.  Ҷойгиршавии объектҳои 3D нисбат ба кортҳо.
6.  Қисман пӯшида шудани корт аз тарафи гул, барг ё объекти 3D.
7.  Рӯшноӣ, инъикос, соя ва чуқурии саҳна.
8.  Иерархияи матнҳо.
9.  Шакли иконкаҳо.
10. Bottom Navigation ва ҳолати интихобшуда.
11. Палитра ва гузариши рангҳо.
12. Муносибати матн, тасвир ва амали асосӣ.

## 2.2. Чизҳое, ки набояд нусхабардорӣ шаванд

-   хатогиҳои матни намунавӣ;
-   рақамҳо ва номи шахсони намунавӣ;
-   статусбар ё чаҳорчӯбаи iPhone ҳамчун талаботи Android;
-   матнҳои вайроншудаи генератор;
-   иконкаҳои нодуруст;
-   ҷузъиёти тасодуфии визуалӣ.

Ҳамаи матнҳо, номҳо, рақамҳо ва амалҳо дар маҳсулоти воқеӣ бояд дуруст
бошанд.

## 2.3. Қоидаи умумӣ

Ҳар экрани нав бояд ба ҳамон оилаи визуалӣ тааллуқ дошта бошад, ҳатто
агар дар Reference мустақиман нишон дода нашуда бошад.

------------------------------------------------------------------------

# 3. Забони визуалӣ ва Design System

## 3.1. Самти дизайн

**PREMIUM FEMININE MINIMALISM + REALISTIC 3D ART DIRECTION + PHYSICAL
LIQUID GLASS**

Хусусиятҳо: - ултраминималистӣ; - тоза, ором ва премиум; - шево, вале на
кӯдакона; - композицияи бодиққат; - объектҳои 3D-и ҳаҷмнок; - шишаи
физикӣ ва refraction; - ороиши кам, вале мақсаднок; - матни кӯтоҳ ва
равшан.

Интерфейс набояд бо корт, гул, соя ва аниматсияи зиёдатӣ пур карда
шавад.

## 3.2. Light Mode

  Token              HEX         Истифода
  ------------------ ----------- ----------------
  Background         `#FBF9FD`   Замина
  Surface            `#FFFFFF`   Сатҳи асосӣ
  Lavender Surface   `#EEE7F6`   Қабати нарм
  Lilac              `#DCCCEB`   Ороиш
  Primary            `#A78BCB`   Амали асосӣ
  Deep Plum          `#59446E`   Матни муҳим
  Dusty Rose         `#EBDCE4`   Акценти дуюм
  Champagne          `#E8D7B9`   Акценти тиллоӣ
  Soft Sage          `#DDE9DF`   Акценти ором

## 3.3. Dark Mode

  Token              HEX         Истифода
  ------------------ ----------- -----------------
  Background         `#17131E`   Замина
  Surface            `#211B2A`   Корт
  Elevated Surface   `#30263B`   Қабати боло
  Primary            `#B7A0D3`   Акценти асосӣ
  Lilac              `#D8C8EA`   Қисми равшан
  Text               `#F4EFF8`   Матн
  Dusty Rose         `#B78FA4`   Акценти иловагӣ
  Champagne          `#CBB58F`   Нури ороишӣ

Ҳамаи рангҳо Design Tokens бошанд. Hardcode кардани рангҳо дар экранҳои
алоҳида манъ аст.

## 3.4. Typography

Пешниҳоди ибтидоӣ: - Manrope барои интерфейс; - Lora ё serif-и ҳамсатҳ
барои сарлавҳаҳои интихобшуда; - Noto Naskh Arabic барои арабӣ.

Glyph coverage-и ҳарфҳои `ӣ, қ, ғ, ҳ, ҷ, ӯ` дар ҳамаи вазнҳо санҷида
шавад. Шрифти дастнавис танҳо барои акценти хеле кӯтоҳ истифода шавад.
Матни асосӣ бояд осон хонда шавад.

------------------------------------------------------------------------

# 4. Матни интерфейс: SHORT, SERIOUS, PRECISE

Ин талабот барои тамоми UI ҳатмист.

## 4.1. Принсип

Матнҳои интерфейс бояд кӯтоҳ, ҷиддӣ, дақиқ ва амалмеҳвар бошанд.
Интерфейс ҷойи шарҳи дароз нест. Матни муфассал танҳо дар дохили дарс,
мақола, қоида ё маводи таълимӣ истифода мешавад.

## 4.2. Намунаҳои нодуруст ва дуруст

  -----------------------------------------------------------------------
  Нодуруст: дароз ва таблиғотӣ        Дуруст: кӯтоҳ ва дақиқ
  ----------------------------------- -----------------------------------
  Мактаби диниро омӯзед ва як қадам   Мактаби динӣ
  ба пеш ҳаракат кунед                

  Ба омӯзиши одобу ахлоқ шурӯъ намоед Одоб ва ахлоқ

  Ба мо иҷозат диҳед, ки ҳар рӯз ба   Огоҳиҳоро иҷозат диҳед
  шумо паём фиристем                  

  Барои идома додани омӯзиш ин        Идома
  тугмаро пахш кунед                  

  Барои пайдо кардани дарс онро       Захира
  захира намоед                       

  Шумо то имрӯз бисёр чизҳоро         Пешрафти шумо
  омӯхтаед                            
  -----------------------------------------------------------------------

## 4.3. Қоидаҳои матн

-   сарлавҳа: одатан 1--5 калима;
-   тугма: 1--3 калима;
-   label: 1--4 калима;
-   тавсифи корт: як ҷумлаи кӯтоҳ;
-   паёми хато: сабаб ва амали зарурӣ, мухтасар;
-   иҷозат: мақсади воқеӣ ва дақиқ;
-   матни таблиғотӣ ва эҳсосии зиёдатӣ манъ аст.

Намунаҳои UI: «Асосӣ», «Мактабҳо», «Захираҳо», «Профил», «Идома», «Оғози
курс», «Пешрафт», «Натиҷаҳо», «Танзимот», «Забон», «Огоҳиҳо», «Махфият».

------------------------------------------------------------------------

# 5. Эзоҳҳои иловагӣ бо нишонаи !

Агар шарҳ зарур бошад, матни дарозро доимӣ нишон надеҳ.

## 5.1. Намуди нишона

Дар паҳлӯи сарлавҳа ё label нишонаи хурди `!` гузошта шавад. Он
минималӣ, равшан ва ба Design System мувофиқ бошад.

## 5.2. Амал

Ҳангоми пахш Popover, Tooltip ё Dialog-и хурд кушода шавад: - шарҳи
заруриро нишон диҳад; - имкони бастан дошта бошад; - дар Android ва Web
дастрас бошад; - keyboard ва screen reader-ро дастгирӣ кунад.

Мисол:

**Огоҳиҳо `!`**

Шарҳи кушодашаванда: «Барои гирифтани хабарҳои курсҳо ва ёдрасии
дарсҳо.»

## 5.3. Идоракунӣ аз CMS

Барои ҳар Help Text: - фаъол/ғайрифаъол; - сарлавҳа; - матни шарҳ; -
тарҷумаҳо; - намуди иконка; - Preview.

------------------------------------------------------------------------

# 6. Аксҳо ва 3D Asset-ҳои воқеӣ

## 6.1. Қоидаи қатъӣ

Дороиҳои асосии визуалӣ бояд аз аксҳои воқеӣ, моделҳои касбии 3D ё
иллюстрацияҳои дастии дорои иҷозат гирифта шаванд.

**AI-generated image ҳамчун Asset-и асосии маҳсулот истифода нашавад.**

Reference Images танҳо самти визуалиро нишон медиҳанд. Онҳо иҷозат
намедиҳанд, ки тамоми маҳсулот бо расмҳои генератсияшуда пур карда
шавад.

## 6.2. Манбаъҳои қобили қабул

-   аксҳои фармоишии воқеӣ;
-   stock photography бо иҷозатномаи тиҷоратӣ;
-   модели касбии 3D;
-   модели 3D-и литсензиядор;
-   рендер аз модели воқеии 3D;
-   иллюстрацияи дастии рассом.

## 6.3. Одамони воқеӣ

Агар дар Hero ё баннер духтар/зан нишон дода шавад: - акс воқеӣ бошад; -
ҳуқуқи истифода равшан бошад; - шахс бардурӯғ ҳамчун омӯзгор ё муаллиф
муаррифӣ нашавад; - акс ба мавзӯъ ва аудитория мувофиқ бошад; - ишора,
нигоҳ ва ҳолати бадан табиӣ бошанд.

## 6.4. Объектҳои 3D

Ҳар объект бояд: - геометрияи тоза; - material-и дуруст; - texture-и
босифат; - lighting-и физикӣ; - shadow-и воқеӣ; - camera composition-и
касбӣ; - рангҳои мутобиқ ба палитра дошта бошад.

Объект набояд ба эмодзи ё пластикаи арзон монанд шавад.

## 6.5. Гулҳо ва растаниҳо

Гулҳо аз модели воқеии 3D ё акси воқеӣ бошанд. Ҷузъиёти зарурӣ: - шакли
табиии гулбарг; - curvature ва ғафсӣ; - vein/detail-и барг; - сояи
тамос; - равшании мулоим; - transparencies-и табиӣ, агар мувофиқ бошад.

Композиция: - як барг метавонад қисман болои корт гузарад; - гул аз
канори корт берун барояд; - шоха аз боло ба поён хам шавад; - гулбарг
дар фазои холӣ шино кунад; - объект ба сатҳ сояи воқеӣ партояд.

Overlap набояд матн ё тугмаро пӯшонад.

## 6.6. Объектҳои парвозкунанда

Шумора кам, ҳаракат суст, чуқурии саҳна намоён ва соя/равшанӣ мувофиқ
бошад. Объект аз болои матн нагузарад. Reduce Motion бояд онҳоро статикӣ
кунад.

------------------------------------------------------------------------

# 7. REAL 3D LIQUID GLASS ва CRACKED GLASS

## 7.1. Таъриф

Liquid Glass дар ин лоиҳа CSS Blur ё шаффофияти оддӣ нест.

Он бояд рафтори оптикии воқеинамо дошта бошад: - refraction; - Fresnel
reflection; - specular highlights; - optical distortion; - ғафсии
канор; - depth; - internal reflections; - roughness-и назоратшуда; - соя
ва инъикоси муҳит.

## 7.2. Cracked Glass

Шишаи шикаста бояд: - геометрияи тарқишҳои номуназзам; - сатҳҳои
шикастаи гуногун; - канорҳои ғафс; - refraction дар сатҳҳои гуногун; -
reflection ва highlight-и воқеинамо дошта бошад.

Он набояд ба sticker ё расми оддии тарқиш монанд шавад. Texture танҳо
барои ҷузъиёти сатҳӣ аст. Агар ба геометрия ва рафтори оптикӣ таъсир
накунад, онро Real Fractured Glass наномед.

## 7.3. Ҷойҳои истифода

  Ҷой                    Талабот
  ---------------------- -----------------------------
  Bottom Navigation      Premium Real Glass
  Floating controls      Real Glass
  Hero decoration        Crystal / Liquid Glass
  Selected course card   Glass accent
  Dialog                 Light Glass
  Матни дарси дароз      Сатҳи ором ва хонданбоб
  Quiz options           Сатҳи равшан ва контрастнок

## 7.4. Performance ва fallback

-   Glass effect набояд тамоми экранро вазнин кунад.
-   Қабатҳои шиша маҳдуд ва мақсаднок бошанд.
-   Android ва Web fallback дошта бошанд.
-   Дар дастгоҳи заиф интерфейс холӣ ё вайрон нашавад.
-   Матн ҳамеша хонданбоб бошад.
-   CSS Blur танҳо fallback ё қабати ёрирасон аст, на иҷрои талаботи
    Real 3D Glass.

Технологияҳои арзёбишаванда: - Android: Kotlin, Jetpack Compose,
shader/renderer-и мувофиқ, Filament, OpenGL ES ё Vulkan мувофиқи натиҷаи
prototype. - Web: Three.js ё renderer-и мувофиқ, WebGL, WebGPU дар
дастгоҳҳои дастгиркунанда.

Қарори ниҳоӣ баъд аз санҷиши воқеӣ дар дастгоҳҳо гирифта шавад.

------------------------------------------------------------------------

# 8. Motion Design

  Навъ                  Вақти пешниҳодӣ
  ------------------- -----------------
  Micro interaction          150--250ms
  Card transition            250--350ms
  Page transition            300--450ms
  Hero transition            600--900ms
  Decorative loop                 3--6s

Аниматсия бояд нозук, мақсаднок ва ором бошад. Ҳангоми Reduce Motion
ҳаракатҳои ороишӣ хомӯш ё статикӣ шаванд.

Hero carousel: - ивазшавӣ ҳар 3--4 сония; - crossfade; - scale-и
ночиз; - таваққуф ҳангоми interaction; - бе халал ба хондани матн.

Ҳар тугма бояд амали воқеӣ дошта бошад, на танҳо аниматсия.

------------------------------------------------------------------------

# 9. Ҳашт экрани асосӣ

## Screen 01 --- Welcome / Splash

Компонентҳо: - Logo; - номи «Духтари хубам»; - Hero photograph ё модели
воқеии 3D; - гулҳои воқеинамо; - Liquid Glass layer; - loading-и воқеӣ.

Матн кам бошад. Объект метавонад аз чаҳорчӯба берун барояд, вале
логотипро напӯшонад.

## Screen 02 --- Home Dashboard

Компонентҳо: - Greeting; - Profile shortcut; - Daily Inspiration; -
Continue Learning; - ҳафт мактаб; - тавсияи курс; - Bottom Navigation.

Матнҳои кӯтоҳ: «Салом», «Идомаи омӯзиш», «Ҳафт мактаби дониш», «Ҳамаи
мактабҳо», «Идома».

## Screen 03 --- School / Course Overview

Компонентҳо: - Back; - номи мактаб; - Hero image ё 3D object; - тавсифи
кӯтоҳ; - Progress; - Tabs; - рӯйхати курсҳо; - Course action.

## Screen 04 --- Lesson Reader

Компонентҳо: - Back; - номи дарс; - Bookmark; - Text size; - More; -
Content Blocks; - Image; - Video; - Audio; - Important Note; - Source; -
Previous/Next.

Дарс аз Content Block-ҳои CMS сохта шавад, на ҳамчун як тасвири ягона.

## Screen 05 --- Quiz

Компонентҳо: - Progress; - Question number; - Question; - Answer
options; - Submit/Continue; - Result; - Explanation.

Контраст ва хонданбобӣ аз Glass effect муҳимтаранд.

## Screen 06 --- Achievements / Progress

Компонентҳо: - Achievement title; - Trophy ё 3D object; - Completed
courses; - Progress; - Badges; - Bottom Navigation.

Омор танҳо аз Backend гирифта шавад. Рақамҳои намунавӣ дар Production
манъанд.

## Screen 07 --- Profile

Компонентҳо: - Profile image; - Name; - Account status; - Learning
statistics; - Saved content; - Settings shortcuts; - Privacy; - Bottom
Navigation.

Маълумоти шахсӣ бо иҷозати корбар идора шавад.

## Screen 08 --- Settings

Компонентҳо: - Language; - Theme: Light / Dark / System; -
Notifications; - Animation; - Text size; - Privacy; - About; - Account.

Матнҳои кӯтоҳ: «Забон», «Режими намоиш», «Огоҳиҳо», «Аниматсия»,
«Андозаи матн», «Махфият», «Дар бораи барнома».

Дар паҳлӯи танзимоти шарҳталаб нишонаи `!` бошад. Шарҳ ҳангоми пахш
кушода шавад.

------------------------------------------------------------------------

# 10. FULL TEXT EDITOR --- Муҳаррири пурраи визуалӣ

## 10.1. Талаботи асосӣ

Admin Panel бояд Rich Content Editor-и воқеӣ дошта бошад. Он набояд
танҳо Textarea-и калон бошад.

Соҳиб бояд матн, тасвир, видео, аудио, callout, иқтибос ва дигар
унсурҳоро дар ҳар қисми дарс бо тартиби дилхоҳ ҷойгир карда тавонад.

**Сохтани дарс, ҷойгир кардани расм ва форматонӣ бояд бе навиштани код
иҷро шавад.**

## 10.2. Тарҳи муҳаррир

Се минтақа: 1. Toolbar --- интихоби блок ва формат. 2. Canvas / Editor
--- сохтани дарс. 3. Properties Panel --- танзими блоки интихобшуда.

Амалиёт: - Save Draft; - Preview; - Publish; - Version History; -
Language selector.

## 10.3. Блокҳои матнӣ

-   H1 / H2 / H3;
-   Paragraph;
-   Lead Text;
-   Bold / Italic / Underline / Strikethrough;
-   Ordered List;
-   Bullet List;
-   Quote;
-   Caption;
-   Source;
-   Footnote;
-   Divider;
-   Link.

## 10.4. Блокҳои визуалӣ

-   Image;
-   Image Gallery;
-   Full-width Image;
-   Side-by-side Image + Text;
-   Video;
-   Audio;
-   3D Asset;
-   Illustration;
-   Downloadable File.

Расм бояд дар ҳар ҷойи матн гузошта шавад, на танҳо ҳамчун Cover.

## 10.5. Блокҳои таъкидӣ

Admin бояд матни муҳимро дар блоки махсус гузорад.

  Навъ               Намуди визуалӣ              Истифода
  ------------------ --------------------------- -----------------
  Important / Gold   Champagne, акценти тиллоӣ   Маълумоти муҳим
  Warning / Red      Сурхи ором                  Огоҳии воқеӣ
  Note / Lavender    Лаванда                     Эзоҳ
  Tip / Sage         Сабзи нарм                  Маслиҳати амалӣ
  Quote / Elegant    Serif ва нишонаи иқтибос    Иқтибос

Ҳар блок дорои: - навъи callout; - сарлавҳа; - матн; - иконка; -
accent-и интихобшаванда аз палитраи иҷозатшуда; - Preview бошад.

## 10.6. Formatting Toolbar

-   Bold;
-   Italic;
-   Underline;
-   Strikethrough;
-   Alignment;
-   Heading level;
-   Text color аз палитраи иҷозатшуда;
-   Highlight color;
-   Link;
-   Clear formatting.

Рангҳои тасодуфӣ ва зиёдатӣ иҷозат дода нашаванд.

## 10.7. Drag and Drop

Ҳар блок бояд: - интихоб шавад; - ҷойиваз шавад; - duplicate шавад; -
таҳрир шавад; - ҳазф шавад; - collapse/expand шавад; - Preview дошта
бошад.

Алтернативаи клавиатура барои drag-and-drop таъмин шавад.

## 10.8. Video Lesson Editor

Майдонҳо: - Title; - Short description; - Video asset; -
Poster/Thumbnail; - Subtitle; - Transcript; - Duration; - Language; -
Related content; - Source; - Publish status.

Як дарс метавонад видео, матн, тасвир, аудио ва callout-ҳоро омехта
кунад.

## 10.9. Audio Editor

-   Audio file;
-   Title;
-   Speaker, агар зарур бошад;
-   Transcript;
-   Duration;
-   Language;
-   Cover image;
-   Playback preview.

## 10.10. Image Editor

Admin бояд: - файл бор кунад; - аз Media Library интихоб кунад; - crop
кунад; - focal point интихоб кунад; - alt text ворид кунад; - caption
илова кунад; - layout ва size интихоб кунад; - Preview кунад.

Файли аслӣ нигоҳ дошта шавад.

## 10.11. Full Preview

Preview: - Mobile; - Tablet; - Desktop/Web; - Light Mode; - Dark Mode; -
ҳар забон.

Preview бояд тартиби блокҳо, typography, crop, player ва callout-ро
нишон диҳад.

------------------------------------------------------------------------

# 11. Сохтори Admin Panel ва CMS

``` text
Dashboard
│
├── Мактабҳо
│   ├── Маърифати динӣ
│   ├── Одоб ва ахлоқ
│   ├── Фарҳанги тоҷик
│   ├── Оила ва муносибатҳо
│   ├── Илм ва саломатӣ
│   ├── Рушди шахсият
│   └── Зиндагии муосир
│
├── Курсҳо
├── Модулҳо
├── Мавзӯъҳо
├── Дарсҳо
├── Full Text Editor
├── Video Library
├── Audio Library
├── Image / 3D Asset Library
├── Daily Inspiration
├── Quiz Manager
├── Notifications
├── Users and Roles
├── Analytics
├── Translations
├── Revision History
└── System Settings
```

Соҳиб бояд тавонад: - мактаб эҷод кунад; - курс ва мавзӯъ илова кунад; -
дарс созад; - тартибро тағйир диҳад; - ҳар блокро таҳрир кунад; - расмро
дар ҳар ҷой гузорад; - видео ва аудиоро иваз кунад; - Preview кунад; -
Publish/Unpublish кунад; - версияи пешинаро барқарор кунад.

Ҳамаи амалҳо бе тағйири код иҷро шаванд.

## Daily Inspiration

Admin метавонад матн, муаллиф/манбаъ, тасвир, забон, сана ва вақти
нашрро ворид кунад. Иқтибоси бе манбаъ ба шахси муайян нисбат дода
нашавад.

## Notifications

Admin метавонад сарлавҳа, матни кӯтоҳ, забон, аудитория, вақти
фиристодан ва deep link-ро идора кунад. Огоҳӣ танҳо бо риояи иҷозат ва
танзимоти корбар фиристода шавад.

------------------------------------------------------------------------

# 12. Талаботи техникӣ ба муҳаррир ва мундариҷа

-   Content Block schema version дошта бошад.
-   Rich Text sanitize шавад.
-   HTML-и иҷрошаванда ва JavaScript иҷро нашавад.
-   Asset-ҳо бо ID-и устувор нигоҳ дошта шаванд.
-   Ҳар блок display order дошта бошад.
-   Тарҷумаи ҳар блок алоҳида идора шавад.
-   Draft autosave дошта бошад.
-   Revision History нигоҳ дошта шавад.
-   Publish бехатар иҷро шавад.
-   Пеш аз ҳазфи Asset истифодаи он санҷида шавад.

Намунаи мантиқии блок:

``` json
{
  "type": "callout",
  "variant": "important",
  "title": "Муҳим",
  "body": "Матни воридкардаи муаллиф",
  "icon": "info",
  "accent": "champagne",
  "order": 4
}
```

Ин намунаи сохтор аст. Schema-и ниҳоӣ бояд дар API ва Database бо
validation муайян гардад.

------------------------------------------------------------------------

# 13. Платформаҳо ва меъмории муштарак

## Android

-   Kotlin;
-   Jetpack Compose;
-   MVVM ё Clean Architecture;
-   API-based content;
-   Room cache;
-   DataStore;
-   Coroutines;
-   Media3;
-   offline-friendly behavior.

Android бояд Native бошад, на WebView-и оддӣ.

## Web

-   Next.js;
-   TypeScript;
-   responsive layout;
-   SSR/SSG мувофиқи саҳифа;
-   RTL;
-   accessibility;
-   API integration.

## Admin Panel

-   Web-based;
-   desktop-first ва responsive;
-   role-based permissions;
-   Full Text Editor;
-   Media Library;
-   Preview;
-   Revision History;
-   Publish Workflow.

Android, Web ва Admin бояд аз як Backend API ва Database истифода
баранд. Тағйири дарс дар Admin бояд дар Android ва Web бе rebuild-и
APK/AAB дастрас шавад.

------------------------------------------------------------------------

# 14. Мундариҷаи таълимӣ

AI Agent вазифадор нест, ки дарсҳои таълимиро нависад. Мундариҷаро
соҳиби маҳсулот ва муаллифони ваколатдор ворид мекунанд.

Система бояд асбобҳои эҷод, форматонӣ, тасвиргузорӣ, санҷиш, тарҷума,
Preview ва Publish-ро таъмин кунад.

UI text аз lesson content ҷудо бошад: - UI text --- кӯтоҳ, ҷиддӣ ва
дақиқ; - Lesson content --- муфассал, сохторнок ва бо манбаъ.

Маводи динӣ, тиббӣ, ҳуқуқӣ ва дигар маводи махсус бояд пеш аз нашр аз
ҷониби мутахассиси мувофиқ санҷида шавад.

------------------------------------------------------------------------

# 15. Accessibility ва Readability

-   контрасти матн;
-   Dynamic Type;
-   TalkBack;
-   keyboard navigation;
-   focus states;
-   screen reader labels;
-   Reduce Motion;
-   touch targets-и мувофиқ;
-   RTL;
-   fallback барои шрифтҳо.

Liquid Glass набояд хонданбобиро вайрон кунад. Агар пасзамина серҳаракат
бошад, сатҳи матн opaque ё камшаффоф карда шавад.

------------------------------------------------------------------------

# 16. Меъёрҳои қабули дизайн

Дизайн танҳо вақте қабул мешавад, ки:

1.  Ҳамаи ҳашт экран сохта шудаанд.
2.  Ҳамаи экранҳо Design System-и ягона доранд.
3.  Android ва Web интерфейси мувофиқи платформа доранд.
4.  Матнҳои UI кӯтоҳ ва дақиқанд.
5.  Help icon-и `!` дар ҷойҳои зарурӣ кор мекунад.
6.  Help text аз CMS идора мешавад.
7.  Asset provenance сабт шудааст.
8.  Гулҳо ва объектҳо ҳаҷм ва сояи воқеинамо доранд.
9.  Overlap ба матн халал намерасонад.
10. Bottom Navigation Glass воқеан кор мекунад.
11. Glass танҳо CSS blur нест.
12. Refraction ва reflection санҷида шудаанд.
13. Cracked Glass ба sticker монанд нест.
14. Light/Dark/System кор мекунад.
15. Reduce Motion кор мекунад.
16. Ҳамаи тугмаҳо амали воқеӣ доранд.
17. Loading/Error/Empty State мавҷуданд.
18. Маълумоти сохта дар Production истифода намешавад.

------------------------------------------------------------------------

# 17. Санҷиши ҳатмии Full Text Editor

End-to-End санҷиш:

1.  Admin ворид мешавад.
2.  «Маърифати динӣ»-ро интихоб мекунад.
3.  Курс ва модулро мекушояд.
4.  Мавзӯъ ва дарс месозад.
5.  Сарлавҳа ва Lead Text ворид мекунад.
6.  Параграф илова мекунад.
7.  Important block бо акценти champagne мегузорад.
8.  Расми воқеиро байни параграфҳо ҷойгир мекунад.
9.  Caption илова мекунад.
10. Видео мегузорад.
11. Аудио илова мекунад.
12. Note ё Warning илова мекунад.
13. Иқтибос ва манбаъ ворид мекунад.
14. Блокҳоро drag-and-drop мекунад.
15. Preview-и Mobile ва Web-ро мебинад.
16. Draft-ро нигоҳ медорад.
17. Reviewer тасдиқ мекунад.
18. Admin Publish мекунад.
19. Дарс дар Android ва Web намоён мешавад.
20. Admin расм ё видеоро иваз мекунад.
21. Версияи нав дар Android ва Web дастрас мешавад.
22. Revision History тағйиротро нишон медиҳад.

Агар ин раванд бе навиштани код аз ҷониби соҳиби маҳсулот иҷро нашавад,
Full Text Editor анҷомёфта ҳисобида намешавад.

------------------------------------------------------------------------

# 18. Тартиби иҷро ба AI Agent

## Марҳилаи 1 --- Таҳлил

1.  Ҳар се Reference Image-ро омӯз.
2.  Design Tokens-ро барор.
3.  Typography ва Icon System-ро муайян кун.
4.  Component Inventory соз.
5.  Ҳашт экранро дар як Design System тарҳрезӣ кун.
6.  Барои Real 3D Glass technical proof-of-concept соз.
7.  Барои Full Text Editor technical proof-of-concept соз.

## Марҳилаи 2 --- Тасдиқи сифат

Пеш аз сохтани тамоми система ин қисмҳоро пурра соз ва санҷ: - Home
screen; - Course screen; - Lesson Reader; - Bottom Navigation Glass; -
Cracked Glass sample; - Full Text Editor.

Ин марҳила барои санҷиши самт аст, на маҳсулоти анҷомёфта.

## Марҳилаи 3 --- Татбиқи пурра

-   Design System;
-   ҳамаи экранҳо;
-   CMS;
-   Backend;
-   Android;
-   Web;
-   Media Library;
-   Rich Text Editor;
-   authentication;
-   access control;
-   tests;
-   deployment.

## Қоидаҳои қатъӣ

-   Reference-ҳоро ҳамчун screenshot-и статикӣ нусхабардорӣ накун.
-   Матни дарозу таблиғотиро ба UI нагузор.
-   Барои шарҳ аз `!` ва popover истифода бар.
-   Муҳаррирро ба Textarea маҳдуд накун.
-   Расмро танҳо ба Cover маҳдуд накун.
-   CSS Blur-ро Real 3D Glass наном.
-   AI-generated visual-ро ҳамчун акс ё модели воқеӣ муаррифӣ накун.
-   Asset-и бе иҷозатнома истифода накун.
-   Тугмаи бе амал нагузор.
-   Бе тест feature-ро анҷомёфта эълон накун.
-   Маҳдудиятҳоро пинҳон накун.

## Ҳисоботи ҳар марҳила

Нишон деҳ: - чӣ сохта шуд; - кадом экранҳо омодаанд; - кадом API ва
Database functionality кор мекунад; - манбаи Asset-ҳо; - Glass дар кадом
дастгоҳҳо санҷида шуд; - Editor кадом блокҳоро дастгирӣ мекунад; - кадом
тестҳо гузаштанд; - чӣ боқӣ мондааст.

------------------------------------------------------------------------

# 19. Қарори ниҳоии соҳиби маҳсулот

«Духтари хубам» бояд аз ҷиҳати визуалӣ ба Reference Images пайравӣ
кунад, аммо ҳамчун маҳсулоти воқеӣ, интерактивӣ ва Production-grade
сохта шавад.

Интерфейс: - ултраминималистӣ; - бо шишаи воқеинамо ва объектҳои 3D; -
бо аксҳо ва Asset-ҳои воқеӣ; - бо гулҳои табиӣ ва композицияи
назоратшуда; - бо матнҳои кӯтоҳ, ҷиддӣ ва дақиқ; - бо шарҳҳои пинҳон дар
popover-и `!`; - бо муҳаррири пурраи визуалии мундариҷа бошад.

Соҳиби маҳсулот набояд барои сохтани дарс, ҷойгир кардани расм, илова
кардани видео, тағйири ранг ё форматонӣ код нависад. Ҳамаи ин амалҳо
бояд аз Admin Panel иҷро шаванд.

**Reference Images = Design Direction.\
Design System = Қоидаи ягонаи визуалӣ.\
Admin Panel = Идоракунии пурраи мундариҷа.\
Backend = Манбаи ягонаи маълумот.\
Android + Web = Маҳсулоти воқеии коркунанда.**


---

# ҚИСМИ III — MANUAL QUIZ BUILDER: ИДОРАКУНИИ ДАСТИИ ТЕСТҲО

Ин қисм талаботи ҳатмии функсионалӣ мебошад. Quiz Builder бояд ҳамчун модули пурраи Admin Panel сохта шавад, на ҳамчун якчанд майдони оддии матн.

## QZ-01. Принсипи дастӣ сохтани тест

1. Ҳар тестро соҳиби маҳсулот ё муаллифи ваколатдор дастӣ месозад.
2. Ҳар савол, матни савол, вариантҳо, ҷавоби дуруст, шарҳи ҷавоб, хол ва тартиб дастӣ ворид ё интихоб мешаванд.
3. Агент набояд саволҳо ё ҷавобҳоро ба таври худкор ихтироъ кунад.
4. AI quiz generation, auto-answer generation ва auto-correction ҳамчун хусусияти фаъол насб нашавад.
5. Агар дар оянда чунин хусусият талаб шавад, он бояд ҷудогона, ғайрифаъол бо default ва танҳо баъд аз иҷозати соҳиби маҳсулот таҳия шавад.
6. Система метавонад validation-и сохториро автоматӣ иҷро кунад, масалан тафтиш кунад, ки савол холӣ нест ё single-choice як ҷавоби дуруст дорад. Ин санҷиши техникӣ аст, на эҷоди мундариҷа.

## QZ-02. Иерархияи тест

Сохтори асосӣ:

```text
Мактаб
  └── Курс
       └── Модул
            └── Мавзӯъ
                 └── Тест / Quiz
                      ├── Қисм / Section (ихтиёрӣ)
                      └── Саволҳо
                           ├── Вариантҳо
                           ├── Ҷавоби дуруст
                           ├── Шарҳи ҷавоб
                           ├── Хол
                           └── Media (ихтиёрӣ)
```

Тест метавонад мустақим ба модул ё мавзӯъ пайваст шавад. Тестҳои мустақил низ бояд дастгирӣ шаванд.

## QZ-03. Рӯйхати тестҳо дар Admin Panel

Барои ҳар тест нишон дода шавад:
- номи тест;
- мактаб / курс / модул / мавзӯъ;
- забон;
- шумораи саволҳо;
- ҳолат: Draft, Review, Scheduled, Published, Archived;
- санаи охирин тағйир;
- муаллиф;
- шумораи гузаронидани тест, агар омор фаъол бошад.

Функсияҳо:
- Create;
- Edit;
- Duplicate;
- Preview;
- Publish;
- Unpublish;
- Archive;
- Delete бо тасдиқ;
- Search;
- Filter;
- Reorder.

## QZ-04. Эҷоди тест

Admin ҳангоми сохтани тест майдонҳои зеринро идора мекунад:
- номи тест;
- тавсифи кӯтоҳ (ихтиёрӣ);
- мактаб;
- курс;
- модул;
- мавзӯъ;
- забон;
- cover/thumbnail (ихтиёрӣ);
- дастурамали кӯтоҳ барои хонанда (ихтиёрӣ);
- тартиби намоиш;
- холҳои умумӣ (ҳисобшаванда ё танзимшаванда);
- меъёри гузариш;
- вақти иҷозатдодашуда (ихтиёрӣ);
- шумораи кӯшишҳо;
- имкони такрор;
- тартиби саволҳо;
- тартиби вариантҳо;
- кай нишон додани ҷавоби дуруст;
- кай нишон додани шарҳи ҷавоб;
- дастрасии Free/Premium;
- вақти нашр ва ҳолати намоёнӣ.

Ҳамаи майдонҳои ихтиёрӣ бояд воқеан ихтиёрӣ бошанд. Вақтсанҷ ё маҳдудияти кӯшишро бе зарурат фаъол накун.

## QZ-05. Навъҳои савол

Quiz Builder бояд навъҳои зеринро дастгирӣ кунад. Ҳама саволҳо дастӣ сохта мешаванд.

### A. Single Choice
- як ҷавоби дуруст;
- одатан 2–6 вариант, default 4;
- Admin варианти дурустро бо checkbox/radio муайян мекунад;
- система санҷад, ки танҳо як ҷавоб дуруст аст.

### B. Multiple Choice
- ду ё зиёда ҷавоби дуруст;
- Admin ҳамаи ҷавобҳои дурустро алоҳида интихоб мекунад;
- тарзи баҳогузорӣ бояд танзимшаванда бошад: all-or-nothing ё partial credit, агар иҷозат дода шавад;
- сиёсати холдиҳӣ барои хонанда пешакӣ равшан бошад.

### C. True / False
- изҳороти пурра;
- ду вариант: Дуруст / Нодуруст;
- Admin ҷавоби воқеии дурустро интихоб мекунад;
- шарҳи ҷавоб метавонад барои ҳар ду натиҷа ворид шавад.

### D. Image Question
- савол метавонад расм ё диаграмма дошта бошад;
- расм метавонад пеш аз матн, байни матн ё дар қисми алоҳида бошад;
- Admin расмро аз Media Library интихоб ё бор мекунад;
- Alt text ҳатмӣ бошад;
- савол бояд бе тасвир ҳам агар мумкин бошад, фаҳмо бошад, вале агар тасвир қисми зарурии масъала бошад, онро ҳамчун required asset қайд кунад.

### E. Matching
- ҷуфтҳои мувофиқсозӣ;
- Admin тарафи A ва тарафи B-ро дастӣ ворид мекунад;
- тартиби пешниҳоди ҷуфтҳо идорашаванда бошад;
- ҷавоби дуруст бо mapping-и дақиқ сабт шавад.

### F. Ordering
- рӯйхати элементҳо;
- Admin тартиби дурустро дастӣ муайян мекунад;
- хонанда онҳоро ба тартиби дуруст мегузорад;
- система тартиби ҷавобро месанҷад.

### G. Short Answer
- ҷавоби кӯтоҳи воридшаванда;
- Admin ҷавоби интизоршаванда ё маҷмӯи ҷавобҳои қабулшавандаро дастӣ сабт мекунад;
- имкони case sensitivity, punctuation ва normalized comparison танзимшаванда бошад;
- ҷавобҳои озоде, ки автоматӣ ба таври боэътимод санҷида намешаванд, ба ҳолати manual review фиристода шаванд.

### H. Long / Written Response (ихтиёрӣ)
- хонанда ҷавоби матнии васеъ ворид мекунад;
- Admin меъёри баҳогузорӣ / rubric-ро дастӣ ворид мекунад;
- натиҷа аз ҷониби reviewer ё муаллифи ваколатдор санҷида мешавад;
- система онро худсарона дуруст/нодуруст эълон намекунад.

## QZ-06. Муҳаррири ҳар як савол

Ҳар савол бояд дар муҳаррири алоҳида таҳрир шавад ва дорои ин майдонҳо бошад:
- Question Type;
- Question Text;
- Rich Text formatting;
- attached Image / Diagram (ихтиёрӣ);
- audio/video reference (ихтиёрӣ, агар сенария талаб кунад);
- Answer Options ё Matching Items;
- Correct Answer(s);
- Points;
- Feedback / Explanation;
- Hint (ихтиёрӣ);
- Question Order;
- Required/Optional flag, агар дар сохтори тест дастгирӣ шавад;
- Visibility;
- Language;
- Revision History.

Admin бояд тавонад саволро duplicate кунад, вале нусха мустақил бошад ва тағйири он аслиро тағйир надиҳад.

## QZ-07. Вариантҳои ҷавоб

Барои ҳар вариант:
- матни вариант;
- расм (ихтиёрӣ);
- тартиб;
- нишон додани ҷавоби дуруст/нодуруст дар Admin Preview;
- шарҳи алоҳида (ихтиёрӣ ё ҳатмӣ мувофиқи навъи тест);
- фаъол/ғайрифаъол.

Дар Single Choice система бояд аз нашр пешгирӣ кунад, агар сифр ё зиёда аз як ҷавоби дуруст интихоб шуда бошад.
Дар Multiple Choice бояд ҳадди ақал ду ҷавоби дуруст ва ҳадди ақал як ҷавоби нодуруст бошад, агар конфигуратсияи савол чунин меъёрро талаб кунад.

## QZ-08. Холдиҳӣ ва баҳогузорӣ

Admin бояд муайян кунад:
- хол барои ҳар савол;
- холҳои умумӣ;
- хол барои ҷавоби қисман дуруст (барои Multiple Choice, агар фаъол бошад);
- penalty (бо default-и хомӯш);
- меъёри гузариш;
- қоидаи rounding;
- чӣ гуна саволи manual review ҳисоб карда мешавад.

Ҳисоб бояд дар Backend анҷом шавад. Натиҷаи ҳисобшудаи Frontend ҳамчун манбаи ҳақиқат қабул нашавад.

## QZ-09. Feedback ва шарҳи ҷавоб

Admin метавонад барои ҳар савол ворид кунад:
- шарҳи ҷавоби дуруст;
- шарҳи ҷавоби нодуруст;
- шарҳи ҳар варианти алоҳида;
- матни пас аз анҷоми тест;
- пайванди дарси марбут.

Система шарҳҳоро танҳо мувофиқи сиёсати тест нишон диҳад: фавран пас аз ҷавоб, баъд аз савол, ё танҳо баъди анҷоми тест.

## QZ-10. Савол бо тасвир ва расона

- Image upload/selection аз Media Library;
- crop ва focal point;
- alt text;
- caption;
- zoom/lightbox, агар мувофиқ бошад;
- санҷиши asset-и гумшуда;
- иҷозати истифодаи Asset;
- оптимизатсияи файл.

Агар савол ба диаграмма ё расми муайян такя кунад, система пеш аз Publish мавҷудияти онро санҷад.

## QZ-11. Тартиб ва омехтакунии саволҳо

Admin метавонад интихоб кунад:
- тартиби собит;
- омехтакунии саволҳо;
- омехтакунии вариантҳо;
- гурӯҳбандӣ ба Section;
- тартиби дохили Section.

Агар савол дорои тартиби мантиқии ҳатмӣ бошад, онро аз shuffle хориҷ кардан мумкин бошад.

Shuffle бояд танҳо дар вақти намоиш рӯй диҳад ва натиҷаи ҷавобҳо ба ID-и савол/вариант пайваст бошад, на ба ҷойи визуалии он.

## QZ-12. Preview-и тест

Admin бояд тестро ҳамчун хонанда Preview кунад:
- Mobile Preview;
- Web Preview;
- Light Mode;
- Dark Mode;
- забон;
- ҳамаи навъҳои савол;
- ҷавоби интихобшуда;
- ҳолати submit;
- натиҷа ва feedback.

Preview набояд натиҷаи воқеии корбарро вайрон кунад ё дар омори Production сабт шавад.

## QZ-13. Publish validation

Пеш аз Publish система бояд санҷад:
- тест унвон дорад;
- ақаллан як савол дорад;
- саволҳои ҳатмӣ матн доранд;
- навъи савол муайян аст;
- ҷавобҳо пурраанд;
- ҷавоби дуруст дуруст таъин шудааст;
- холҳо мантиқӣ мебошанд;
- расмҳои required мавҷуданд;
- тарҷумаи забони нашршаванда пурра аст;
- пайванди мактаб/курс/мавзӯъ дуруст аст.

Validation-и техникӣ набояд матни савол ё ҷавобро аз номи муаллиф тағйир диҳад.

## QZ-14. Натиҷаи хонанда

Натиҷаи тест метавонад нишон диҳад:
- хол гирифташуда;
- холҳои имконпазир;
- фоиз;
- ҳолати гузашт/нагузашт;
- вақти сарфшуда, агар вақтсанҷ фаъол бошад;
- саволҳои дуруст/нодуруст;
- шарҳҳо, мувофиқи танзимоти тест;
- имкони такрор, агар фаъол бошад.

Натиҷаи шахсӣ танҳо ба худи корбар ва нақшҳои ваколатдор дастрас бошад.

## QZ-15. Attempt Management

Ҳар кӯшиш бояд сабт кунад:
- User ID;
- Quiz ID ва Version ID;
- Start time;
- Submit time;
- Answer payload;
- Score;
- Status;
- Duration;
- Manual review status, агар лозим бошад.

Агар тест ҳангоми кӯшиши фаъол тағйир дода шавад, кӯшиши оғозшуда бояд ба версияи муайяни тест пайваст монад. Тағйири нашршуда набояд ҷавобҳои кӯшиши қаблиро вайрон кунад.

## QZ-16. Дастрасӣ ва амният

- ҷавобҳои дуруст пеш аз submit ба API-и корбар фиристода нашаванд;
- score ва validation дар Backend ҳисоб шаванд;
- корбар натиҷаи дигаронро дида натавонад;
- premium access дар Backend санҷида шавад;
- rate limiting ва ҳимояи endpoint-ҳо татбиқ шавад;
- Admin-и бе иҷозат тест ё answer key-ро тағйир дода натавонад.

## QZ-17. Quiz Analytics

Омори иҷозатдодашуда:
- шумораи кӯшишҳо;
- completion rate;
- миёнаи хол;
- саволҳои бештар хато шуда;
- тақсимоти натиҷаҳо;
- вақти миёна;
- суръати гузариш.

Омор набояд барои шарманда кардан ё муқоисаи зараровари хонандагон истифода шавад. Маълумоти шахсӣ танҳо барои нақшҳои ваколатдор дастрас бошад.

## QZ-18. Тарҷумаи тест

Ҳар версияи забонӣ мустақил бошад:
- номи тест;
- дастурамал;
- матни савол;
- вариантҳо;
- feedback;
- hint;
- caption ва alt text.

Admin бояд ҳолати тарҷумаи ҳар забонро бинад. Як забон метавонад Published бошад, забони дигар Draft бимонад.

## QZ-19. Меъёрҳои қабули Quiz Builder

Quiz Builder танҳо вақте анҷомёфта аст, ки соҳиби маҳсулот тавонад бе код:
1. Тест созад.
2. Ба он савол илова кунад.
3. Навъи саволро интихоб кунад.
4. Саволро дастӣ нависад.
5. Вариантҳоро дастӣ ворид кунад.
6. Ҷавоби дурустро дастӣ интихоб кунад.
7. Хол таъин кунад.
8. Шарҳи ҷавоб ворид кунад.
9. Ба савол расм пайваст кунад.
10. Саволҳоро ҷойиваз кунад.
11. Тестро Preview кунад.
12. Publish кунад.
13. Тестро дар Android ва Web гузаронад.
14. Натиҷаро бинад.
15. Савол ё ҷавобро таҳрир карда версияи нав нашр кунад.

Ҳамаи ин амалҳо бояд бе навиштани код аз тарафи соҳиби маҳсулот иҷро шаванд.

---

# ҚИСМИ IV — НАЗОРАТИ СИФАТ, QA ВА ҚАБУЛИ МАҲСУЛОТ

## 1. Санҷишҳои нармафзор

AI Agent бояд худи нармафзорро санҷад. Ин вазифа аз Quiz-и таълимӣ ҷудо аст.

Талабот:
- Backend unit tests;
- API integration tests;
- authorization tests;
- database migration tests;
- media upload tests;
- content lifecycle tests;
- quiz grading tests;
- Android UI/integration tests;
- Web component/integration tests;
- end-to-end tests;
- accessibility tests;
- performance tests;
- security checks.

## 2. End-to-End Acceptance Scenario: Content

1. Admin ворид мешавад.
2. Мактаб интихоб мекунад.
3. Курс, модул, мавзӯъ ва дарс месозад.
4. Матн ва сарлавҳа мегузорад.
5. Расмро байни ду параграф ҷойгир мекунад.
6. Callout-и муҳимро бо ранги champagne интихоб мекунад.
7. Видео ва аудио илова мекунад.
8. Preview мекунад.
9. Publish мекунад.
10. Дарс дар Android ва Web намоён мешавад.
11. Admin видеоро иваз мекунад.
12. Версияи нав бе rebuild дар ҳар ду платформа намоён мешавад.

## 3. End-to-End Acceptance Scenario: Manual Quiz

1. Admin ба Quiz Builder медарояд.
2. Тест месозад ва онро ба мавзӯъ пайваст мекунад.
3. Single Choice савол месозад.
4. Матни савол ва чор вариантро дастӣ ворид мекунад.
5. Як ҷавоби дурустро интихоб мекунад.
6. Хол ва шарҳи ҷавоб медиҳад.
7. Image Question месозад ва расми мувофиқ мегузорад.
8. Multiple Choice савол месозад ва ду ё зиёда ҷавоби дурустро интихоб мекунад.
9. True/False савол месозад.
10. Тартиби саволҳоро тағйир медиҳад.
11. Preview-и мобилӣ ва вебро мебинад.
12. Тестро Publish мекунад.
13. Хонанда тестро дар Android мегузаронад.
14. Хонанда тестро дар Web мегузаронад.
15. Backend холро дуруст ҳисоб мекунад.
16. Answer key то submit ба корбар фош намешавад.
17. Натиҷа ва feedback мувофиқи танзимот намоиш дода мешавад.
18. Admin омори кӯшишҳоро мебинад.
19. Admin тестро таҳрир мекунад ва версияи нав мебарорад.
20. Кӯшишҳои қаблӣ ба версияи пешина нигоҳ дошта мешаванд.

## 4. Visual Acceptance

- ҳашт экрани асосӣ ба Reference Design мувофиқанд;
- ҳамаи экранҳои боқимонда ҳамон Design System-ро истифода мебаранд;
- Light/Dark/System дурустанд;
- Typography барои се забон дуруст аст;
- RTL дуруст аст;
- Liquid Glass дорои refraction ва reflection-и санҷидашуда аст;
- cracked glass танҳо texture-и ороишӣ нест;
- аксҳо ва 3D Asset-ҳо provenance доранд;
- объектҳо метавонанд аз канори корт берун бароянд, аммо ба матн халал намерасонанд;
- UI text кӯтоҳ ва дақиқ аст;
- `!` popover кор мекунад;
- Full Text Editor ҳама блокҳои заруриро дастгирӣ мекунад.

---

# ҚИСМИ V — ТАРТИБИ ИҶРО ВА ҲИСОБОТИ AGENT

## Марҳилаи 1: Repository Audit ва Architecture

- ҳамаи файлҳои repository-ро тафтиш кун;
- технологияи мавҷударо муайян кун;
- код ва функсияҳои истифодашавандаро нигоҳ дор;
- duplicate ва dead code-ро муайян кун;
- Database ERD соз;
- API contract навис;
- backlog ва implementation plan пешниҳод кун.

## Марҳилаи 2: Design Proof of Concept

Пеш аз сохтани тамоми экранҳо инҳоро татбиқ ва санҷ:
- Home screen;
- Course screen;
- Lesson Reader;
- Bottom Navigation;
- Real 3D Glass sample;
- Cracked Glass sample;
- Full Text Editor sample;
- Manual Quiz Builder sample.

Ин марҳила prototype-и техникӣ барои санҷиш аст. Онро ҳамчун тамоми маҳсулоти тайёр эълон накун.

## Марҳилаи 3: Backend ва CMS

- authentication;
- RBAC;
- PostgreSQL;
- migrations;
- School/Course/Module/Topic/Lesson;
- block-based content;
- media library;
- Full Text Editor API;
- Quiz Builder API;
- attempts/grading;
- revision history;
- audit logs;
- publication workflow.

## Марҳилаи 4: Web

- public Web;
- responsive pages;
- lesson reader;
- quiz player;
- account/progress;
- Admin Panel;
- rich editor;
- media management;
- quiz authoring;
- API integration.

## Марҳилаи 5: Android Native

- Kotlin;
- Jetpack Compose;
- native navigation;
- content renderer;
- media playback;
- quiz player;
- local cache;
- offline-aware behavior;
- theme and accessibility.

## Марҳилаи 6: Security, QA ва Production

- security review;
- automated tests;
- end-to-end tests;
- performance profiling;
- backup/restore test;
- logging/monitoring;
- deployment configuration;
- signed Android release setup;
- Web production build.

## Ҳисоботи ҳатмии ҳар марҳила

Agent бояд дақиқ гузориш диҳад:
- чӣ сохта шуд;
- чӣ воқеан кор мекунад;
- чӣ санҷида шуд;
- кадом test-ҳо гузаштанд;
- кадом қисмҳо ҳанӯз mock ё placeholder мебошанд;
- кадом интегратсияҳо credential ё иҷозати беруна мехоҳанд;
- кадом масъалаҳо боқӣ мондаанд;
- чӣ Production Ready аст ва чӣ нест.

**Ҳеҷ гоҳ кори нотамомро ҳамчун кори анҷомёфта пешниҳод накун.**

---

# ҚИСМИ VI — МЕЪЁРҲОИ НИҲОИИ PRODUCTION READINESS

Маҳсулот танҳо баъди санҷиши воқеии ин шартҳо омода ҳисобида мешавад:

## Маҳсулот ва мундариҷа
- ҳафт мактаб идора мешаванд;
- курс, модул, мавзӯъ ва дарс динамикӣ мебошанд;
- Content Blocks бо тартиби дилхоҳ кор мекунанд;
- расм дар дохили дарс дар ҷойҳои гуногун ворид мешавад;
- видео ва аудио бор ва иваз мешаванд;
- Daily Inspiration ва notification идора мешаванд;
- тарҷумаҳо мустақиланд;
- Publish ва Revision History кор мекунанд.

## Quiz Builder
- ҳамаи тестҳо дастӣ эҷод мешаванд;
- саволҳо ва ҷавобҳо дастӣ ворид мешаванд;
- ҳамаи навъҳои муайяншуда кор мекунанд;
- ҷавоби дуруст ва хол дастӣ муайян мешаванд;
- шарҳи ҷавоб дастӣ навишта мешавад;
- расм ба савол пайваст мешавад;
- Preview ва Publish кор мекунанд;
- натиҷа дар Backend ҳисоб мешавад;
- answer key пеш аз submit фош намешавад;
- таҳрири тест версияҳои пешинаро вайрон намекунад.

## Visual Design
- се Reference Image ҳамчун Design Direction риоя шудаанд;
- ҳамаи саҳифаҳо ҳамон Design Language доранд;
- UI text кӯтоҳ ва ҷиддӣ аст;
- Real 3D Glass аз CSS Blur фарқ мекунад;
- Cracked Glass воқеинамо аст;
- Asset-ҳои визуалӣ воқеӣ/литсензиядор мебошанд;
- Full Text Editor визуалӣ ва пурра аст.

## Technical
- Android Native кор мекунад;
- Web кор мекунад;
- Admin Panel кор мекунад;
- Backend API кор мекунад;
- Database ва migrations дурустанд;
- Auth ва RBAC санҷида шудаанд;
- multilingual ва RTL кор мекунанд;
- offline/error/loading/empty states вуҷуд доранд;
- backup/restore санҷида шудааст;
- critical tests гузаштаанд;
- deployment documentation пурра аст.

---

# ҚАРОРИ НИҲОӢ

**Соҳиби маҳсулот дониш ва мундариҷаро месозад. Система бояд тамоми кори техникӣ, форматонӣ, ҷойгиркунии расонаҳо, нашр ва намоиши онро автоматӣ кунад.**

Соҳиб бояд танҳо:

`Admin Panel → Мактаб → Курс → Модул → Мавзӯъ → Дарс / Тест → Ворид кардани мундариҷа → Preview → Publish`

Ҳамаи натиҷаҳо бояд дар Android ва Web бо услуби ягона намоиш дода шаванд.

**Reference Images = Design Direction.**  
**Design System = Қоидаи ягонаи визуалӣ.**  
**Full Text Editor = Идоракунии визуалии дарсҳо.**  
**Manual Quiz Builder = Сохтани дастии ҳамаи тестҳо.**  
**CMS = Идоракунии пурраи мундариҷа.**  
**Backend = Манбаи ягонаи маълумот.**  
**Android + Web = Маҳсулоти воқеии коркунанда.**
