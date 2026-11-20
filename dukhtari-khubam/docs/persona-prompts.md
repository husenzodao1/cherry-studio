# Персона: 26 эмотсия ва 12 объекти 3D (услуби реалии мултфилмӣ)

## Чӣ иваз мешавад

Ҳамаи суратҳои воқеии духтарак бо **як персонаж**-и мултфилмии реалистӣ иваз мешаванд. Ин ҳамон духтарак аст, ки дар `docs/start-girl-prompt.md` тасвир шудааст: чеҳра, ҳиҷоб ва рангҳояш як хел.

| Ҳоло (сурати воқеӣ) | Баъд (мултфилмӣ) |
|---|---|
| 12 расми паёмҳои духтарак (`01-ok` … `12-cheer`) | **26 эмотсия**: барои ҳар паём ва ҳар экран расми худаш (ҷадвали поён) |
| Ду духтари экрани воридшавӣ (`start-left`, `start-right`) | Як духтарак, вариантҳои A–E аз `start-girl-prompt.md` |
| Духтари саволномаи аввал (`welcome-girl`) | Эмотсияи **25** (бо оина) |
| Объектҳои шишагини чархзанандаи экрани воридшавӣ | **12 объекти 3D**-и мултфилмӣ, ки аз гирди духтарак мебароянд (қисми охир) |

Ҳамагӣ: **1** варақи персонаж + **26** эмотсия + **12** объект. Расмҳои экрани воридшавӣ (A–E) дар файли дигар ҳастанд.

---

## Тартиби кор (барои он ки чеҳра дар ҳамаи расмҳо як бошад)

1. **Аввал варақи персонаж** (`00-sheet.png`) созед: ПРОМПТИ АСОСӢ + сатри «Варақи персонаж» дар поён. Агар `girl-A.png` аллакай сохта шуда бошад ва маъқул бошад, ҳамонро ҳам замима кардан мумкин аст.
2. Барои **ҳар эмотсия** варақи персонажро замима кунед ва бо ин тартиб нависед:
   **сатри reference** + **ПРОМПТИ АСОСӢ** + **КАДРИ ПАЁМҲО** + сатри эмотсия аз ҷадвал.
3. Агар чеҳра дигар шуда бошад, ҳамон расмро аз нав созед. Чеҳраи дигар ба назар чунин менамояд, ки «духтари дигар» омадааст.
4. Фон шаффоф (PNG) бошад. Агар асбоб натавонад, фони якранги `#EBE3FA` гиред. Ман худам мебурам, сояро ба худи расм месозам ва ба WebP-и сабук мегардонам.
5. Номи файлҳо мисли ҷадвал бошад. Андоза: эмотсияҳо **1600×2000** (4:5) ё калонтар, объектҳо **1024×1024** ё калонтар.

**Сатри reference** (дар аввали ҳар промпти эмотсия):

```
Use the attached image as the exact character reference — identical face, eyes, skin tone, hijab, outfit, colours, proportions and rendering style. Same character, new expression and gesture only.
```

---

## ПРОМПТИ АСОСӢ (ҳамон персонаж)

