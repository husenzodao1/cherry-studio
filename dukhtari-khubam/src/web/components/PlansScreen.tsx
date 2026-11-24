'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { currencyOf, moneyText } from '@/lib/money'
import { planRank, ROWS, type Cell, type Limits, type Plan } from '@/lib/plans'
import { api } from '../api'
import { useAuth } from '../auth'
import { CrownSpin } from './CrownSpin'
import { Icon, type IconName } from './Icon'
import { showToast } from './Toast'
import { usePlan } from '../plans'
import { usePrefs } from '../prefs'

/**
 * The plans' screen: what Standard and Premium do, shown as they really look (pictures of the app at work,
 * passing one after another at the top), the two plans to choose from with their crowns and prices, the
 * table of what each plan gives, and the way to buy — Paddle in the app, or a consultant. A learner who
 * has a plan sees it here too: until when, Standard's free Premium week, her gifts for friends.
 */

/** the pictures at the top: the app at work in her language (public/assets/paywall/<locale>) */
const SHOTS = ['chat', 'workspace', 'navigate', 'hey', 'slides', 'song', 'quiz', 'lawyer', 'mmt', 'call'] as const
/** opened by the app itself (not by her): the prices are shown after this long, and, untouched, it closes */
const TO_PRICES_MS = 3000
const CLOSE_MS = 7000
type Shot = (typeof SHOTS)[number]

declare global {
  interface Window { Paddle?: any }
}
/** Paddle.js, loaded only when she buys */
function paddle(token: string, sandbox: boolean, onDone: () => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const P = window.Paddle
      if (sandbox) P.Environment.set('sandbox')
      P.Initialize({ token, eventCallback: (e: { name?: string }) => { if (e?.name === 'checkout.completed') onDone() } })
      resolve(P)
    }
    if (window.Paddle) return ready()
    const s = document.createElement('script')
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    s.async = true
    s.onload = ready
    s.onerror = () => reject(new Error('paddle'))
    document.head.appendChild(s)
  })
}

