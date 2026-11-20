# Маҳлиё: 3 видео барои экрани воридшавӣ ва шиносоӣ

Персонажи мо акнун ном дорад: **Маҳлиё**, омӯзгори духтарон. Ӯ ҳамон духтарест, ки дар `persona-prompts.md` ва `start-girl-prompt.md` тасвир шудааст.

## Се саҳна дар барнома

| # | Видео | Кай | Дар экран чӣ мешавад |
|---|---|---|---|
| 1 | `v1-signin-loop.mp4` | Экрани воридшавӣ, **пеш** аз даромад | Маҳлиё аз мобайни экран нарм калон шуда пайдо мешавад. Объектҳои 3D аз гирди ӯ мебароянд. Ӯ китобро варақ мезанад, мепӯшад, ба мо нигоҳ карда табассум мекунад ва бо даст салом медиҳад. Баъд ба ҳолати аввал бармегардад ва ин бефосила такрор мешавад. |
| 2 | `v2-intro.mp4` | **Баъд** аз даромад, як бор барои духтари нав, пеш аз саволнома | Маҳлиё аз тарафи чап ба экран медарояд ва «гап мезанад». Дар тарафи росташ матн ҳарф ба ҳарф, бо суръати гуфтор пайдо мешавад. Пас аз матн тугмаи «Бале» мебарояд. То пахши он Маҳлиё ором интизор мешавад: охири видео нарм такрор мешавад. |
| 3 | `v3-yes-clap.mp4` | Пас аз пахши «Бале» | Маҳлиё бо хушнудӣ кафк мезанад. Баъд саҳифаи дигар, яъне саволномаи аввал, нарм кушода мешавад. |

**Матни шиносоӣ.** Ман онро дар барнома менависам, на дар видео, то ном дуруст ояд ва ба ҳамаи забонҳо тарҷума шавад:

> Салом, {ном}! Ман омӯзгори шумо — Маҳлиё. Дар ин ҷо шумо метавонед худро беҳтару хубтар ҳис кунед ва чизҳои нав омӯзед! Омодаед оғоз кунем?

Ислоҳҳои хурд: «инҷо» ба «ин ҷо» иваз шуд, пас аз «Салом» вергул омад ва пеш аз «Маҳлиё» тире гузошта шуд.

---

## Чӣ лозим аст (тартиби кор)

1. **Ду расми аввал** (кадри аввали видео):
   - `girl-A.png`: аз `start-girl-prompt.md`, духтарак бо китоб. Он кадри аввал ва охири **видеои 1** мешавад.
   - `intro.png`: расми нав, промпташ дар поён. Он кадри аввал ва охири **видеои 2** ва кадри аввали **видеои 3** мешавад.
2. Ин ду расмро ба ман фиристед. Ман онҳоро ба **фони сабзи хромакей** `#00B140` дар андозаи **1080×1920** мегузорам ва ҳамчун `f1-start.png` ва `f2-start.png` бармегардонам. Ин тавр Маҳлиё дар видео маҳз ҳамон духтари расмҳо мемонад.
   (Агар худатон кардан хоҳед: ҳамон промпти расм бо сатри `BACKGROUND: solid flat chroma-key green #00B140, no green light on the character`, кадри 9:16.)
3. Видеоҳоро дар асбобе созед, ки **кадри аввал ва кадри охир**-ро қабул мекунад (first frame + last frame), масалан Kling ё Veo. Танзимот дар назди ҳар видео навишта шудааст.
4. Се файли MP4-ро ба ман фиристед. Ман фони сабзро мебурам ва видеоро бо фони шаффоф ва ҳаҷми хурд месозам, то дар телефон зуд кушода шавад. Дар телефонҳое, ки видеои шаффофро намекашанд, расми оддӣ нишон дода мешавад.

**Чаро фони сабз?** Видеосозҳо фони шаффоф намедиҳанд. Ранги сабз дар либос ва ҳиҷоби Маҳлиё нест, бинобар ин онро тоза бурида мешавад. Объектҳои 3D дар пешу паси ӯ шино мекунанд, ҳамин сабаб фон бояд шаффоф шавад.

---