```
A single adorable 3D animated character — premium animated feature-film quality, stylized realism: believable materials and lighting, slightly stylized proportions. Not a photo, not anime, not flat illustration, not a toy.

CHARACTER: a sweet Tajik (Central Asian) girl of about 15–16, warm and kind, gently confident. Soft rounded face, warm light-olive skin with subtle subsurface scattering and a natural rosy blush on the cheeks, large expressive almond-shaped dark-brown eyes with bright catch-lights and long natural lashes, softly arched dark eyebrows, small nose, expressive mouth. Delicate, modest, elegant. No hair visible at all.

HIJAB: soft matte lilac hijab (#B9A1F0) with subtle fabric folds and a faint satin sheen, wrapped neatly around the face and pinned under the chin, covering hair, ears and neck, draping over the shoulders. One tiny round gold pin (#C9A15A) at the side of the head.

OUTFIT: a modest loose long-sleeve blouse in warm ivory (#FBF7FF) with thin deep-plum (#5B3A9E) trim at the cuffs and neckline, and a delicate rose (#ECC9E8) accent (a small embroidered flower on the chest). Clean, simple, no logos, no text.

LOOK & LIGHT: soft cinematic studio lighting — large warm key light from the front-left, gentle lilac fill from the right, a soft rim light from behind outlining the hijab; smooth global illumination; pastel colour grade in lavender, rose, mint and cream that matches a soft lavender app interface. Crisp, clean edges on the whole silhouette (needed for a perfect cut-out). Ultra-detailed, 4K, high dynamic range.

BACKGROUND: transparent (PNG with alpha). If transparency is not possible: one perfectly flat, seamless solid colour #EBE3FA — no gradient, no texture, no floor, no shadow on the background.

HANDS: anatomically correct, exactly five fingers on each hand, soft rounded stylized fingers; any object she holds is held naturally and is fully inside the frame.

AVOID: text, letters, numbers, logos, watermark, frame, border, extra characters, background objects, confetti, visible hair, earrings, heavy makeup, extra or fused fingers, deformed hands, harsh shadows, blur on the character, photo-realistic skin pores, anime eyes, chibi proportions, plastic toy look.
```

### КАДРИ ПАЁМҲО (барои ҳамаи 26 эмотсия як хел)

```
FRAMING: waist-up, centred, facing the viewer (a slight turn is fine), vertical 4:5 frame. The top of the hijab sits about 6% below the top edge, the body is cut at the waist by the bottom edge; hands and any held object stay fully inside the frame. Same camera distance, height and size of the head in every image of the series.
```

### Варақи персонаж (`00-sheet.png`, танҳо барои reference)

```
CHARACTER SHEET: one wide 16:9 image on the flat background — the same girl standing full body in four views (front, three-quarter, side, back) with a calm friendly smile, plus three face close-ups along the right side: gentle smile, open happy laugh, surprised "wow". Identical design in every view. No text or labels.
```

---

## 26 эмотсия: дар куҷо ва чӣ гуна

★ = ҷои нав (ҳоло дар он ҷо духтарак нест; баъд аз расидани расмҳо ман худам мегузорам).