export function PlansScreen({ onClose, from }: { onClose: () => void; from?: string | null }) {
  const { t, locale } = usePrefs()
  const { session } = useAuth()
  const p = usePlan()
  const router = useRouter()
  const [pick, setPick] = useState<'standard' | 'premium'>('premium')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const has = p.plan
  const currency = useMemo(() => { try { return currencyOf(Intl.DateTimeFormat().resolvedOptions().timeZone) } catch { return 'TJS' } }, [])
  const money = (n: number) => moneyText(n, { currency, rates: p.info.rates ?? {}, tag: locale === 'tg' ? 'ru' : locale === 'prs' ? 'fa' : locale, somoniWord: t('pw.somoni') })
  // a moment after it opens: down to the two plans, both coming forward at once; opened by the app and
  // not touched, it closes after a while (she was only shown what is there)
  const root = useRef<HTMLDivElement>(null)
  const plans = useRef<HTMLDivElement>(null)
  const [pop, setPop] = useState(false)
  const touched = useRef(false)
  useEffect(() => {
    const down = setTimeout(() => {
      if (touched.current || !plans.current) return
      plans.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPop(true)
    }, TO_PRICES_MS)
    const close = from === 'open' ? setTimeout(() => { if (!touched.current) onClose() }, CLOSE_MS) : undefined
    return () => { clearTimeout(down); clearTimeout(close) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // after a purchase: her plan is looked at again until it changes
  const waiting = useRef<number | null>(null)
  useEffect(() => () => { if (waiting.current) clearInterval(waiting.current) }, [])

  const done = () => {
    showToast(t('pw.thanks'), 'check')
    let tries = 0
    waiting.current = window.setInterval(() => {
      tries += 1
      void p.reload()
      if (tries > 20 && waiting.current) clearInterval(waiting.current)
    }, 3000)
  }

  const buy = async () => {
    if (!session) {
      showToast(t('pw.need_account'), 'info')
      onClose()
      router.push('/settings')
      return
    }
    const info = p.info.paddle
    // no online payment yet: through a consultant
    if (!info) { onClose(); return router.push(`/support?help=plan_${pick}`) }
    setBusy(true)
    try {
      const P = await paddle(info.token, info.sandbox, done)
      const first = pick === 'standard' && !p.me?.standard_since && info.standard_discount
      P.Checkout.open({
        items: [{ priceId: pick === 'premium' ? info.premium : info.standard, quantity: 1 }],
        customer: session.user.email ? { email: session.user.email } : undefined,
        customData: { user_id: session.user.id },
        ...(first ? { discountId: info.standard_discount } : {}),
        settings: { displayMode: 'overlay', theme: 'light', locale: locale === 'ru' || locale === 'tg' ? 'ru' : locale === 'tr' ? 'tr' : 'en', allowLogout: false }
      })
    } catch {
      showToast(t('pw.pay_failed'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  const claimWeek = async () => {
    try {
      await api('/me/plan/week', { method: 'POST' })
      await p.reload()
      showToast(t('pw.week_taken'), 'check')
    } catch {
      showToast(t('pw.week_failed'), 'alert')
    }
  }
  const redeem = async () => {
    if (!session) return showToast(t('pw.need_account'), 'info')
    try {
      await api('/me/gift', { method: 'POST', body: { code: code.trim() } })
      await p.reload()
      setCode('')
      showToast(t('pw.gift_taken'), 'check')
    } catch {
      showToast(t('pw.gift_failed'), 'alert')
    }
  }
  const shareGift = async (c: string) => {
    const text = t('pw.gift_share').replace('{code}', c)
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); showToast(t('ai.copied'), 'check') }
    } catch { /* closed */ }
  }
  const standardWeek = has === 'standard' && !p.me?.week_taken && !!p.me?.standard_since && Date.now() - Date.parse(p.me.standard_since) >= 28 * 86_400_000
  const ends = p.me?.ends_at ? new Date(p.me.ends_at).toLocaleDateString(locale === 'tg' ? 'ru' : locale) : null

  return (
    <div className="pw" ref={root} onPointerDown={() => { touched.current = true }} onWheel={() => { touched.current = true }} onKeyDown={() => { touched.current = true }}>
      <button type="button" className="pw-close" aria-label={t('pin.cancel')} onClick={onClose}><Icon name="x" size={20} /></button>
      <header className="pw-hero">
        <CrownSpin plan="premium" size={150} />
        <h1 className="pw-title">{t('pw.title')}</h1>
        <p className="pw-sub">{t('pw.subtitle')}</p>
      </header>

      <Shots />

      {has !== 'free' ? (
        <section className={`pw-mine is-${has}`}>
          <CrownSpin plan={has} size={64} />
          <div className="grow">
            <b>{t(has === 'premium' ? 'pw.you_premium' : 'pw.you_standard')}</b>
            <span>{p.me?.staff ? t('pw.staff') : p.me?.forever ? t('pw.forever') : ends ? t('pw.until').replace('{date}', ends) : ''}</span>
          </div>
        </section>
      ) : null}
      {standardWeek ? <button type="button" className="pw-week" onClick={() => void claimWeek()}><Icon name="sparkle" size={18} />{t('pw.week_cta')}</button> : null}
      {p.me?.gifts?.length ? (
        <section className="pw-gifts">
          <b>{t('pw.gifts_title')}</b>
          {p.me.gifts.map((g) => (
            <div key={g.code} className="pw-gift">
              <span className="pw-gift-code">{g.code}</span>
              <span className="grow">{g.redeemed ? t('pw.gift_used') : t('pw.gift_days').replace('{n}', String(g.days))}</span>
              {!g.redeemed ? <button type="button" className="link-btn" onClick={() => void shareGift(g.code)}>{t('pw.gift_send')}</button> : null}
            </div>
          ))}
        </section>
      ) : null}

      {has !== 'premium' ? (
        <>
          <div ref={plans} className={`pw-plans${pop ? ' is-pop' : ''}`} role="radiogroup" aria-label={t('pw.choose')}>
            {(['standard', 'premium'] as const).filter((k) => planRank(k) > planRank(has)).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={pick === k} className={`pw-plan is-${k}${pick === k ? ' is-on' : ''}`} onClick={() => setPick(k)}>
                {k === 'premium' ? <span className="pw-best">{t('pw.best')}</span> : <span className="pw-best is-deal">{t('pw.first_month').replace('{n}', money(p.info.prices.standardFirst))}</span>}
                <CrownSpin plan={k} size={74} />
                <b className="pw-plan-name">{k === 'premium' ? 'Premium' : 'Standard'}</b>
                <span className="pw-plan-price"><b>{money(k === 'premium' ? p.info.prices.premium : p.info.prices.standard)}</b> {t('pw.per_month_price')}</span>
                <span className="pw-plan-line">{t(k === 'premium' ? 'pw.premium_line' : 'pw.standard_line')}</span>
                <span className="pw-radio" aria-hidden="true">{pick === k ? <Icon name="check" size={14} /> : null}</span>
              </button>
            ))}
          </div>
          <button type="button" className="pw-cta" disabled={busy} onClick={() => void buy()}>
            <Icon name="crown" size={20} />
            {pick === 'premium' ? t('pw.cta_premium').replace('{n}', money(p.info.prices.premium)) : t('pw.cta_standard').replace('{n}', money(p.me?.standard_since ? p.info.prices.standard : p.info.prices.standardFirst))}
          </button>
          <p className="pw-fine">{pick === 'premium' ? t('pw.fine_premium').replace('{n}', String(p.info.gift_days)) : t('pw.fine_standard').replace('{n}', money(p.info.prices.standard))}</p>
        </>
      ) : null}

      <Table limits={p.info.limits} mine={has} />

      <section className="pw-redeem">
        <b>{t('pw.redeem_title')}</b>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={code} maxLength={8} placeholder="ABCD2345" aria-label={t('pw.redeem_title')} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          <button type="button" className="btn" disabled={code.length !== 8} onClick={() => void redeem()}>{t('pw.redeem')}</button>
        </div>
      </section>

      {p.info.consultant && has !== 'premium' ? (
        <button type="button" className="pw-consult" onClick={() => { onClose(); router.push(`/support?help=plan_${pick}`) }}>
          <Icon name="phone" size={16} /><span className="grow">{t('pw.consult')}</span><Icon name="forward" size={16} />
        </button>
      ) : null}
    </div>
  )
}

/** The app at work: its pictures passing one after another, with a line under each; dots to choose one. */
function Shots() {
  const { t, locale } = usePrefs()
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return
    const timer = setInterval(() => setAt((n) => (n + 1) % SHOTS.length), 3200)
    return () => clearInterval(timer)
  }, [held])
  const start = useRef<number | null>(null)
  return (
    <section className="pw-shots" aria-roledescription="carousel"
      onPointerDown={(e) => { start.current = e.clientX; setHeld(true) }}
      onPointerUp={(e) => {
        const dx = start.current === null ? 0 : e.clientX - start.current
        start.current = null
        if (dx < -40) setAt((n) => (n + 1) % SHOTS.length)
        else if (dx > 40) setAt((n) => (n - 1 + SHOTS.length) % SHOTS.length)
        setTimeout(() => setHeld(false), 4000)
      }}>
      <div className="pw-shots-track">
        {SHOTS.map((s: Shot, i) => (
          <figure key={s} className={`pw-shot${i === at ? ' is-on' : i === (at - 1 + SHOTS.length) % SHOTS.length ? ' is-prev' : i === (at + 1) % SHOTS.length ? ' is-next' : ''}`} aria-hidden={i !== at}>
            <img src={`/assets/paywall/${locale}/${s}.webp`} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" />
            <figcaption>{t(`pw.shot_${s}` as 'pw.shot_chat')}</figcaption>
          </figure>
        ))}
      </div>
      <div className="pw-dots">{SHOTS.map((s, i) => <button key={s} type="button" aria-label={String(i + 1)} className={i === at ? 'is-on' : ''} onClick={() => { setAt(i); setHeld(true) }} />)}</div>
    </section>
  )
}

