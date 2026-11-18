'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { BlockView, type Asset, type Block } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { ErrorState, Loading } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface Page { title: string; body: Omit<Block, 'id'>[]; assets: Record<string, Asset> }

export default function CmsPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, locale } = usePrefs()
  const page = useApi<Page>(`/pages/${encodeURIComponent(slug)}?locale=${locale}`)
  return (
    <article className="reader">
      <header className="topbar"><Link href="/settings" className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link></header>
      {page.error ? <ErrorState error={page.error} onRetry={page.reload} /> : !page.data ? <Loading /> : (
        <>
          <h1>{page.data.title}</h1>
          <div className="blocks">{page.data.body.map((b, i) => <BlockView key={i} block={{ ...b, id: String(i) }} assets={page.data!.assets} />)}</div>
        </>
      )}
    </article>
  )
}
