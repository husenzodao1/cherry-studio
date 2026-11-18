'use client'

import { Suspense } from 'react'

import { BlockView, type Asset, type Block } from '@/web/components/Blocks'
import { Header } from '@/web/components/Header'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { useQueryParam } from '@/web/useQueryParam'

/** CMS pages (about, privacy, terms) from the content stored on the phone. */
export default function CmsPage() {
  return <Suspense fallback={<Loading />}><Page /></Suspense>
}

function Page() {
  const slug = useQueryParam('slug')
  const { bundle, loading } = useContent()
  const page = bundle?.pages[slug] as { title: string; body: Omit<Block, 'id'>[]; assets?: Record<string, Asset> } | undefined
  return (
    <article className="reader">
      <Header back="/settings" title={page?.title} />
      {!page ? (loading ? <Loading /> : <Empty icon="info" title="—" />) : (
        <div className="glass card-pad" style={{ marginTop: 16 }}>
          <div className="blocks" style={{ marginTop: 0 }}>{page.body.map((b, i) => <BlockView key={i} block={{ ...b, id: String(i) }} assets={page.assets ?? {}} />)}</div>
        </div>
      )}
    </article>
  )
}