## Ду расми аввал: промпти пурра (нусха гиред ва истифода баред)

### 1. `girl-A.png`: Маҳлиё бо китоб

Ин расм дар экрани воридшавӣ гузошта мешавад ва кадри аввалу охири видеои 1 мешавад. Онро **аввал** созед.

```
A single adorable 3D animated character named Mahliyo — premium animated feature-film quality, stylized realism: believable materials and lighting, slightly stylized proportions. Not a photo, not anime, not flat illustration, not a toy.

CHARACTER: a sweet Tajik (Central Asian) girl of about 15–16, warm and kind, gently confident, with the calm, clever eyes of a young teacher. Soft rounded face, warm light-olive skin with subtle subsurface scattering and a natural rosy blush on the cheeks, large expressive almond-shaped dark-brown eyes with bright catch-lights and long natural lashes, softly arched dark eyebrows, small nose, small gentle closed-lip smile. Delicate, modest, elegant. No hair visible at all.

HIJAB: soft matte lilac hijab (#B9A1F0) with subtle fabric folds and a faint satin sheen, wrapped neatly around the face and pinned under the chin, covering hair, ears and neck, draping over the shoulders. One tiny round gold pin (#C9A15A) at the side of the head.

OUTFIT: a modest loose long-sleeve blouse in warm ivory (#FBF7FF) with thin deep-plum (#5B3A9E) trim at the cuffs and neckline, and a delicate rose (#ECC9E8) accent (a small embroidered flower on the chest). Clean, simple, no logos, no text.

POSE & FRAMING: waist-up, centred, facing the viewer with the body turned very slightly to her left, head tilted a touch; she holds a closed medium-size deep-plum hardcover book (cream page edges visible, no text on it) flat against her chest with both hands and smiles warmly at the viewer. Vertical 4:5 frame; the top of the hijab about 8% below the top edge, the body cut at the waist by the bottom edge; both hands and the whole book inside the frame, nothing cropped at the sides.

LOOK & LIGHT: soft cinematic studio lighting — large warm key light from the front-left, gentle lilac fill from the right, a soft rim light from behind outlining the hijab; smooth global illumination; pastel colour grade in lavender, rose and cream that matches a soft lavender app interface. Crisp, clean edges on the whole silhouette (needed for a perfect cut-out). Ultra-detailed, 4K, high dynamic range.

BACKGROUND: transparent (PNG with alpha). If transparency is not possible: one perfectly flat, seamless solid colour #EBE3FA — no gradient, no texture, no floor, no props, no shadow on the background.

HANDS: anatomically correct, exactly five fingers on each hand, soft rounded stylized fingers.

AVOID: text, letters, logos, watermark, frame, border, extra characters, background objects, visible hair, earrings, heavy makeup, extra or fused fingers, deformed hands, harsh shadows, blur on the character, photo-realistic skin pores, anime eyes, chibi proportions, plastic toy look.
```

### 2. `intro.png`: Маҳлиё барои шиносоӣ

Ин расм кадри аввалу охири видеои 2 ва кадри аввали видеои 3 мешавад. Расми `girl-A.png`-ро **замима кунед**, то чеҳра ҳамон бошад.

