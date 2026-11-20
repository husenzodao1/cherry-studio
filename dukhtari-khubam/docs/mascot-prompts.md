# Промпт барои персонажи «Духтари хубам» — 14 расм

**Чӣ қадар расм лозим:** 14 адад — 12 эмотсия барои паёмҳо + 2 духтар барои экрани воридшавӣ.

**Тартиби кор (барои якхела баромадани персонаж):**
1. Аввал танҳо расми **01** -ро созед (ПРОМПТИ АСОСӢ + сатри 01).
2. Агар чеҳра ва ҳиҷоб маъқул шуд, ҳамон расми 01-ро ҳамчун **reference** замима кунед ва барои 02…13 ҳар дафъа нависед:
   `Use the attached image as the exact character reference — identical face, hijab, outfit, lighting and background. Change ONLY the pose and expression:` + ПРОМПТИ АСОСӢ + сатри рақам.
   - ChatGPT / Gemini: расмро замима кунед.
   - Midjourney: охири промпт `--cref <URL-и расми 01> --cw 100 --ar 3:4 --style raw`.
3. Расми **14** (дугонаи ӯ) — бе reference ба чеҳра, аммо бо ҳамон услуб (матнаш дар поён).
4. Агар асбоб **фони шаффоф (transparent PNG)** дода тавонад — шаффоф гиред. Агар не — фони якранги `#EBE3FA`; ман худам бурида, соя мегузорам.
5. Номи файлҳо: `mascot-01-ok.png` … `mascot-14-friend.png` (ҳамон номҳои поён). Андоза: 1536×2048 (3:4), PNG.

---

## ПРОМПТИ АСОСӢ (ба аввали ҳар расм нусха кунед)

```
Ultra-photorealistic professional studio portrait photograph. The SAME recurring character in every image.

CHARACTER: a beautiful young Tajik (Central Asian) woman, about 20 years old. Soft oval face, warm light-olive skin with natural real texture and fine pores (not airbrushed), large almond-shaped dark-brown eyes with natural lashes, softly arched naturally full dark eyebrows, small straight nose, gentle natural lips with a soft rose tint, minimal natural makeup, kind, calm and intelligent look. Modest and elegant. No hair visible at all.

HIJAB: smooth matte chiffon-jersey hijab in soft lilac (#B9A1F0), wrapped neatly and symmetrically around the face, pinned under the chin, fully covering hair, ears and neck, draping softly over the shoulders and upper chest in clean folds. One tiny round gold pin (#C9A15A) at the left side of the head. No other jewelry.

OUTFIT: modest loose long-sleeve blouse (abaya-style top) in warm ivory cream (#FBF7FF) with a thin deep plum (#5B3A9E) piping on the cuffs and neckline. No prints, no logos. Exactly the same hijab and outfit in every image.

FRAMING: vertical 3:4, 1536x2048 px, waist-up (from the top of the head down to the hips), body centered, empty margin of ~8% above the head, BOTH HANDS FULLY INSIDE THE FRAME, nothing cropped at the sides, eye-level camera.

BACKGROUND: one perfectly flat, seamless, uniform solid color #EBE3FA (soft lavender). No gradient, no texture, no vignette, no props, no floor, no shadow on the background. (If transparent background is supported: transparent PNG instead.)

LIGHT & CAMERA: large soft key light from front-left at 45 degrees, gentle fill from the right, subtle soft rim light from behind that separates the silhouette from the background; soft pastel color grade matching lavender, plum and cream tones; true-to-life skin. Full-frame camera, 85mm lens, f/5.6 — the whole person tack-sharp, including hijab edges and every finger (needed for a clean cut-out). 8K detail, high dynamic range.

HANDS: anatomically perfect, exactly five fingers on each hand, natural short nails, no rings.

AVOID: text, letters, numbers, watermark, logo, frame, border, cartoon, anime, illustration, 3D render, CGI look, plastic or waxy skin, heavy makeup, visible hair, earrings, extra or fused fingers, deformed hands, motion blur, depth-of-field blur on the body, background objects, different clothing colors, a different face.
```

---

## Сатрҳои эмотсия (баъди ПРОМПТИ АСОСӢ илова кунед)

