'use client'

import { useEffect, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { SocialIcons } from '@/web/components/SocialIcons'
import { showToast } from '@/web/components/Toast'
import { useLearner } from '@/web/offline/learner'
import { blockProfile, profileOf, removeContact, sendRequest, SocialError, type Profile } from '@/web/offline/social'
import { usePrefs } from '@/web/prefs'

/** A profile by its login (/u?login=…): her name, what she achieved, her links (only for her contacts), a request. */
export default function PublicProfile() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [login, setLogin] = useState('')
  const [p, setP] = useState<Profile | null>(null)
  const [missing, setMissing] = useState(false)
  const load = async (l: string) => {
    try { setP(await profileOf(l, learner?.code)); setMissing(false) } catch { setMissing(true) }
  }
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get('login') ?? ''
    setLogin(l)
    if (l) void load(l)
  }, [learner?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async () => {
    if (!learner?.code || !p) return
    try { await sendRequest(learner.code, p.login); showToast(t('social.request_sent'), 'check'); void load(p.login) } catch (e) {
      showToast(t(e instanceof SocialError && e.message === 'too_many' ? 'social.too_many' : e instanceof SocialError && e.message === 'not_allowed' ? 'social.not_allowed' : 'state.error'), 'alert')
    }
  }
  const remove = async () => { if (learner?.code && p) { await removeContact(learner.code, p.login).catch(() => undefined); void load(p.login) } }
  const block = async () => {
    if (!learner?.code || !p) return
    const reason = window.prompt(t('social.report_why')) ?? ''
    if (!window.confirm(t('social.block_confirm'))) return
    await blockProfile(learner.code, p.login, reason).catch(() => undefined)
    showToast(t('social.blocked'), 'check')
    setP(null)
    setMissing(true)
  }

  return (
    <>
      <Header back="/friends" title={login ? `@${login}` : t('social.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {missing ? <div className="glass card-pad muted">{t('social.not_found')}</div> : !p ? <div className="skeleton" style={{ height: 220, borderRadius: 24 }} /> : (
          <>
            <section className="glass card-pad public-head">
              <span className="friends-ava" aria-hidden="true">{p.name.charAt(0)}</span>
              <b style={{ fontSize: '1.2rem' }}>{p.name}</b>
              <span className="login-pill">@{p.login}</span>
              <div className="public-stats">
                <span><b>{p.lessons}</b>{t('social.lessons')}</span>
                <span><b>{p.achievements}</b>{t('profile.achievements')}</span>
              </div>
              <SocialIcons has={p.has} links={p.links} locked={t('social.locked')} />
              {p.status === 'none' && p.can_request ? <button type="button" className="btn btn-block" onClick={() => void ask()}><Icon name="plus" size={16} /> {t('social.request')}</button> : null}
              {p.status === 'none' && !p.can_request && learner ? <span className="muted" style={{ fontSize: '0.84em' }}>{t('social.not_allowed')}</span> : null}
              {p.status === 'sent' ? <span className="muted">{t('social.request_sent')}</span> : null}
              {p.status === 'received' ? <span className="muted">{t('social.wants_you')}</span> : null}
              {p.status === 'contact' ? <button type="button" className="link-btn" onClick={() => void remove()}>{t('social.remove')}</button> : null}
            </section>
            {p.status !== 'me' && learner ? <button type="button" className="link-btn" style={{ color: '#e5484d' }} onClick={() => void block()}>{t('social.block')}</button> : null}
          </>
        )}
      </div>
    </>
  )
}
