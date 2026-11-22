# Саҳнаҳои вақтии Маҳлиё — промптҳо

Панҷ саҳна, ки барнома вобаста ба вақти корбар нишон медиҳад. **Шаб — видео** (сохта шуд). **Чор саҳнаи дигар — расм**
(субҳ, наҳорӣ, пешин, шом). Промптҳо англисӣ ҳастанд, чунки генераторҳо (ChatGPT / gpt-image, Midjourney, Gemini ва ғ.)
онро беҳтар мефаҳманд. Ба ҳар промпт **расми персонаи Маҳлиё**-ро замима кунед.

## Вақтҳо (барнома худаш ҳисоб мекунад)

| Саҳна | Кай | Чӣ | Навишта мешавад |
| --- | --- | --- | --- |
| 1. Шаб | 22:00 – 05:00 | видео | «Шумо дар соати {соат} бедоред…» · «Барномаро пӯшидан ва хоб рафтан» · «Рад кардан» |
| 2. Субҳи барвақт | 05:00 – 07:40 | расм | «Дар саҳар дидани телефон ба мағзи шумо зарар мерасонад…» · «Барномаро пӯшидан» · «Давом додан» |
| 3. Наҳорӣ | 07:40 – 08:40 | расм | «Вақти наҳорист…» |
| 4. Хӯроки нисфирӯзӣ | 12:30 – 13:30 | расм | «Вақти хӯроки пешин…» |
| 5. Хӯроки шом | аз **ғуруби офтоб + 30 дақ** то **+90 дақ** | расм | «Вақти хӯроки шом…» |

- **Хӯроки шом** вақти доимӣ надорад: аз рӯи ғуруби офтоб дар ҷои корбар ҳисоб мешавад (агар иҷозат дода бошад —
  аз ҷойи тахминии телефон, вагарна Душанбе). Дар зимистон ғуруб барвақт аст (тақрибан 17:00 → хӯрок 17:30–18:30),
  дар тобистон дер (тақрибан 20:00 → 20:30–21:30).
- Ҳар саҳна дар як давра **як бор** нишон дода мешавад; «Рад кардан» / «Давом додан» онро то давраи навбатӣ мепӯшонад.
- Дар расмҳо эффектҳои хурд (☀️, буғи чой, ✨…) **накашед** — барнома онҳоро худаш бо ҳаракат болои расм мегузорад.

---

## 1. Шаб (22:00 – 05:00) — видео ✅ сохта шуд

Қисми умумии видео (дар аввали промпт гузошта мешуд):

```
REFERENCE: the attached image is "Mahliyo" — keep her EXACTLY (face, big kind eyes, soft 3D Pixar/Disney-style render,
lavender hijab, white long top and long skirt, same colours and proportions). She stays fully and modestly covered;
the hijab never slips. No other people.

FORMAT: 3D animated cartoon, 10 seconds, 24 fps, landscape 16:9 (1280×720), one continuous shot, static camera (at most a
very slow gentle push-in). Background: SOLID PURE CHROMA GREEN (#00FF00), flat and evenly lit, no shadows or gradients
on the green; only the props named below. Her whole body and every prop stay inside the frame with green margin on all
sides, her feet visible. Warm soft lighting on her, a gentle lavender rim light. Smooth, expressive, funny,
family-friendly animation with squash-and-stretch and clear cartoon timing.
The LAST 2 SECONDS are a calm, seamlessly loopable pose: only breathing, blinking and the small floating effect named
in the scene move.

NEGATIVE: no text or captions (except the floating symbols named), no logos, no watermark, no realistic horror, no injury
or pain, no green spill on her or the props, no camera cuts, no extra characters.
```

Промпти саҳна — «Маҳлиё хоб меравад»:

```
PROPS: a small cute lavender two-seat sofa (right half of the frame) with one round cushion; a tiny wooden shelf strip
above her head with three books.
ACTION:
0–2 s   she stands centre-left, extremely sleepy: eyelids half closed, head nodding down and snapping back up once.
2–3.5 s a HUGE slow yawn: both arms up in a long stretch, mouth wide open (cute), eyes squeezed shut, a tiny tear.
3.5–4.5 s her raised hand touches the shelf, one thick book wobbles and falls — BONK — onto her head and balances there;
        her eyes cross comically; three tiny stars and a little birdie circle spin around her head.
4.5–6 s she sways dizzily in a slow wobbly circle (spaghetti legs); the book slides onto the cushion.
6–7.5 s she tips over sideways like a falling tree onto the sofa — a soft cartoon "boing" — and lands curled up, cheek on
        the book like a pillow.
7.5–10 s (loop) fast asleep: peaceful smile, slow breathing, a little snore bubble grows and pops, floating "Z z z"
        letters with a small 💤 drift up above her head and fade.
SOUND (optional): a yawn, a comic wooden "bonk", a tiny "tweet-tweet", a springy "boing", a soft snore, a music-box lullaby.
```

---

## Расмҳо — қисми умумӣ (дар аввали ҳар промпти расм гузоред)

