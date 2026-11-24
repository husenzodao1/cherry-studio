'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { SocialIcons } from '@/web/components/SocialIcons'
import { showToast } from '@/web/components/Toast'
import { useLearner } from '@/web/offline/learner'
import {
  answerRequest, createClass, joinClass, myRequests, searchLogins, setLinks, setLogin, socialMe,
  SocialError, type Links, type Me, type Network, type Requests
} from '@/web/offline/social'
import { usePrefs } from '@/web/prefs'

/**
 * Her friends: her login (made from her name, hers to change), her WhatsApp, Telegram and Instagram (seen only
 * by contacts she accepts), the requests she got and sent, her contacts, a search by login, and her class (join
 * by the teacher's code, or make one as a teacher). Under 16, requests come only from her class.
 */
export default function FriendsPage() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const code = learner?.code ?? ''
  const [me, setMe] = useState<Me | null>(null)
  const [req, setReq] = useState<Requests | null>(null)
  const [problem, setProblem] = useState(false)
  const [login, setLoginText] = useState('')
  const [links, setLinksState] = useState<Links>({})
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ login: string; name: string }[]>([])
  const [join, setJoin] = useState('')
  const [className, setClassName] = useState('')

  const load = useCallback(async () => {
    if (!code) return
    try {
      const [m, r] = await Promise.all([socialMe(code), myRequests(code)])
      setMe(m)
      setReq(r)
      setLoginText(m.login)
      setLinksState(m.links)
    } catch {
      setProblem(true)
    }
  }, [code])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const v = q.trim().toLowerCase()
    if (v.length < 3) { setFound([]); return }
    const timer = setTimeout(() => void searchLogins(v, code).then(setFound).catch(() => setFound([])), 400)
    return () => clearTimeout(timer)
  }, [q, code])

  const fail = (e: unknown) => showToast(t(e instanceof SocialError && e.message === 'login_taken' ? 'social.taken' : e instanceof SocialError && e.message === 'bad_login' ? 'social.bad_login' : 'state.error'), 'alert')
  const saveLogin = async () => { try { const r = await setLogin(code, login); setLoginText(r.login); setMe((m) => m && { ...m, login: r.login }); showToast(t('social.saved'), 'check') } catch (e) { fail(e) } }
  const saveLinks = async () => { try { setLinksState(await setLinks(code, links)); showToast(t('social.saved'), 'check') } catch (e) { fail(e) } }
  const answer = async (l: string, ok: boolean) => { try { await answerRequest(code, l, ok); void load() } catch (e) { fail(e) } }
  const enter = async () => { try { const c = await joinClass(code, join); setJoin(''); showToast(t('social.joined').replace('{c}', c.name), 'check') } catch (e) { fail(e) } }
  const make = async () => {
    try {
      const c = await createClass(code, className)
      setClassName('')
      showToast(t('social.class_made').replace('{code}', c.join_code), 'check')
    } catch (e) { fail(e) }
  }

  if (!learner) return null
  return (
    <>
      <Header back="/profile" title={t('social.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {problem ? <div className="glass card-pad muted">{t('social.offline')}</div> : !me || !req ? <div className="skeleton" style={{ height: 160, borderRadius: 24 }} /> : (
          <>
            <section className="glass card-pad stack" style={{ gap: 10 }}>
              <b>{t('social.my_login')}</b>
              <div className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ alignSelf: 'center' }}>@</span>
                <input className="input grow" value={login} maxLength={32} aria-label={t('social.my_login')} onChange={(e) => setLoginText(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />
                <button type="button" className="btn" disabled={login === me.login || login.length < 3} onClick={() => void saveLogin()}>{t('social.save')}</button>
              </div>
              <Link href={`/u?login=${encodeURIComponent(me.login)}`} className="link-btn">{t('social.see_mine')}</Link>
            </section>

            <section className="glass card-pad stack" style={{ gap: 10 }}>
              <b>{t('social.my_links')}</b>
              <span className="muted" style={{ fontSize: '0.84em' }}>{t(me.minor ? 'social.links_minor' : 'social.links_sub')}</span>
              {(['whatsapp', 'telegram', 'instagram'] as Network[]).map((n) => (
                <input key={n} className="input" value={links[n] ?? ''} maxLength={60} placeholder={t(`social.ph_${n}` as 'social.ph_whatsapp')} aria-label={n}
                  onChange={(e) => setLinksState({ ...links, [n]: e.target.value })} />
              ))}
              <button type="button" className="btn btn-soft" onClick={() => void saveLinks()}>{t('social.save')}</button>
            </section>

            {req.received.length ? (
              <section className="glass card-pad stack" style={{ gap: 4 }}>
                <b>{t('social.received')} · {req.received.length}</b>
                {req.received.map((p) => (
                  <div key={p.login} className="friends-row">
                    <span className="friends-ava" aria-hidden="true">{p.name.charAt(0)}</span>
                    <Link className="grow" href={`/u?login=${encodeURIComponent(p.login)}`}><b>{p.name}</b><span>@{p.login}{p.note ? ` · ${p.note}` : ''}</span></Link>
                    <button type="button" className="btn" onClick={() => void answer(p.login, true)} aria-label={t('social.accept')}><Icon name="check" size={16} /></button>
                    <button type="button" className="btn btn-soft" onClick={() => void answer(p.login, false)} aria-label={t('social.decline')}><Icon name="x" size={16} /></button>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="glass card-pad stack" style={{ gap: 4 }}>
              <b>{t('social.contacts')} · {req.contacts.length}</b>
              {!req.contacts.length ? <span className="muted">{t('social.no_contacts')}</span> : req.contacts.map((p) => (
                <div key={p.login} className="friends-row">
                  <span className="friends-ava" aria-hidden="true">{p.name.charAt(0)}</span>
                  <Link className="grow" href={`/u?login=${encodeURIComponent(p.login)}`}><b>{p.name}</b><span>@{p.login}</span></Link>
                  <SocialIcons has={Object.keys(p.links ?? {}) as Network[]} links={p.links ?? null} locked={t('social.locked')} />
                </div>
              ))}
              {req.sent.length ? <span className="muted" style={{ fontSize: '0.82em', marginTop: 6 }}>{t('social.sent')}: {req.sent.map((p) => `@${p.login}`).join(', ')}</span> : null}
            </section>

            <section className="glass card-pad stack" style={{ gap: 8 }}>
              <b>{t('social.find')}</b>
              <input className="input" value={q} placeholder={t('social.find_ph')} aria-label={t('social.find')} maxLength={32} onChange={(e) => setQ(e.target.value)} />
              {found.map((p) => (
                <Link key={p.login} className="friends-row" href={`/u?login=${encodeURIComponent(p.login)}`}>
                  <span className="friends-ava" aria-hidden="true">{p.name.charAt(0)}</span>
                  <span className="grow"><b>{p.name}</b><span>@{p.login}</span></span>
                  <Icon name="forward" size={16} />
                </Link>
              ))}
            </section>

            {/* classes (the teacher feature): only when the panel turned them on */}
            {me.classes ? <section className="glass card-pad stack" style={{ gap: 8 }}>
              <b>{t('social.class')}</b>
              <span className="muted" style={{ fontSize: '0.84em' }}>{t('social.class_sub')}</span>
              <div className="row" style={{ gap: 8 }}>
                <input className="input grow" value={join} maxLength={6} placeholder="A1B2C3" aria-label={t('social.class_join')} onChange={(e) => setJoin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                <button type="button" className="btn" disabled={join.length !== 6} onClick={() => void enter()}>{t('social.class_join')}</button>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input className="input grow" value={className} maxLength={80} placeholder={t('social.class_name')} aria-label={t('social.class_make')} onChange={(e) => setClassName(e.target.value)} />
                <button type="button" className="btn btn-soft" disabled={!className.trim()} onClick={() => void make()}>{t('social.class_make')}</button>
              </div>
            </section> : null}
          </>
        )}
      </div>
    </>
  )
}
