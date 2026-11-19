# Духтари хубам

Платформаи таълимӣ бо ҳафт мактаби дониш. Як backend барои Web, Android ва Admin Panel.
Талаботи пурра: [`docs/MASTER_PROMPT_v2.0.md`](docs/MASTER_PROMPT_v2.0.md).

| Қисм | Ҳолат |
| --- | --- |
| База (Supabase Postgres), RLS, workflow, revisions, Quiz grading | ✅ сохта ва бо тестҳо санҷида шуд |
| REST API v1 (188 амалиёт, OpenAPI 3.1) | ✅ сохта шуд · `/api/v1/openapi.json` |
| Web (хонанда) бо Real 3D Glass | ✅ сохта шуд |
| Admin Panel (мундариҷа, Full Text Editor, Quiz Builder, медиа, матнҳо, корбарон) | ✅ `/admin`, аз ҷустуҷӯ бо калимаи махфии кормандон кушода мешавад |
| Android (APK, офлайн) | ✅ Capacitor: ҳамин саҳифаҳо дар дохили APK, бе интернет кор мекунад · `npm run apk` · `/download/dukhtari-khubam.apk` |

## Структура

```
supabase/migrations/   SQL: schema, RLS, functions, storage, seed (applied in order)
src/app/               Next.js App Router: web pages + /api/v1 (catch-all router)
src/server/routes/     API route table (reader, me, quiz, admin)
src/lib/               router, error model, block schema v1, validation, OpenAPI builder
src/web/               client: auth, prefs/i18n, components, glass (Three.js + liquid glass)
tests/db/              PGlite tests running the real migrations (RLS, workflow, grading)
tests/unit/            block schema, router, OpenAPI contract
design/canvas/         Phase-2 design proof of concept (13 artboards)
docs/                  spec, architecture, OpenAPI snapshot
```

## Stack decision

The spec proposes Django + PostgreSQL "or a better justified choice". The owner asked for
**Supabase + Vercel**, so:

- **Supabase Postgres** is the single source of truth. Authorization lives *in the database*
  (row-level security + security-definer functions), so Android, Web and Admin share exactly the
  same rules, and hiding a button is never the only protection (spec §3.2).
- **Supabase Auth** issues the user JWT; **Supabase Storage** holds media (`media` public CDN,
  `media-protected` signed URLs for Premium).
- **Next.js on Vercel** serves the versioned REST API (`/api/v1`) and the web app. The API forwards
  the caller's token; it never uses a service-role key for content.

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run locally

```bash
npm install
npm test            # 29 database tests (PGlite runs every migration) + unit tests
npm run typecheck
npm run build
```