```
Use the attached image as the exact character reference — identical face, eyes, skin tone, hijab, outfit, colours, proportions and rendering style. Same character, new pose only.

A single adorable 3D animated character named Mahliyo — premium animated feature-film quality, stylized realism: believable materials and lighting, slightly stylized proportions. Not a photo, not anime, not flat illustration, not a toy.

CHARACTER: a sweet Tajik (Central Asian) girl of about 15–16, warm and kind, gently confident, with the calm, clever eyes of a young teacher. Soft rounded face, warm light-olive skin with subtle subsurface scattering and a natural rosy blush on the cheeks, large expressive almond-shaped dark-brown eyes with bright catch-lights and long natural lashes, softly arched dark eyebrows, small nose, small gentle closed-lip smile. Delicate, modest, elegant. No hair visible at all.

HIJAB: soft matte lilac hijab (#B9A1F0) with subtle fabric folds and a faint satin sheen, wrapped neatly around the face and pinned under the chin, covering hair, ears and neck, draping over the shoulders. One tiny round gold pin (#C9A15A) at the side of the head.

OUTFIT: a modest loose long-sleeve blouse in warm ivory (#FBF7FF) with thin deep-plum (#5B3A9E) trim at the cuffs and neckline, and a delicate rose (#ECC9E8) accent (a small embroidered flower on the chest). Clean, simple, no logos, no text.

POSE & FRAMING: waist-up, body turned about 20 degrees to HER LEFT (towards the right edge of the image) while her face looks at the viewer; hands relaxed and lightly clasped in front of her waist; a friendly, attentive closed-lip smile — a calm "I'm here, ready to talk to you" pose. Vertical 4:5 frame with exactly the same camera distance and head size as the reference image; the top of the hijab about 8% below the top edge, the body cut at the waist; she stands a little left of centre, leaving empty space on the right side of the image.

LOOK & LIGHT: soft cinematic studio lighting — large warm key light from the front-left, gentle lilac fill from the right, a soft rim light from behind outlining the hijab; smooth global illumination; pastel colour grade in lavender, rose and cream that matches a soft lavender app interface. Crisp, clean edges on the whole silhouette (needed for a perfect cut-out). Ultra-detailed, 4K, high dynamic range.

BACKGROUND: transparent (PNG with alpha). If transparency is not possible: one perfectly flat, seamless solid colour #EBE3FA — no gradient, no texture, no floor, no props, no shadow on the background.

HANDS: anatomically correct, exactly five fingers on each hand, soft rounded stylized fingers.

AVOID: text, letters, logos, watermark, frame, border, extra characters, background objects, visible hair, earrings, heavy makeup, extra or fused fingers, deformed hands, harsh shadows, blur on the character, photo-realistic skin pores, anime eyes, chibi proportions, plastic toy look.
```

**Санҷиш:**
- Чеҳра, ҳиҷоб ва либос дар ҳарду расм як хел ҳастанд.
- Андозаи сар дар ҳарду расм баробар аст.
- Мӯй намоён нест.
- Дар ҳар даст 5 ангушт аст.
- Дар китоб матн нест.

---

## ҚИСМИ УМУМӢ (ба ҳар се видео илова кунед)

```
STYLE: a shot from a premium 3D animated feature film. The character is EXACTLY the girl in the attached first-frame image — identical face, eyes, skin tone, lilac hijab, ivory blouse with plum trim, colours, rendering style and lighting — in every frame. Appealing film-quality character animation: clear anticipation and follow-through, gentle squash and stretch in the cheeks and smile, natural blinking, soft secondary motion in the hijab fabric and sleeves, smooth easing, nothing jerky or robotic. Expressive yet natural acting, like the sweet lead character of an animated movie.

CAMERA: locked-off static camera — absolutely no camera movement: no zoom, no pan, no tilt, no dolly, no cuts, no focus change. The character stays the same size and in the same place in the frame; only she moves.

BACKGROUND: solid flat chroma-key green #00B140, evenly lit and perfectly uniform for the whole clip — no shadows, no gradients, no floor, no objects, no particles, no light effects. No green light or reflection on the character; her lighting stays identical to the first frame. Crisp silhouette edges, minimal motion blur.

HANDS: exactly five fingers on each hand in every frame; hands never melt, merge or change shape; the book (when present) keeps its exact shape and size.

OUTPUT: 1080×1920 vertical (9:16), 24 fps, no audio, no music, no voice, no subtitles, no text.

AVOID: face morphing, changing outfit or hijab, visible hair, extra characters, text or letters anywhere (the book pages are blank), logos, watermark, camera shake, flicker, background colour change.
```

---

## Видеои 1: `v1-signin-loop.mp4` (экрани воридшавӣ, такрори бефосила)

**Танзимот:** кадри аввал `f1-start.png` · кадри охир **ҳамон** `f1-start.png` · 8 сония.

