# Экрани воридшавӣ: як духтарак (промпт ва вариантҳо)

## Чӣ мешавад

Ду духтари ҳозира (суратҳои воқеӣ) **як духтарак**-и мултфилмӣ иваз мешаванд: хеле ширин, вале реалистӣ. Тарзаш мисли қаҳрамони филми аниматсионии 3D-и баландсифат аст. Ҷои ӯ дар қисми болоии экрани воридшавӣ аст: дар пасзаминаи рангини ҳозира. Объектҳои 3D-и нав аз гирди ӯ мебароянд ва дар фазо ба ҷойҳои тасодуфӣ мераванд (промпташон дар `docs/persona-prompts.md`). Поёнаш ҳамон чиз мемонад: «Гулдухтар», шиор, тугмаи Google, почта, «Давом».

Барои ҳар вариант як расми ҷудо лозим аст, чунки ҳолат ва кадри духтарак дар ҳар вариант гуногун аст. **Ҳамагӣ 5 расм.** Ман ҳамаашро дар барнома мегузорам ва дар экрани воридшавӣ тугмачаи пинҳонии «A B C D E» месозам. Шумо ҳар вариантро мебинед, скриншот мефиристед ва беҳтаринашро интихоб мекунед. Боқимонда нест карда мешавад ва баъд деплой мекунем.

---

## Вариантҳо (ҷойгиршавӣ дар экран)

```
 A · Қаҳрамони марказӣ      B · Салом аз паҳлӯ       C · Дар болои китоб
 ┌──────────────┐           ┌──────────────┐          ┌──────────────┐
 │    ○ ◇ ○  🌐 │           │      ○ ◇  🌐 │          │   ○ ◇ ○   🌐 │
 │  ○  (^‿^)  ○ │           │ (^‿^)/   ◇   │          │    (^‿^)     │
 │   ◇ /|█|\ ◇  │           │ /|█|      ○  │          │   _/|█|\_    │
 │      Гулдухтар│          │   Гулдухтар  │          │  [▓ китоб ▓] │
 │  [ Google  ] │           │  [ Google  ] │          │   Гулдухтар  │
 │  [ почта   ] │           │  [ почта   ] │          │  [ Google  ] │
 └──────────────┘           └──────────────┘          └──────────────┘
 D · Аз паси корт            E · Дар доираи шишагин
 ┌──────────────┐           ┌──────────────┐
 │  ○ ◇ ○ ◇  🌐 │           │  ◇ ╭────╮ ○ 🌐│
 │   Гулдухтар  │           │ ○  │(^‿^)│ ◇  │
 │    (^‿^)     │           │    ╰────╯    │
 │ ┌─/█████\──┐ │           │   Гулдухтар  │
 │ │ [Google] │ │           │  [ Google  ] │
 │ │ [почта ] │ │           │  [ почта   ] │
 │ └──────────┘ │           └──────────────┘
 └──────────────┘
```

- **A · Қаҳрамони марказӣ.** Духтарак дар мобайн, то камар, рӯ ба мо, бо табассум. Объектҳои 3D аз гирди ӯ мебароянд ва дар фазо ҷой мегиранд. Аз ҳама «плакатӣ» ва тантанавӣ.
- **B · Салом аз паҳлӯ.** Духтарак дар тарафи чап аст ва ба тарафи рост дасташро барои салом мебардорад. Объектҳо аз паси ӯ мебароянд ва бештар ба тарафи рост, наздики дасташ мераванд. Аз ҳама зинда ва гарм.
- **C · Дар болои китоб.** Духтарак дар болои китоби бузурги шишагин нишастааст ва номи «Гулдухтар» зери китоб меояд. Аз ҳама «мултфилмӣ» ва ширин.
- **D · Аз паси корт.** Корти сафеди воридшавӣ (Google ва почта) дар поён аст. Духтарак аз паси он баромада, дастонашро болои канори корт гузоштааст. Ин ҳамон услуби паёмҳои духтарак дар дохили барнома аст, пас аз ҳама «бренди ягона».
- **E · Дар доираи шишагин.** Танҳо сар ва китфҳои ӯ дар доираи калони шишагин мисли аватари бузург. Объектҳо аз паси доира мебароянд ва дар гирдаш шино мекунанд. Аз ҳама ором ва минималӣ.

---

## Тартиби кор

1. Аввал **расми A**-ро бо ПРОМПТИ АСОСӢ ва сатри A созед.
2. Агар чеҳра маъқул шуд, расми A-ро ҳамчун **reference** замима кунед ва B, C, D ва E-ро созед. Барои ҳар кадом нависед:
   `Use the attached image as the exact character reference — identical face, hijab, outfit, colours and rendering style. Change ONLY the pose and framing:` + ПРОМПТИ АСОСӢ + сатри вариант.