| # | Файл | Дар куҷо | Эмотсия | Сатр барои промпт |
|---|---|---|---|---|
| 1 | `01-salom.png` | Кушодани барнома, салом | Салом бо дасти рост бар дил | `EMOTION & GESTURE: respectful warm greeting — right hand placed flat on her heart, head bowed very slightly, warm closed-lip smile, eyes softly crinkled.` |
| 2 | `02-wave.png` | Баргашт пас аз 3+ рӯз | Шодии дидор | `EMOTION & GESTURE: delighted to see the viewer again — right hand raised high and waving, bright open smile, eyebrows lifted with joy.` |
| 3 | `03-wow.png` | Тест: 3 ҷавоби дуруст пайиҳам | Ҳайрат ва шодӣ | `EMOTION & GESTURE: amazed delight — both hands open near her cheeks, mouth in an open "wow" smile, eyes wide and sparkling.` |
| 4 | `04-stop.png` | Тест: 2 хато пайиҳам, «каме истед» | Ғамхорона «истед» | `EMOTION & GESTURE: gentle caring stop — right palm raised towards the viewer at chest height, kind half-smile, head slightly tilted, calm eyes ("let's pause and breathe").` |
| 5 | `05-clap.png` | Тест: 100% | Кафкӯбии шодмона | `EMOTION & GESTURE: joyful applause — clapping her hands in front of her chest, laughing with happily closed crescent eyes, cheeks extra rosy.` |
| 6 | `06-thumbs.png` | Тест гузашт | Офарин ва чашмакзанӣ | `EMOTION & GESTURE: proud approval — right thumb up at shoulder height, playful wink with her left eye, confident grin.` |
| 7 | `07-heart.png` | Тест нагузашт, тасаллӣ | Ҳамдардӣ, «ҳеҷ гап не» | `EMOTION & GESTURE: comforting empathy — holding a small soft rose-pink plush heart in both hands towards the viewer, gentle sympathetic smile, eyebrows slightly raised ("it's okay, we'll try again").` |
| 8 | `08-cheer.png` | Пеш аз тест | Рӯҳбаландкунӣ | `EMOTION & GESTURE: encouraging cheer — both fists raised at shoulder height, determined bright smile, focused eyes ("you can do it!").` |
| 9 | `09-ok-book.png` | Анҷоми дарс | Қаноатмандӣ | `EMOTION & GESTURE: satisfied pride — a closed deep-plum book (no text) held under her left arm, right hand making an "OK" sign, contented smile.` |
| 10 | `10-reading.png` | Анҷоми дарс (дигар) | Хониши шодмона | `EMOTION & GESTURE: happy reader — holding an open book with blank pages in both hands, looking up from it at the viewer with a soft smile.` |
| 11 | `11-think.png` | Такрор (саволҳои хато) | Андеша | `EMOTION & GESTURE: thoughtful — index finger touching her chin, eyes looking up and to the side, small curious smile.` |
| 12 | `12-point.png` | Оғози курс | «Рафтем!» | `EMOTION & GESTURE: excited "let's go" — pointing forward and slightly up with her right index finger, open excited smile, leaning slightly forward.` |
| 13 | `13-hooray.png` | Анҷоми марҳила | Ғалабаи калон | `EMOTION & GESTURE: big triumph — both arms raised high above her head, laughing with pure joy, eyes closed in happiness.` |
| 14 | `14-certificate.png` | ★ Экрани шаҳодатнома | Ифтихор | `EMOTION & GESTURE: beaming pride — holding a rolled ivory certificate scroll tied with a deep-plum ribbon and a small gold seal close to her chest, proud radiant smile.` |
| 15 | `15-star.png` | ★ Экрани баҳодиҳӣ | Умедворӣ | `EMOTION & GESTURE: hopeful — holding a shiny golden star in both hands in front of her chest, sweet hopeful smile, eyebrows slightly raised ("would you rate us?").` |
| 16 | `16-secret.png` | ★ Экрани пин-код | «Сирр», бозигарона | `EMOTION & GESTURE: playful secret — right index finger in front of her smiling closed lips ("shh"), left hand holding up a small golden key, mischievous sparkling eyes.` |
| 17 | `17-oops.png` | ★ Пин-коди хато | «Вой!» | `EMOTION & GESTURE: oops — fingertips of her right hand over her mouth, eyes wide, eyebrows raised, a little embarrassed but friendly.` |
| 18 | `18-calm.png` | ★ «Фаромӯш кардед?», саволҳои ҳаётӣ | Ором кардан | `EMOTION & GESTURE: reassuring calm — both hands open at chest height with palms up, calm warm smile, head tilted ("no worries, we'll get it back").` |
| 19 | `19-search.png` | ★ «Ҳеҷ чиз ёфт нашуд» | Ҷустуҷӯ | `EMOTION & GESTURE: curious search — holding a round gold-rimmed magnifying glass up to her right eye (the eye looks bigger through the lens), puzzled curious smile.` |
| 20 | `20-hourglass.png` | ★ Холӣ: курсҳо ҳоло нестанд | Интизории сабурона | `EMOTION & GESTURE: patient waiting — holding a small hourglass with lilac sand in both hands, calm patient smile ("coming soon").` |
| 21 | `21-offline.png` | ★ Интернет нест | Каме ғамгин | `EMOTION & GESTURE: no internet — holding a smartphone with a blank dark screen in her right hand and looking at it with a small sad pout, left hand palm up in a little shrug.` |
| 22 | `22-sorry.png` | ★ Хатогӣ рух дод | Узрхоҳӣ | `EMOTION & GESTURE: apologetic — palms pressed together in front of her chest in a polite "sorry" gesture, apologetic smile, eyebrows tilted up in the middle.` |
| 23 | `23-gift.png` | ★ Версияи нав | Тӯҳфаи ногаҳонӣ | `EMOTION & GESTURE: happy surprise — presenting a small lilac gift box with a deep-plum ribbon in both hands towards the viewer, excited smile.` |
| 24 | `24-bye.png` | ★ «Барои баромадан боз пахш кунед» | Хайрбод | `EMOTION & GESTURE: warm goodbye — waving softly with her right hand at face height, gentle smile, head tilted ("see you soon").` |
| 25 | `25-mirror.png` | Саволномаи аввал: «Кадом оинаҳоро…» | Кунҷковӣ | `EMOTION & GESTURE: curious and happy — holding a small oval golden hand mirror and looking into it with a delighted smile (the mirror shows only a soft lilac glow, no reflection detail).` |
| 26 | `26-preparing.png` | ★ «Дарсҳои шуморо омода мекунем» | Бо шавқ кор мекунад | `EMOTION & GESTURE: cheerful and busy — carefully stacking two small books (plum and mint, no text) in her hands, focused happy smile, tongue not shown.` |

