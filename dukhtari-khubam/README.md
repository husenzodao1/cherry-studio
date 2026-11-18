# Духтари хубам

Платформаи таълимӣ бо ҳафт мактаби дониш. Як backend барои Web, Android ва Admin Panel.
Талаботи пурра: [`docs/MASTER_PROMPT_v2.0.md`](docs/MASTER_PROMPT_v2.0.md).

| Қисм | Ҳолат |
| --- | --- |
| База (Supabase Postgres), RLS, workflow, revisions, Quiz grading | ✅ сохта ва бо тестҳо санҷида шуд |
| REST API v1 (188 амалиёт, OpenAPI 3.1) | ✅ сохта шуд · `/api/v1/openapi.json` |
| Web (хонанда) бо Real 3D Glass | ✅ сохта шуд |
| Admin Panel (мундариҷа, Full Text Editor, Quiz Builder, медиа, матнҳо, корбарон) | ✅ `/admin`, аз ҷустуҷӯ бо калимаи махфии кормандон кушода мешавад |
| Android (Kotlin + Compose) | ⏳ марҳилаи навбатӣ (аз ҳамин API истифода мебарад) |

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

### E-mail codes

Sign-up and code sign-in send a one-time code. In Supabase → Authentication → Emails, paste
`supabase/templates/confirm-signup.html` into “Confirm signup” and `magic-link.html` into
“Magic Link” (both use `{{ .Token }}`). The built-in Supabase mailer sends only a few e-mails per
hour; connect your own SMTP for real use.

### First owner account

1. Sign up on the website (`/login`).
2. In the Supabase SQL editor (runs as `postgres`, not reachable from the API):
   ```sql
   select private.grant_role_by_email('owner@example.com', 'super_admin');
   ```
3. The owner then grants roles to others with `POST /api/v1/admin/users/{id}/roles`.

Roles: `super_admin`, `content_admin` (publish), `author` (own content), `editor`, `reviewer`,
`media_manager`, `analytics_viewer`.

## Publishing workflow

`draft → in_review → approved | changes_requested → scheduled | published → archived`
(`POST /admin/{entity}/{id}/transition`). Lessons and quizzes publish an immutable **revision
snapshot**: readers always see the snapshot, so editing a draft never changes the live lesson
until it is reviewed and published again. Every publish, review submission and restore is in
Revision History; every staff change is in the audit log.

## Real 3D Glass (spec §8)

- `src/web/glass/GlassScene.tsx` — a solid glass sphere **ray-traced in a shader**: each view ray
  refracts on entry and exit (Snell's law, IOR ≈ 1.5, separate IOR per RGB channel for dispersion),
  travels the sphere's real thickness, then samples what is behind it (backdrop lines, lettering and
  the 3D objects rendered into a target). Schlick Fresnel mixes in studio reflections; absorption
  depends on path length. The background is visibly bent, magnified and inverted — not blurred.
  Glossy spheres and chrome tubes are real geometry lit by a PMREM environment.
  Several spheres float in each scene and carry short phrases printed on their curved surface
  (UI strings `glass.motto_1..3`, editable in the CMS); a garland of real flowers and stars hangs
  inside the scene, so the glass refracts it.
- Art (`public/assets/3d`, sources and licences in `PROVENANCE.json`): flowers are real photographs
  (Wikimedia Commons, CC BY-SA) cut out and set on CC0 scanned leaves (`tools/render-assets/bouquet.py`);
  gems and objects are ray-traced/rendered offline (`tools/render-assets`).
- `src/web/glass/LiquidGlass.tsx` — UI glass (bottom navigation, floating controls): a displacement
  map is computed from a squircle bezel profile and Snell's law and applied to the page behind it via
  an SVG `backdrop-filter`, so content scrolling under the dock is optically bent at the rim.
- Fallbacks: no WebGL2 → layered static glass; non-Chromium browsers → frosted blur with the same
  rim lighting. Reduced Motion stops all decorative motion.

## Known limitations

- **The Android app is not built yet**; it uses the same API.
- The admin panel opens from search with the staff passphrase. That only hides the entry point:
  access is granted by staff roles, checked in the database for every request.
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