3. Агар асбоб **фони шаффоф (transparent PNG)** дода тавонад, шаффоф гиред. Агар не, фони якранги `#EBE3FA`. Ман худам бурида, сояро ба худи расм месозам.
4. Номи файлҳо: `girl-A.png`, `girl-B.png`, `girl-C.png`, `girl-D.png`, `girl-E.png`. Андоза: 2048×2048 ё калонтар, PNG.

---

## ПРОМПТИ АСОСӢ

```
A single adorable 3D animated character — premium animated feature-film quality, stylized realism: believable materials and lighting, slightly stylized proportions. Not a photo, not anime, not flat illustration, not a toy.

CHARACTER: a sweet Tajik (Central Asian) girl of about 15–16, warm and kind, gently confident. Soft rounded face, warm light-olive skin with subtle subsurface scattering and a natural rosy blush on the cheeks, large expressive almond-shaped dark-brown eyes with bright catch-lights and long natural lashes, softly arched dark eyebrows, small nose, small gentle smile with closed lips (or a soft open smile when the pose says so). Delicate, modest, elegant. No hair visible at all.

HIJAB: soft matte lilac hijab (#B9A1F0) with subtle fabric folds and a faint satin sheen, wrapped neatly around the face and pinned under the chin, covering hair, ears and neck, draping over the shoulders. One tiny round gold pin (#C9A15A) at the side of the head.

OUTFIT: a modest loose long-sleeve blouse in warm ivory (#FBF7FF) with thin deep-plum (#5B3A9E) trim at the cuffs and neckline, and a delicate rose (#ECC9E8) accent (a small embroidered flower on the chest). Clean, simple, no logos, no text.

LOOK & LIGHT: soft cinematic studio lighting — large warm key light from the front-left, gentle lilac fill from the right, a soft rim light from behind outlining the hijab; smooth global illumination; pastel colour grade in lavender, rose, mint and cream that matches a soft lavender app interface. Crisp, clean edges on the whole silhouette (needed for a perfect cut-out). Ultra-detailed, 4K, high dynamic range.

BACKGROUND: transparent (PNG with alpha). If transparency is not possible: one perfectly flat, seamless solid colour #EBE3FA — no gradient, no texture, no floor, no props, no shadow on the background.

HANDS: anatomically correct, exactly five fingers on each hand, soft rounded stylized fingers.

AVOID: text, letters, logos, watermark, frame, border, extra characters, background objects (unless the variant line asks for one), visible hair, earrings, heavy makeup, extra or fused fingers, deformed hands, harsh shadows, blur on the character, photo-realistic skin pores, anime eyes, chibi proportions, plastic toy look.
```

---

## Сатрҳои вариантҳо (баъди ПРОМПТИ АСОСӢ илова кунед)

| Вариант | Файл | Сатр барои промпт |
|---|---|---|
| **A** | `girl-A.png` | `POSE & FRAMING: waist-up, centred, facing the camera with the body turned very slightly to her left, head tilted a touch; she holds a closed deep-plum book (no text) against her chest with both hands and smiles warmly at the viewer. Vertical 4:5 frame, empty margin of about 10% above the head, nothing cropped at the sides.` |
| **B** | `girl-B.png` | `POSE & FRAMING: three-quarter body (head to mid-thigh), body turned about 30 degrees to HER LEFT (towards the right edge of the image), looking towards the right with a bright open smile, right hand raised at shoulder height in a friendly "hello" wave (open palm, five fingers), left hand relaxed holding a small plum book at her side. Vertical 3:4 frame, empty space on the right side of the image for floating objects.` |
| **C** | `girl-C.png` | `POSE & FRAMING: full body, sitting gracefully on top of a large closed hardcover book made of soft translucent lilac glass (lying flat, no text), legs together and to one side under a long modest ivory skirt that reaches the ankles, soft ivory shoes, hands resting on her knee, looking at the viewer with a sweet smile. Square 1:1 frame, the whole book visible.` |
| **D** | `girl-D.png` | `POSE & FRAMING: upper body only (from just below the chest up), leaning slightly forward as if she rises from behind a flat white panel: both forearms resting horizontally on an invisible straight edge at the very bottom of the image, hands relaxed and visible, chin slightly lowered, looking at the viewer with a friendly welcoming smile. The bottom of the image is a straight horizontal line at the forearms. Horizontal 4:3 frame.` |
| **E** | `girl-E.png` | `POSE & FRAMING: head and shoulders portrait, centred, facing the viewer, soft gentle smile, eyes sparkling; framed for a circle (keep the face and hijab within the central 70% of the image). Square 1:1 frame.` |

---

**Санҷиши ҳар расм:** чеҳра дар ҳамаи 5 расм як аст; мӯй намоён нест; дар ҳар даст 5 ангушт; канорҳо тозаанд; фон шаффоф ё якранг аст; матн нест.

**Баъд аз фиристодани расмҳо:** ман ҳамаи 5 вариантро дар экран мегузорам ва деплой намекунам. Танҳо барои шумо версияи санҷишӣ месозам. Шумо скриншот мефиристед ва варианти беҳтаринро интихоб мекунед. Танҳо пас аз он деплой мекунем.