```
REFERENCE: the attached image is "Mahliyo" — keep her EXACTLY: same face, big kind eyes, soft 3D Pixar/Disney-style
render, lavender hijab, white long top and long skirt, same colours and proportions. She is fully and modestly covered;
the hijab covers all her hair and neck. No other people.

FORMAT: one still image, square 1:1, 1024×1024, 3D animated-film still (soft subsurface skin, gentle global
illumination, shallow depth of field on the props only). FULL BODY, she is centred and fills about 75% of the height,
feet visible, with empty margin on all sides — nothing touches the edges.
BACKGROUND: TRANSPARENT (PNG with alpha). If transparency is not possible: a SOLID PURE CHROMA GREEN #00FF00, flat,
evenly lit, with no shadows, gradients, floor or horizon line on it.
Only the props named below, small and cute, grouped close around her (a "diorama" with no room walls). A soft contact
shadow under her and the props only. Warm soft key light, a gentle lavender rim light on her outline. Clear, readable
silhouette and a happy, friendly, slightly funny expression — family-friendly.

NEGATIVE: no text, letters, numbers or captions; no logos, watermark or signature; no emoji or floating symbols, sparkles,
hearts, steam clouds, Z's or icons (the app adds them); no background scenery, room, sky or floor plane; no green
reflections or spill on her or the props; no cropped limbs; no extra characters; no realistic photo style.
```

---

## 2. Субҳи барвақт (05:00 – 07:40) — «Телефонро гузор, субҳро бубин»

```
SCENE: early morning, the moment she chooses the morning over the phone.
PROPS: a small lavender bed with a fluffy white pillow and a crumpled blanket behind her on the left; a tiny bedside table
on the right with a cute round pastel alarm clock and a smartphone lying FACE-DOWN on it; a small free-standing open
window frame on a little stand behind the table, pouring warm golden morning light onto her.
POSE: she sits on the edge of the bed in a big happy morning stretch — both arms up, fingers spread, eyes closed,
a wide relaxed smile, cheeks slightly pink; one slipper on, the other fallen comically on its side by her foot.
LIGHT: warm golden sunrise light from the window side, soft peach and cream tones, a pale lavender shadow side.
MOOD: fresh, calm, "good morning" — she has just put the phone away.
```

---

## 3. Наҳорӣ (07:40 – 08:40) — «Аввал наҳорӣ, баъд омӯзиш»

```
SCENE: breakfast — she has put her book aside to eat first.
PROPS: a small round lavender table and one chair; on the table a plate with a sunny-side-up egg and two slices of toast,
a cup of tea, a small bowl with a red apple and green grapes; a closed book with a bookmark pushed to the edge of the
table, a folded napkin.
POSE: she sits at the table holding a toast with one bite taken out of it, cheeks puffed cutely from chewing, eyes
happily squeezed into crescents, the other hand gently pushing the closed book away — "later!".
LIGHT: bright clean morning light from the left, warm cream and soft yellow tones, lavender shadows.
MOOD: cosy, cheerful, a little funny.
```

---

## 4. Хӯроки нисфирӯзӣ (12:30 – 13:30) — «Танаффус барои хӯрок»

```
SCENE: midday break — she has stopped studying to have lunch.
PROPS: on the left a small lavender desk with a CLOSED laptop, a neat stack of three notebooks and a pencil; on the
right a small round table with a bowl of warm soup and a spoon, a plate of fresh green salad, a round flat bread and a
glass of water. Her round glasses lie folded on top of the laptop.
POSE: she sits at the lunch table turned slightly towards the viewer, eyes closed, leaning a little over the soup bowl
and smelling it with a dreamy, blissful smile, both hands around the bowl; a pencil still tucked behind her ear (funny
detail).
LIGHT: bright, even daylight from above, fresh mint and cream accents with lavender.
MOOD: relieved, refreshed — "finally, a break".
```

---

## 5. Хӯроки шом (аз ғуруб + 30 дақ) — «Шоми оилавӣ»

```
SCENE: a calm evening meal after sunset, Central Asian home style.
PROPS: a small low wooden table (dastarkhan style) with a richly patterned table cloth; a white-and-blue cotton-pattern
teapot (traditional Central Asian "pakhta" pattern) with a small bowl-cup (piala), a plate of plov with carrots,
a round decorated flat bread (non), a small bowl of grapes and pomegranate; a warm little lamp on the table; a soft
floor cushion (kurpacha) she sits on. A smartphone lies face-down far at the edge of the cloth.
POSE: she sits cross-legged on the cushion holding the tea bowl in both hands near her chin, eyes half closed and
content, a soft warm smile, slightly tilted head.
LIGHT: warm golden lamp light on her face and the food, deep dusk-blue and violet tones on the shadow side, a gentle
lavender rim light.
MOOD: peaceful, warm, grateful, the end of the day.
```

---

## Пас аз сохтан

- **Расмҳо:** PNG-и шаффоф (ё бо фони сабз — фонаш бурида мешавад) фиристед. Ҳар расм дар саҳнаи худ бо фони зебо ва
  эффекти хурди ҳаракаткунанда (☀️, ☕, 🍲, 🌙…) нишон дода мешавад.
- Беҳтар аст 2–3 вариант созед ва якеро интихоб кунед, ки Маҳлиё бештар ба расми аслӣ монанд бошад.
