// Email sign-in with a 6-digit code: code length, expiry, site URL and the letters (Tajik, code only).
// Needs custom SMTP on the project first. Run with a Supabase access token in SUPABASE_ACCESS_TOKEN:
//   SUPABASE_ACCESS_TOKEN=... node tools/supabase/auth-email.mjs dqavtyrdipwwgeckxxhr
const ref = process.argv[2]
const letter = (title, line) => `<div style="font-family:Arial,sans-serif;max-width:440px;margin:0 auto;padding:28px 24px;color:#3f1f1a">
  <h2 style="margin:0 0 6px;font-weight:600;color:#c44f4f">Духтари хубам</h2>
  <p style="margin:0 0 18px;color:#6e3b30">${line}</p>
  <div style="font-size:34px;letter-spacing:10px;font-weight:700;text-align:center;padding:16px 0;border-radius:16px;background:#fff1ea;color:#3f1f1a">{{ .Token }}</div>
  <p style="margin:18px 0 0;font-size:13px;color:#a8766a">Код 10 дақиқа амал мекунад. Агар шумо ин корро накарда бошед, ин мактубро нодида гиред.</p>
</div>`
const body = {
  site_url: 'https://dukhtari-khubam.vercel.app',
  uri_allow_list: 'https://dukhtari-khubam.vercel.app/**,https://localhost/**,capacitor://localhost/**',
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  mailer_subjects_magic_link: 'Коди воридшавӣ: {{ .Token }}',
  mailer_templates_magic_link_content: letter('Коди воридшавӣ', 'Коди воридшавӣ ба барнома:'),
  mailer_subjects_confirmation: 'Коди тасдиқи почта: {{ .Token }}',
  mailer_templates_confirmation_content: letter('Тасдиқи почта', 'Барои тасдиқи почтаи худ ин кодро дар барнома нависед:')
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH', headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
})
const c = await res.json()
console.log(res.status, c.mailer_otp_length, c.mailer_otp_exp, c.site_url, c.message ?? '')