```
ACTION (8 seconds, a seamless loop — the last frame matches the first frame exactly):
0.0–0.8 s: she stands holding the closed deep-plum book against her chest with both hands, smiling at the viewer, breathing softly; then her eyes drop to the book.
0.8–1.6 s: she lowers the book to waist height and opens it with both hands.
1.6–3.6 s: she flips quickly through the pages with her thumb — the blank cream pages fan and flutter in a lively riffle — while she checks them with a cute concentrated look: lips pursed and pushed a little to one side, one eyebrow slightly raised, eyes scanning the pages.
3.6–4.3 s: she closes the book with both hands in one soft, satisfying motion and gives a tiny pleased nod.
4.3–5.0 s: she lifts her eyes to the viewer and a small warm smile grows on her face.
5.0–6.8 s: holding the book against her chest with her left arm, she raises her right hand to face height and waves hello two or three times — friendly, a little shy, head tilted slightly.
6.8–8.0 s: she lowers her right hand and returns smoothly to exactly the starting pose — the book against her chest in both hands, the same smile, the same gaze at the viewer.
```

**Дар барнома:**
- Маҳлиё аз мобайни экран хурд ба калон ва бо равшании нарм пайдо мешавад. Ин қисмро барнома месозад, то такрори видео тоза бошад.
- Ҳамзамон объектҳои 3D аз гирди ӯ мебароянд.

---

## Видеои 2: `v2-intro.mp4` (шиносоӣ, пас аз даромад)

**Танзимот:** кадри аввал `f2-start.png` · кадри охир **ҳамон** `f2-start.png` · 8 сония.

```
ACTION (8 seconds; she speaks silently to the viewer — the mouth moves naturally as if talking, no sound; the text she says is shown by the app on the right side of the image):
0.0–0.5 s: a tiny settling bounce as if she has just arrived, the hijab fabric swinging and settling; she looks at the viewer with bright eyes.
0.5–2.5 s: "Hello! I'm your teacher" — she gives a small quick wave with her right hand, then places it on her heart while she introduces herself, warm proud smile, a slight respectful nod.
2.5–5.5 s: "Here you can feel better and learn new things!" — she opens her right hand gracefully towards the right side of the image (where the text appears), palm up, an inspired, caring expression; she glances once at that side and back to the viewer.
5.5–6.8 s: "Ready to start?" — she leans forward slightly, eyebrows raised, an inviting hopeful smile, her head tilted a little.
6.8–8.0 s: she settles back into exactly the starting pose — hands lightly clasped in front of her waist, calm attentive smile, eyes on the viewer — and waits, breathing softly, with one natural blink. Very little movement in this last second.
```

**Дар барнома:**
- Маҳлиё аз тарафи чап ба экран медарояд ва дар тарафи росташ матн ҳарф ба ҳарф менависад. Ҳар ҷумла бо ишораи дасташ рост меояд.
- Пас аз матн тугмаи «Бале» мебарояд.
- То пахши тугма сонияи охир нарм такрор мешавад ва Маҳлиё «интизор аст».

---

## Видеои 3: `v3-yes-clap.mp4` (пас аз «Бале»)

**Танзимот:** кадри аввал `f2-start.png` · кадри охир озод · 5 сония.

```
ACTION (5 seconds; she has just heard "Yes!"):
0.0–0.4 s: her eyes light up, eyebrows lift, a joyful little gasp of delight.
0.4–2.8 s: she claps her hands happily four times in front of her chest, laughing with closed crescent eyes and extra rosy cheeks, her shoulders doing a small happy bounce, the hijab swaying with soft follow-through.
2.8–4.2 s: she clasps her hands together under her chin, beaming at the viewer, eyes sparkling with pride and joy.
4.2–5.0 s: she holds this happy pose, breathing softly — calm and still, ready for the next screen.
```

**Дар барнома:** пас аз кафкӯбӣ экран нарм иваз мешавад ва саволномаи аввал кушода мешавад.

---

**Санҷиши ҳар видео:**
- Чеҳра ва либос аз аввал то охир як хел мемонанд.
- Камера намеҷунбад.
- Фон як хел сабз аст.
- Дар саҳифаҳои китоб ва дар ҳеҷ ҷои дигар матн нест.
- Дар ҳар даст 5 ангушт аст.
- Дар видеои 1 кадри охир бо кадри аввал якест, яъне такрор «ҷаҳиш» надорад.