**Тақсим:**
- Паёмҳои ҳозира: 1–13. Дар ҳар паём акнун 1–2 расми худаш ҳаст ва такрор кам мешавад.
- Экранҳо: 14–26. Духтарак дар онҳо ҳоло нест ва акнун пайдо мешавад.

---

## 12 объекти 3D барои экрани воридшавӣ

### Онҳо дар экран чӣ гуна рафтор мекунанд

- Вақте экран кушода мешавад, объектҳо **дар паси духтарак** пинҳон ҳастанд, хурд ва дар маркази ӯ.
- Сипас як-як (ҳар 0,12 сония) **аз гирди ӯ мебароянд** ва бо хати нарму каҷ ба ҷойҳои **тасодуфӣ** дар фазои атрофаш парвоз мекунанд.
- Ҳар бор, ки экран кушода мешавад, ҷойҳо нав мешаванд. Ягон объект рӯи чеҳраи духтарак, рӯи номи «Гулдухтар» ва рӯи тугмаҳо намеафтад. Объектҳо ҳамдигарро намепӯшонанд.
- **Чуқурӣ:**
  - Тақрибан 4-то **пеш аз** духтарак мемонанд: калонтар ва равшантар.
  - Боқимонда **дар паси ӯ**: хурдтар ва каме хирратар, мисли дур.
- Баъд онҳо дар фазо **шино мекунанд**: оҳиста боло-поён мешаванд, каме ба чапу рост хам мешаванд ва нарм «нафас мегиранд».
- Ин чархзании шишагини ҳозираро иваз мекунад. Барнома дар телефонҳои заиф ҳам сабуктар мешавад, чунки акнун танҳо расм ҳаст, на саҳнаи 3D-и зинда.

### ПРОМПТИ АСОСИИ ОБЪЕКТҲО

```
A single 3D object, premium animated feature-film quality, stylized realism — the same world and rendering style as a cute 3D animated film: soft rounded forms, believable materials (polished glass, satin metal, glossy ceramic, soft fabric), tiny bevels on every edge, delicate surface detail, subtle subsurface glow where light passes through.

PALETTE: soft lavender #B9A1F0, deep plum #5B3A9E, rose #F4A6C8, mint #94DCC6, warm gold #C9A15A, sky #A8C6FF, cream #FFF4E4 — pastel, harmonious, matches a soft lavender app interface.

CAMERA & LIGHT: three-quarter view from slightly above, the object centred and filling about 80% of a square 1:1 frame, nothing cropped. Soft cinematic studio light: warm key from the front-left, lilac fill from the right, a bright rim light outlining the silhouette; gentle specular highlights and clear reflections on glossy parts. Crisp clean silhouette for a perfect cut-out. Ultra-detailed, 4K.

BACKGROUND: transparent (PNG with alpha). If not possible: one perfectly flat seamless solid colour #EBE3FA — no floor, no cast shadow on the background, no gradient, no other objects.

AVOID: text, letters, numbers, calligraphy, logos, watermark, people, hands, faces on the object, cartoon outlines, flat illustration, harsh shadows, clutter.
```

