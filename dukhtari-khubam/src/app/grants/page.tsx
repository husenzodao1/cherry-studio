'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { usePrefs } from '@/web/prefs'

/** well-known programmes open to students from Tajikistan (their rules and dates are always taken from official sources) */
const PROGRAMS = [
  ['🇹🇯', 'Дурахшандагон'], ['🇷🇺', 'Квотаи Россия (Россотрудничество)'], ['🇹🇷', 'Türkiye Bursları'], ['🇭🇺', 'Stipendium Hungaricum'],
  ['🇨🇳', 'CSC (Chinese Government Scholarship)'], ['🇰🇷', 'GKS (Global Korea Scholarship)'], ['🇩🇪', 'DAAD'], ['🇪🇺', 'Erasmus Mundus'],
  ['🇬🇧', 'Chevening'], ['🇺🇸', 'Fulbright'], ['🇯🇵', 'MEXT'], ['🏔️', 'University of Central Asia']
] as const
const DOCS = ['passport', 'transcript', 'translation', 'language', 'motivation', 'cv', 'recommendation', 'medical', 'photos', 'portfolio'] as const
type Doc = (typeof DOCS)[number]
/** documents she can write with Mahliyo's help */
const WRITE: Partial<Record<Doc, string>> = { motivation: 'grants.write_motivation', cv: 'grants.write_cv', recommendation: 'grants.write_recommendation' }
const KEY = 'dk.grants.docs'

/** opens Mahliyo in her grants mode with the question written in */
function ask(question: string, go: (p: string) => void) {
  try {
    localStorage.setItem('dk.ai.mode', 'grants')
    sessionStorage.setItem('dk.ai.ask', question)
  } catch { /* storage blocked: the chat opens empty */ }
  go('/mahliyo')
}

/**
 * Grants and study abroad: the well-known programmes (a tap asks Mahliyo — in her grants mode, which reads the
 * official sources and the staff's grants shelf — for the rules, documents, deadline and a plan), a search by
 * her level and field, and her own checklist of documents, with help writing the letters.
 */
export default function GrantsPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const [level, setLevel] = useState<'school' | 'bachelor' | 'master'>('bachelor')
  const [field, setField] = useState('')
  const [more, setMore] = useState(false)
  const [docs, setDocs] = useState<Partial<Record<Doc, boolean>>>({})
  useEffect(() => { try { setDocs(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Doc, boolean>>) } catch { /* none */ } }, [])
  const toggle = (d: Doc) => {
    const next = { ...docs, [d]: !docs[d] }
    setDocs(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* not kept */ }
  }
  const ready = DOCS.filter((d) => docs[d]).length

  return (
    <>
      <Header back="/schools" title={t('grants.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        <section className="glass card-pad tool-hero">
          <span className="tool-ico is-lg" aria-hidden="true"><Icon name="globe" size={24} /></span>
          <span className="grow tool-hero-text"><span>{t('grants.sub')}</span></span>
        </section>

        <section className="glass card-pad stack" style={{ gap: 10 }}>
          <b>{t('grants.find')}</b>
          <div className="sos-chips">
            {(['school', 'bachelor', 'master'] as const).map((l) => <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{t(`grants.level_${l}` as 'grants.level_school')}</button>)}
          </div>
          <input className="input" value={field} maxLength={80} placeholder={t('grants.field')} aria-label={t('grants.field')} onChange={(e) => setField(e.target.value)} />
          <button type="button" className="btn" onClick={() => ask(t('grants.find_q').replace('{level}', t(`grants.level_${level}` as 'grants.level_school')).replace('{field}', field.trim() || '—'), router.push)}>
            <Icon name="search" size={16} /> {t('grants.find_go')}
          </button>
        </section>

        <section className="glass menu">
          <div className="menu-row mmt-plan-head"><Icon name="cap" size={20} /><span className="grow">{t('grants.programs')}</span></div>
          {(more ? PROGRAMS : PROGRAMS.slice(0, 6)).map(([flag, name]) => (
            <button key={name} type="button" className="menu-row grants-program" onClick={() => ask(t('grants.program_q').replace('{name}', name), router.push)}>
              <span className="grants-flag" aria-hidden="true">{flag}</span><span className="grow">{name}</span><Icon name="forward" size={16} />
            </button>
          ))}
          <button type="button" className="link-btn" style={{ width: '100%' }} onClick={() => setMore(!more)}>{more ? t('mmt.less') : t('mmt.all').replace('{n}', String(PROGRAMS.length))}</button>
        </section>
        <p className="muted mmt-hint">{t('grants.official')}</p>

        <section className="glass card-pad stack" style={{ gap: 6 }}>
          <b>{t('grants.docs')} · {ready}/{DOCS.length}</b>
          {DOCS.map((d) => (
            <div key={d} className="row grants-doc">
              <label className="row grow" style={{ gap: 10 }}>
                <input type="checkbox" checked={!!docs[d]} onChange={() => toggle(d)} />
                <span className={docs[d] ? 'is-done' : ''}>{t(`grants.doc_${d}` as 'grants.doc_passport')}</span>
              </label>
              {WRITE[d] ? <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => ask(t(WRITE[d] as 'grants.write_cv'), router.push)}>{t('grants.write')}</button> : null}
            </div>
          ))}
        </section>
        <span className="muted" style={{ fontSize: '0.8em', textAlign: 'center' }}>⚠️ {t('grants.scam')}</span>
      </div>
    </>
  )
}
