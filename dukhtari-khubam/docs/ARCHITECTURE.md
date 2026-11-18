# Architecture

```
            Admin Panel (web)      Web app (Next.js)      Android (Kotlin, planned)
                    \                    |                     /
                     \             Bearer JWT (Supabase Auth)  /
                      v                  v                    v
                    Vercel · Next.js route handler  /api/v1/*
                    (validation, block schema v1, error model, OpenAPI)
                                         |
                                caller's JWT forwarded
                                         v
                 Supabase Postgres ── RLS policies + security-definer API functions
                         |                         |
                 Supabase Storage (media,     pg_cron: scheduled publish,
                 media-protected)             notification dispatch status
```

## Data model (ERD summary)

```
schools ─< courses ─< modules ─< topics ─< lessons ─< content_blocks
   │          │          │          │         │             └─ content_block_translations (per locale)
   └ *_translations (title, description, ready) for every level
courses ─< course_prerequisites
lessons ─ published_revision_id → content_revisions (immutable JSON snapshot)
quizzes (attached to school | course | module | topic | lesson, or standalone)
   ├─< quiz_translations, quiz_sections(+translations)
   ├─< quiz_questions ─< quiz_question_translations
   │        ├─< quiz_options ─< quiz_option_translations
   │        └── quiz_answer_keys (hidden from readers)
   ├── published_revision_id → content_revisions (snapshot + answer_key column)
   └─< quiz_attempts (bound to the revision they started on)
media_assets ─< media_asset_translations, media_asset_versions   (provenance + licence)
profiles, user_roles, entitlements                               (RBAC, Premium)
lesson_progress, bookmarks, achievements(+translations), user_achievements
daily_inspirations(+translations), help_texts(+translations), ui_strings
cms_pages(+translations), banners(+translations)
notifications(+translations), notification_reads, push_devices
workflow_events, audit_logs, lesson_search_index
```

## Authorization

- Readers (anon/authenticated) can read only live content: `published`, or `scheduled` whose time
  has come, with every ancestor live. Drafts, working copies, answer keys and explanations are not
  selectable by readers at all.
- Staff permissions are SQL helpers (`private.can_edit_owned`, `can_review`, `can_publish`, …) used
  by RLS policies and API functions. Authors edit only their own rows; editors and content admins
  edit any; reviewers approve; content admins publish; super admins manage roles.
- Workflow, version and ownership columns cannot be written by clients; a trigger rejects it and
  only the workflow functions change them.

## Content blocks (schema v1)

Each block has `type`, `schema_version`, language-independent `props` (asset ids, layout, variant,
accent) and per-locale `content`. Rich text is JSON spans with whitelisted marks and palette
colours; links allow `https:`, `mailto:` and in-app paths. No HTML is ever stored or rendered.
Supported: heading, subheading, paragraph, lead, rich_text, ordered/bullet list, image, gallery,
video, audio, quote, callout (important/warning/note/tip/info), table, source, file,
practical_task, quiz, related_lesson, divider, illustration, full_width_media, side_by_side,
model3d, caption, footnote.

Publishing a lesson validates: at least one ready language, translated text for each block in each
ready language, assets that exist, have a licence, are not AI-generated, and have alt text.

## Quiz grading

Grading runs in Postgres against the revision snapshot the attempt started on. Types: single
choice, multiple choice (all-or-nothing or partial credit: points × (hits − wrong) / correct),
true/false, matching, ordering, short answer (normalised comparison, optional manual review),
long answer (always manual review with the author's rubric). Feedback is revealed according to
the quiz policy (`never`, `after_each`, `after_submit`). Preview grading never stores attempts.

## Localisation

Every content table has a translation table keyed by locale (`tg`, `ru`, `ar`) with its own
`ready` flag, so one language can be published without waiting for the others. Readers get the
requested language, then Tajik, then any ready language. Arabic renders right-to-left.

## Tests

`tests/db` boots PGlite (Postgres 18 in WebAssembly) with a stub of the Supabase `auth`/`storage`
schemas and runs every production migration, then exercises RLS and the API functions as real
roles: drafts hidden, author ownership, protected columns, review gate, alt-text gate, snapshot
isolation, version conflicts, revision restore, asset replacement and delete guard, Premium lock,
search, achievements, scheduling, audit log, every question type, answer-key secrecy, manual
review, attempt limits, revision-bound attempts and analytics permissions.
