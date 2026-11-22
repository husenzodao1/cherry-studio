'use client'

import { useEffect, useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { Note, send, useAction } from './ui'

/** Users, staff roles and Premium access. Only a super admin can change roles (checked in the database). */

const ROLES: { role: string; label: string }[] = [
  { role: 'super_admin', label: 'Супер-админ' }, { role: 'content_admin', label: 'Админи мундариҷа' }, { role: 'author', label: 'Муаллиф' },
  { role: 'editor', label: 'Муҳаррир' }, { role: 'reviewer', label: 'Тақризчӣ' }, { role: 'media_manager', label: 'Медиа' },
  { role: 'analytics_viewer', label: 'Таҳлил' }
]

interface User { id: string; email: string; display_name: string | null; roles: string[]; premium: boolean; created_at: string }

export function Users() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(h)
  }, [q])
  const list = useApi<User[]>(`/admin/users?limit=100${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <input className="input" type="search" placeholder="Почта ё ном" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {(list.data ?? []).map((u) => <UserRow key={u.id} user={u} onChanged={list.reload} />)}
    </div>
  )
}

function UserRow({ user, onChanged }: { user: User; onChanged: () => void }) {
  const act = useAction()
  const toggle = async (role: string, has: boolean) => {
    const ok = await act.run(() => has
      ? send(`/admin/users/${user.id}/roles/${role}`, 'DELETE')
      : send(`/admin/users/${user.id}/roles`, 'POST', { role }), 'Нақш иваз шуд')
    if (ok !== undefined) onChanged()
  }
  const premium = async () => {
    if (await act.run(() => send(`/admin/users/${user.id}/entitlements`, 'POST', { note: 'admin panel' }), 'Premium дода шуд')) onChanged()
  }
  return (
    <div className="card card-pad stack" style={{ gap: 8 }}>
      <div className="row"><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 500 }}>{user.display_name || user.email}</b>
        <div className="muted" style={{ fontSize: '0.85em', overflowWrap: 'anywhere' }}>{user.email}</div></div>
        {user.premium ? <span className="chip" style={{ minHeight: 26 }}>Premium</span> : <button type="button" className="chip" onClick={premium} disabled={act.busy}>+ Premium</button>}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {ROLES.map((r) => {
          const has = user.roles.includes(r.role)
          return <button key={r.role} type="button" className="chip" aria-pressed={has} onClick={() => toggle(r.role, has)} disabled={act.busy}>{r.label}</button>
        })}
      </div>
      <Note message={act.message} />
    </div>
  )
}
