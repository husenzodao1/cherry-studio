'use client'

import 'leaflet/dist/leaflet.css'

import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import { useEffect, useRef, useState } from 'react'

import type { LatLon } from '@/lib/navigation'

/**
 * The map of "Маро бубар" (OpenStreetMap): the way as a thick line, where she is (a blue dot with the way she
 * faces) and where she goes (a pin). While she goes, the map keeps her in its middle; before, it shows the
 * whole way.
 */
export function NavMap({ line, me, heading, to, following, recenter = 0 }: { line: LatLon[] | null; me: LatLon | null; heading: number | null; to: LatLon | null; following: boolean; recenter?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  // the map's library arrives a moment later: what came before it is drawn then
  const [loaded, setLoaded] = useState(false)
  const seen = useRef(false)
  const parts = useRef<{ way?: Polyline; under?: Polyline; me?: Marker; to?: Marker; L?: typeof import('leaflet') }>({})

  // the map, once
  useEffect(() => {
    let gone = false
    void import('leaflet').then((L) => {
      if (gone || !box.current || map.current) return
      parts.current.L = L
      map.current = L.map(box.current, { zoomControl: false, attributionControl: true }).setView(me ?? [38.5598, 68.787], 14)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current)
      setLoaded(true)
    })
    return () => {
      gone = true
      // a zoom or pan still moving when the map goes: stopped first (Leaflet would finish it on a removed map)
      const m = map.current
      if (m) { m.stop(); m.off(); m.remove() }
      map.current = null
      parts.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the way, and where she goes
  useEffect(() => {
    const L = parts.current.L
    if (!L || !map.current) return
    parts.current.way?.remove()
    parts.current.under?.remove()
    parts.current.to?.remove()
    if (line?.length) {
      parts.current.under = L.polyline(line, { color: '#ffffff', weight: 11, opacity: 0.95 }).addTo(map.current)
      parts.current.way = L.polyline(line, { color: '#6d5cff', weight: 7, opacity: 1 }).addTo(map.current)
      if (!following) map.current.fitBounds(L.latLngBounds(line), { padding: [40, 40] })
    }
    if (to) parts.current.to = L.marker(to, { icon: L.divIcon({ className: 'nav-pin', html: '<span></span>', iconSize: [34, 44], iconAnchor: [17, 42] }) }).addTo(map.current)
  }, [line, to, following, loaded])

  // where she is, the way she faces
  useEffect(() => {
    const L = parts.current.L
    if (!L || !map.current || !me) return
    const html = `<span class="nav-me-dot"></span>${heading !== null ? `<span class="nav-me-cone" style="transform: rotate(${heading}deg)"></span>` : ''}`
    if (!parts.current.me) parts.current.me = L.marker(me, { icon: L.divIcon({ className: 'nav-me', html, iconSize: [44, 44], iconAnchor: [22, 22] }), zIndexOffset: 1000 }).addTo(map.current)
    else {
      parts.current.me.setLatLng(me)
      parts.current.me.setIcon(L.divIcon({ className: 'nav-me', html, iconSize: [44, 44], iconAnchor: [22, 22] }))
    }
    if (following) map.current.setView(me, Math.max(map.current.getZoom(), 17), { animate: true })
    // her place found for the first time, no way drawn yet: the map goes to her
    else if (!seen.current && !line?.length) map.current.setView(me, 16, { animate: true })
    seen.current = true
  }, [me, heading, following, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // "my place": the map back to her
  useEffect(() => {
    if (recenter && me && map.current) map.current.setView(me, Math.max(map.current.getZoom(), 16), { animate: true })
  }, [recenter]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="nav-map" role="img" aria-label="OpenStreetMap" />
}