/** What each plan gives: a row a thing, a column a plan (its crown on top), the learner's own plan marked. */
function Table({ limits, mine }: { limits: Record<Plan, Limits>; mine: Plan }) {
  const { t } = usePrefs()
  const plans: Plan[] = ['free', 'standard', 'premium']
  const cell = (c: Cell, plan: Plan, row: (typeof ROWS)[number]) => {
    if (c === true) return <span className="pw-yes"><Icon name="check" size={15} /></span>
    if (c === false) return <span className="pw-no">—</span>
    if (c === 'limit' && row.limit) {
      const n = limits[plan][row.limit]
      if (n === -1) return <b className="pw-inf">∞</b>
      if (n === 0) return <span className="pw-no">—</span>
      return <b>{row.limit === 'keep' ? t('pw.n_days').replace('{n}', String(n)) : row.limit === 'message' ? t('pw.n_day').replace('{n}', String(n)) : t('pw.n_month').replace('{n}', String(n))}</b>
    }
    return <span className="pw-word">{t(`pw.cell_${c}` as 'pw.cell_lite')}</span>
  }
  const rows = useMemo(() => ROWS, [])
  return (
    <section className="pw-table" aria-label={t('pw.table_title')}>
      <h2>{t('pw.table_title')}</h2>
      <div className="pw-grid" role="table">
        <div className="pw-tr pw-head" role="row">
          <span role="columnheader" />
          {plans.map((pl) => (
            <span key={pl} role="columnheader" className={`pw-th is-${pl}${pl === mine ? ' is-mine' : ''}`}>
              {pl !== 'free' ? <CrownSpin plan={pl} size={38} still /> : <span className="pw-th-free" />}
              {pl === 'free' ? t('pw.free') : pl === 'standard' ? 'Standard' : 'Premium'}
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.id} className="pw-tr" role="row">
            <span className="pw-feature" role="rowheader">
              <Icon name={r.icon as IconName} size={16} />
              <span><b>{t(`pw.row_${r.id}` as 'pw.row_messages')}</b>{r.soon ? <em className="pw-soon">{t('pw.soon')}</em> : null}</span>
            </span>
            {plans.map((pl, i) => <span key={pl} role="cell" className={`pw-td is-${pl}`}>{cell(r.cells[i], pl, r)}</span>)}
          </div>
        ))}
      </div>
    </section>
  )
}