Environment (`.env.local`, never committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
CORS_ORIGINS=                      # optional, comma-separated, for other web origins
```

Apply `supabase/migrations/*.sql` in filename order (Supabase CLI `supabase db push`, or the SQL editor).

## Offline app and learner codes

- Learners have no e-mail account. `/start` asks for a name and shows a personal **15-digit code**
  made on the phone; “Ворид” takes the code and restores progress from the backup.
- The published catalogue (lessons, quizzes with answer keys, texts, achievements) is one document,
  `GET /api/v1/bundle`, stored on the phone (IndexedDB) and refreshed by ETag whenever online.
  Quizzes are graded on the phone with the same rules as the database.
- Progress (reading, completed lessons, bookmarks, quiz results, achievements) is saved on the phone
  and merged into the backup (`POST /profile/sync`, stored under sha256 of the code).
- Because answer keys ship to the phone, quizzes are for learning, not for exams.

### Android

```bash
npm run apk     # static export (out/) → content bundle embedded → cap sync → Gradle debug APK
```

Needs JDK 21 and the Android SDK (platform 36). The APK holds every page, font and image, so it
opens and works without a connection; content updates arrive by themselves when online. A new app
version (new code) is announced in the app from `/app-version.json`: raise `versionCode` there and
in `android/app/build.gradle`, build, and publish the APK at `public/download/`. The current APK is a
debug build for direct installation; Google Play needs a release build signed with your own key.

### First owner account

1. Create the owner account in Supabase → Authentication → Users (e-mail and password).
2. In the Supabase SQL editor (runs as `postgres`, not reachable from the API):
   ```sql
   select private.grant_role_by_email('owner@example.com', 'super_admin');
   ```
3. Open the staff panel at `/admin` and sign in with that e-mail and password.
   The owner grants roles to other staff in the panel (Корбарон).

Typing the staff passphrase in search opens the panel straight away: the passphrase is the password
of a separate staff account (`panel@dukhtari-khubam.invalid`, role `super_admin`), checked by Supabase
Auth. The app carries only the first 16 bits of the passphrase's SHA-256 (to skip ordinary queries).
To change the passphrase, change that account's password in Supabase → Authentication → Users and
update `KEY_PREFIX` in `src/app/search/page.tsx`.

### Learner sign-in and support

- Registration asks name, age, login and password; the 15-digit code is made on the phone. Without a
  connection the login and password wait on the phone (`dk.pending_login`) and are saved on their own
  once it is online; if the login was taken meanwhile, the learner is asked for another one.
- Sign in with the code; if it is lost, with login and password; if both are lost, through the
  support chat (`/support`, no account needed — a thread belongs to a random token kept on the phone).
- The phone encrypts the code with a key derived from the password (PBKDF2 → AES-GCM,
  `src/web/offline/account.ts`); the server keeps that ciphertext and a bcrypt hash of the password,
  never the code. Eight wrong passwords in a row lock the login for 15 minutes.
- Staff answer in the panel (Дастгирӣ). A super admin can issue a temporary password: it also issues
  a new code (the old one stops working) and the learner must choose a new password at sign-in.

### Content by age

Learners give their age when they register (stored as a year of birth with their progress). A title
(course, module, topic, lesson, quiz) or a text block that begins with
`<синну сол>барои 16 солаҳо</синну сол>` is shown only to learners of that age or younger; the tag
itself is never shown (`src/web/offline/age.ts`). This shapes the display; the published catalogue
stays public.

Roles: `super_admin`, `content_admin` (publish), `author` (own content), `editor`, `reviewer`,
`media_manager`, `analytics_viewer`.

## Publishing workflow

`draft → in_review → approved | changes_requested → scheduled | published → archived`
(`POST /admin/{entity}/{id}/transition`). Lessons and quizzes publish an immutable **revision
snapshot**: readers always see the snapshot, so editing a draft never changes the live lesson
until it is reviewed and published again. Every publish, review submission and restore is in
Revision History; every staff change is in the audit log.

## Look and feel

- Lavender glass design system (`src/app/globals.css`): frosted white glass cards (`.glass`), purple
  gradient pills, a glass tab bar whose current tab sits in a raised glass circle.
- `src/web/components/Backdrop.tsx` — fixed backdrop (never moves while scrolling): a lavender sky with
  rendered glass flowers and glass lenses at the edges, blurred by the frosted cards above them.
- Art (`public/assets/3d`, sources and licences in `PROVENANCE.json`) is rendered offline with
  `tools/render-assets` (three.js, physically based materials, HDRI lighting). Glass uses real
  transmission; each job is shot on black and on white and `matte.py` recovers true transparency.
  School icons, the glass flowers and the "book on a rehal" scene are procedural; the lantern is a CC0
  Poly Haven model.
- The app behaves like an app: no text selection or long-press menus outside text fields, no pinch
  zoom (text size is a setting), screens and images appear with short entrance animations, which always
  play (there is no animation setting).
- Greeting by the phone's clock (morning/day/evening/night), day streak from local study days.
- Lessons can link a YouTube video (block `youtube`, only the video id is stored): YouTube's cover
  (kept on the phone), playback inside the app with our own minimal glass controls.
- "Чаман" (`/garden`, `src/web/offline/garden.ts`): glass shelves, one per school; every finished
  lesson is a glass flower in the school's flower and tint, every finished course a large golden-lit bloom.
- "Такрори рӯз" (`/review`, `src/web/offline/review.ts`): daily spaced repetition (Leitner boxes,
  intervals 1/2/4/8/16 days) over choice questions from quizzes the learner has met; answers sync with
  the progress backup.
- Certificates for finished courses and a picture of the personal code are drawn on the phone
  (`src/web/offline/cards.ts`) and saved or shared through the system share sheet.
- A course can be kept on the phone with its pictures and audio ("Боргирӣ барои бе интернет"), with a
  warning on mobile data; audio plays from the phone's copy.
- Butterflies (`src/web/components/Butterfly.tsx`): one kind, a "white", painted in four colours
  (`tools/render-assets/butterfly/species.html`). Flight is simulated: lift and thrust only on the
  down-stroke of each wing beat, gravity and drag between, a random-walk heading biased to the goal and
  sideways zigzags, so the path bobs and jinks; landings slow, sometimes circle, settle with dying beats
  and turn head-up. Two live on the home screen; on the list pages (schools, a school, a course, the
  garden, the profile, saved) three sit on the boxes as the page opens and scatter, one of them staying.
  Scrolling makes a perched butterfly take off and find another place; a finger nearby startles it.
  Off when the system asks for reduced motion.
- Profile photo: chosen on the profile, cut square to 256 px and kept on the phone only
  (`src/web/offline/photo.ts`); it is never sent to the server.
- The code and login in Settings are shown only after the phone's own lock (fingerprint, face or screen
  PIN; `@capgo/capacitor-native-biometric`); on the website, or a phone without a lock, after the login
  password is checked online (`src/web/offline/unlock.ts`).
- Home stands still (no vertical scrolling): "Суханҳои рӯз" — the newest inspirations from the panel
  (`api_inspirations`), one at a time on a soft gradient over a band of small 3D shapes
  (`words-band.webp`), handwritten (Caveat), sliding away every few seconds — and all schools in one
  row moved sideways by the finger (momentum, snapping to tiles).
- School page: the school's icon inside a ring that fills with progress, the numbers and "Идома".
- Themes: white (default), dark, Сакура, Шафтолу, Наъно, Шафақ (`data-palette` on top of the light or
  dark base; the glass flowers take the theme's hue). The smallest text size is the default.
- App PIN (`src/web/offline/pin.ts`, `AppLock.tsx`, `PinSettings.tsx`): four digits asked when the app
  opens and after a minute away; on/off and change in Settings; a salted hash only, 30 s wait after five
  wrong tries; "forgot" asks the phone's lock or the login password and removes the PIN.
- Speed: the backdrop stays still and only the tab bar bends the content behind it (school tiles use
  frosted glass), so scrolling does not redraw refracting glass on every frame.
- Android app: daily local notifications (lesson reminder, inspiration of the day) at times chosen in
  Settings (`src/web/offline/notify.ts`).

## Known limitations

- **The Android app is not built yet**; it uses the same API.
- The staff passphrase is a full `super_admin` password: anyone who knows it can manage everything.
  Keep it long and private.
- Push delivery (FCM/Web Push) is not connected: notifications are stored, scheduled and shown
  in-app; device tokens are collected. Sending needs FCM credentials.
- No payment provider: Premium is granted by staff (`entitlements`), as the spec requires until a
  provider is chosen.
- Video is served as uploaded files; HLS transcoding is not automated (`hls_path` is supported).
- Storage file size limit is 50 MB per file (Supabase free plan).
- 3D/visual assets in the design PoC are placeholders; production assets must be licensed and
  recorded with provenance (the media library enforces licence and flags AI imagery).
- Rate limiting: quiz attempts are limited in the database; configure Vercel Firewall rules for
  the rest of the API in production.
