'use client'

import { useEffect, useState } from 'react'

import { apiUrl } from '../offline/base'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { YouTube } from './YouTube'

/**
 * A song found on YouTube for her words, playing in the app's own player; under it the other songs found, to
 * choose another. Asked of the server (which keeps every search for a week, for everyone).
 */
interface Song { id: string; title: string; channel: string; thumb: string }

export function SongPlayer({ query, title }: { query: string; title?: string }) {
  const { t, locale } = usePrefs()
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [problem, setProblem] = useState(false)
  const [at, setAt] = useState(0)
  useEffect(() => {
    let alive = true
    setSongs(null)
    setProblem(false)
    fetch(apiUrl(`/music/find?q=${encodeURIComponent(query)}&lang=${locale}`), { signal: AbortSignal.timeout(12_000) })
      .then((r) => (r.ok ? r.json() as Promise<{ songs: Song[] }> : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) { setSongs(d.songs); setAt(0) } })
      .catch(() => { if (alive) setProblem(true) })
    return () => { alive = false }
  }, [query, locale])

  if (problem) return <p className="song-none">{t('song.unavailable')}</p>
  if (!songs) return <div className="song-player"><div className="skeleton song-wait"><Icon name="music" size={22} /><span>{t('song.searching').replace('{q}', title ?? query)}</span></div></div>
  if (!songs.length) return <p className="song-none">{t('song.none').replace('{q}', title ?? query)}</p>
  const song = songs[at]
  return (
    <div className="song-player">
      <YouTube key={song.id} id={song.id} title={song.title} />
      <b className="song-title">{song.title}</b>
      <span className="song-channel">{song.channel}</span>
      {songs.length > 1 ? (
        <div className="song-more" role="list" aria-label={t('song.more')}>
          {songs.map((s, i) => (i === at ? null : (
            <button key={s.id} type="button" role="listitem" className="song-other" onClick={() => setAt(i)}>
              <img src={s.thumb} alt="" loading="lazy" />
              <span className="grow"><b>{s.title}</b><span>{s.channel}</span></span>
              <Icon name="play" size={14} />
            </button>
          )))}
        </div>
      ) : null}
    </div>
  )
}