| # | Файл | Кай нишон дода мешавад | Сатр барои промпт |
|---|------|------------------------|-------------------|
| 01 | `mascot-01-ok.png` | Воридшавӣ ба барнома: «Имрӯз омодаед, то хонишро оғоз кунем?» | `POSE & EMOTION: warm confident smile, looking straight into the camera, head tilted slightly; right hand raised beside the face at cheek height making a clear "OK" sign (thumb and index fingertip forming a neat circle, the other three fingers extended upward, palm facing the camera); left arm relaxed at her side.` |
| 02 | `mascot-02-wow.png` | Таъриф: «Хеле хуб, шумо ҳаракати олӣ доред» | `POSE & EMOTION: delighted joyful amazement — eyebrows raised, eyes wide and sparkling, mouth open in a happy "wow" smile; both open palms lifted near her cheeks (not touching the face), fingers relaxed; body leaning back very slightly, looking at the camera.` |
| 03 | `mascot-03-stop.png` | Пайдарпай хато: «Стоп, шумо пайдарпай хато мекунед» | `POSE & EMOTION: gentle but firm STOP gesture — right arm extended toward the camera at chest height, open palm facing the camera, all five fingers straight and together; left hand relaxed; caring, serious expression with a slight frown, closed lips, direct eye contact. Concerned teacher, NOT angry.` |
| 04 | `mascot-04-thumbs.png` | Дарс бомуваффақият тамом шуд | `POSE & EMOTION: proud bright smile showing teeth, right hand giving a clear thumbs-up at shoulder height (thumb pointing straight up, other fingers curled), left arm relaxed, looking at the camera.` |
| 05 | `mascot-05-think.png` | Ишора / «Бодиққат фикр кунед» | `POSE & EMOTION: thoughtful and curious — right index finger resting lightly on the chin, left arm folded under the right elbow, eyes looking up and to the left, small soft smile.` |
| 06 | `mascot-06-point.png` | Дарси нав / «Ба ин нигаред» | `POSE & EMOTION: cheerful and inviting — right arm raised, index finger pointing up and to the right toward the upper-right corner of the frame (hand fully inside the frame), looking at the camera with a friendly smile.` |
| 07 | `mascot-07-wave.png` | Салом / баргаштан баъди танаффус | `POSE & EMOTION: friendly greeting — right hand raised at head height, open palm facing the camera, waving; big warm smile with teeth, eyes slightly squinting from the smile.` |
| 08 | `mascot-08-yes.png` | Силсила (streak) / курс тамом шуд | `POSE & EMOTION: joyful laugh, both fists raised to shoulder height in a small "yes!" victory gesture, eyes half-closed from laughing, shoulders lifted with happiness.` |
| 09 | `mascot-09-book.png` | Ёдрасонии хониш | `POSE & EMOTION: holding a closed hardcover book with a plain deep-plum (#5B3A9E) cover (no text, no title) against her chest with both arms, soft serene smile, looking at the camera.` |
| 10 | `mascot-10-heart.png` | Дастгирӣ баъди нокомӣ: «Ҳеҷ гап не, боз кӯшиш кунед» | `POSE & EMOTION: gentle compassionate smile, right palm resting flat on her chest over the heart, left arm relaxed, head tilted slightly, kind understanding eyes looking at the camera.` |
| 11 | `mascot-11-clap.png` | Тест бе хато | `POSE & EMOTION: mid-applause — both hands meeting in front of the chest in a clap (fingers clearly visible and correct), happy open smile with teeth, looking at the camera.` |
| 12 | `mascot-12-cheer.png` | Пеш аз тест: «Шумо метавонед!» | `POSE & EMOTION: encouraging — both hands in front of the waist, palms open and turned slightly upward, a little apart (an inviting "you can do it" gesture), confident warm smile, leaning very slightly toward the camera.` |
| 13 | `mascot-13-left.png` | Экрани воридшавӣ — духтари тарафи **чап** | `FRAMING OVERRIDE: three-quarter body (top of head to mid-thigh). POSE & EMOTION: body turned about 30 degrees to HER LEFT (toward the right side of the image), face in three-quarter view looking softly toward the right edge of the frame, calm graceful smile; holding the same plain deep-plum book lightly against her chest with both hands.` |
| 14 | `mascot-14-friend.png` | Экрани воридшавӣ — духтари тарафи **рост** (дугонааш) | Дар ПРОМПТИ АСОСӢ ин ивазҳоро кунед: `CHARACTER: her best friend — a different beautiful young Tajik woman about 20, slightly rounder face, warm hazel-brown eyes, same natural style and skin realism.` `HIJAB: the same fabric and wrapping style in dusty rose (#ECC9E8), same tiny gold pin.` `OUTFIT: the same ivory cream blouse with thin rose (#D24C8F) piping.` Ва илова: `FRAMING OVERRIDE: three-quarter body (top of head to mid-thigh). POSE & EMOTION: body turned about 30 degrees to HER RIGHT (toward the left side of the image), face in three-quarter view looking softly toward the left edge of the frame, gentle smile, hands lightly clasped in front of the waist.` |

---

**Санҷиши ҳар расм пеш аз фиристодан:** чеҳра ҳамон аст · мӯй намоён нест · дар ҳар даст 5 ангушт · даст аз кадр берун нарафтааст · фон якранг ва бе соя · матн/watermark нест.
