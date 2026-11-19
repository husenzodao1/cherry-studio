// E-mail sign-in with a 6-digit code: code length and expiry, the site address, and the two letters
// (sign-in and confirmation) in the app's own look — peach sky, the glass flower, a frosted card with the
// code in large digits. Tables and inline styles only, so every mail client shows it the same way.
// Needs custom SMTP on the project. Run with a Supabase access token:
//   SUPABASE_ACCESS_TOKEN=... node tools/supabase/auth-email.mjs <project ref>
const ref = process.argv[2]
const SITE = 'https://dukhtari-khubam.vercel.app'

// each digit on its own small glass tile, in an elegant serif (mail clients keep only common fonts)
const DIGIT = "width:42px;height:56px;background:#ffffff;background-image:linear-gradient(170deg,#ffffff 0%,#fff3ec 60%,#ffe2d6 100%);border:1px solid #ffcfc2;border-radius:14px;"
  + "box-shadow:inset 0 1px 0 #ffffff,0 6px 14px -8px rgba(196,79,79,0.45);font-family:'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:32px;font-weight:700;"
  + "font-style:italic;color:#b2405f;text-align:center;vertical-align:middle;line-height:56px;"

const letter = (lead) => `<!doctype html>
<html lang="tg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Geologica:wght@400;600&display=swap" rel="stylesheet">
<title>Духтари хубам</title></head>
<body style="margin:0;padding:0;background:#fff1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff1ea;background-image:linear-gradient(170deg,#fff8f3 0%,#ffe8dc 48%,#ffd4c4 100%);">
<tr><td align="center" style="padding:28px 14px 36px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
    <tr><td align="center" style="padding:0 0 4px;">
      <img src="${SITE}/email/flower.png" width="220" alt="" style="display:block;width:220px;max-width:60%;height:auto;border:0;">
    </td></tr>
    <tr><td align="center" style="padding:0 0 18px;"><img src="${SITE}/email/brand.png" width="250" alt="Духтари хубам" style="display:block;width:250px;max-width:72%;height:auto;border:0;font-family:Georgia,serif;font-size:30px;font-style:italic;color:#c44f4f;"></td></tr>
    <tr><td style="background:#ffffff;background:rgba(255,255,255,0.88);border:1px solid #ffffff;border-radius:28px;padding:28px 24px 26px;box-shadow:0 14px 30px -16px rgba(170,80,60,0.36);font-family:'Geologica','Segoe UI',Roboto,Arial,sans-serif;color:#3f1f1a;">
      <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#6e3b30;text-align:center;">${lead}</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:18px auto 16px;border-collapse:separate;border-spacing:6px 0;">
        <tr>${[0, 1, 2, 3, 4, 5].map((i) => `<td style="${DIGIT}">{{ slice .Token ${i} ${i + 1} }}</td>`).join('')}</tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#a8766a;text-align:center;">Код 10 дақиқа амал мекунад.<br>Агар шумо ин корро накарда бошед, мактубро нодида гиред.</p>
    </td></tr>
    <tr><td align="center" style="padding:18px 10px 0;font-family:'Geologica','Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#a8766a;">
      Зебоӣ дар дониш аст 🌸<br>
      <a href="${SITE}" style="color:#e0675b;text-decoration:none;">dukhtari-khubam.vercel.app</a> ·
      <a href="${SITE}/privacy" style="color:#e0675b;text-decoration:none;">Махфият</a> ·
      <a href="${SITE}/terms" style="color:#e0675b;text-decoration:none;">Шартҳо</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

const body = {
  site_url: SITE,
  uri_allow_list: `${SITE}/**,https://localhost/**,capacitor://localhost/**`,
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  rate_limit_email_sent: 100,
  mailer_subjects_magic_link: '{{ .Token }} — коди воридшавӣ ба «Духтари хубам»',
  mailer_templates_magic_link_content: letter('Коди воридшавии шумо ба барнома:'),
  mailer_subjects_confirmation: '{{ .Token }} — коди тасдиқи почта',
  mailer_templates_confirmation_content: letter('Барои тасдиқи почта ин кодро дар барнома нависед:'),
  ...(process.env.SMTP_USER ? { smtp_user: process.env.SMTP_USER } : {}),
  ...(process.env.SMTP_SENDER ? { smtp_admin_email: process.env.SMTP_SENDER } : {})
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH', headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
})
const c = await res.json()
console.log(res.status, c.message ?? '', c.mailer_otp_length, c.smtp_user, c.smtp_admin_email)