### Объектҳо (ПРОМПТИ АСОСИИ ОБЪЕКТҲО + сатри объект)

| # | Файл | Объект | Маъно | Сатр барои промпт |
|---|---|---|---|---|
| 1 | `o01-book.png` | Китоби кушода | Дониш | `OBJECT: an open hardcover book with a lilac cover and gold corner caps, cream pages gently fanning upward, a deep-plum ribbon bookmark curling out — blank pages, no text.` |
| 2 | `o02-rehal.png` | Раҳл бо китоб | Дин | `OBJECT: a small carved wooden folding book stand (rehal) in warm honey wood with delicate geometric openwork, holding a closed book with a mint-green cover and gold ornamental corners — no text, no calligraphy.` |
| 3 | `o03-mosque.png` | Масҷиди хурд | Дин, фарҳанг | `OBJECT: a tiny elegant miniature mosque — cream walls with soft arches, one lilac glass dome with a small gold crescent finial and one slender minaret, sitting on a round mint base.` |
| 4 | `o04-heart.png` | Дил | Оила, меҳр | `OBJECT: a plump glossy heart made of translucent rose candy-glass, soft inner glow, tiny bright highlights.` |
| 5 | `o05-scales.png` | Тарозу | Ахлоқ, адолат | `OBJECT: a delicate balance scale in polished warm gold with two shallow lilac-glass pans, perfectly level, slender ornate stand.` |
| 6 | `o06-sprout.png` | Ниҳоли нав | Рушд | `OBJECT: a small round ivory ceramic pot with a thin plum band, a fresh mint-green sprout with two glossy leaves and a tiny third leaf unfolding.` |
| 7 | `o07-lantern.png` | Фонус | Нур, маърифат | `OBJECT: an eastern lantern (fanous) of satin gold metal with lilac and rose glass panels and filigree patterns, a warm soft candle glow inside, a small ring on top.` |
| 8 | `o08-chart.png` | Диаграммаи рушд | Пешрафт, замонавӣ | `OBJECT: three rounded glossy bars rising left to right in sky blue, lilac and mint on a small cream base, a smooth gold arrow curving upward above them — no numbers.` |
| 9 | `o09-tulip.png` | Лола | Духтарӣ, зебоӣ | `OBJECT: a single tulip made of translucent rose-to-lilac glass with a soft inner glow, a slim mint glass stem and one leaf.` |
| 10 | `o10-pomegranate.png` | Анор | Тоҷикистон, саломатӣ | `OBJECT: a ripe glossy pomegranate with a small crown, gently split open on one side showing jewel-like ruby seeds that catch the light.` |
| 11 | `o11-teapot.png` | Чойники чинӣ | Оила, меҳмоннавозӣ | `OBJECT: a traditional Central Asian porcelain teapot (choynak), glossy ivory with a fine lilac and gold cotton-boll pattern, gold rim and lid knob, a matching small tea bowl (piyola) beside it.` |
| 12 | `o12-crescent.png` | Ҳилол ва ситора | Шаб, орзу | `OBJECT: a soft glowing crescent moon in warm satin gold with a small five-pointed star hanging beside it, faint lilac glow around both.` |

**Санҷиши ҳар объект:** матн ва ҳарф нест; объект пурра дар кадр аст; канорҳо тозаанд; фон шаффоф ё якранг аст; рангҳо аз палитраи боло ҳастанд.

---

**Баъд аз фиристодани расмҳо:**
- Ман ҳамаашро мебурам, сабук мекунам ва ҳар эмотсияро ба ҷояш мегузорам.
- Объектҳоро дар экрани воридшавӣ бо ҳамон «баромадан аз гирди духтарак» месозам.
- Барои шумо версияи санҷишӣ мефиристам. Танҳо пас аз скриншот ва розигии шумо деплой мекунам.
