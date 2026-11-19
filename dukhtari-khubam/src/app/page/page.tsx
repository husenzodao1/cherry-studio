'use client'

import { Suspense } from 'react'

import { BlockView, type Asset, type Block } from '@/web/components/Blocks'
import { Header } from '@/web/components/Header'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

/** Document pages (about, privacy, terms), entered in the panel; shown plainly, like a printed document. */
export default function CmsPage() {
  return <Suspense fallback={<Loading />}><Page /></Suspense>
}

function Page() {
  const slug = useQueryParam('slug')
  const { t } = usePrefs()
  const { bundle, loading } = useContent()
  const page = bundle?.pages[slug] as { title: string; body: Omit<Block, 'id'>[]; assets?: Record<string, Asset>; updated_at?: string } | undefined
  return (
    <>
      <Header back="/settings" />
      {!page ? (loading ? <Loading /> : <Empty icon="info" title="—" />) : (
        <article className="doc">
          <header className="doc-head">
            <span className="doc-brand">{t('app.name')} · {t('settings.version')} {process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? ''}</span>
            <h1>{page.title}</h1>
          </header>
          <div className="doc-body">{page.body.map((b, i) => <BlockView key={i} block={{ ...b, id: String(i) }} assets={page.assets ?? {}} />)}</div>
        </article>
      )}
    </>
  )
}
