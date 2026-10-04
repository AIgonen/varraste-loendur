import { useRef, useState } from 'react'

// Kahe sõrmega suurendus + ühe sõrmega lohistamine + puudutus (tap) ühel elemendil.
// Sisu (canvas) saab CSS transformi; konteiner peab olema overflow:hidden ja touch-action:none.
//  - 2 sõrme  → suurenda/vähenda ümber sõrmede keskpunkti ja liiguta
//  - 1 sõrm, liigub > 8 px → lohista (ainult suurendatud olekus)
//  - 1 sõrm, ei liigu → onTap(clientX, clientY)
//  - hiireratas (arvutis) → suurenda kursori ümber

export type View = { s: number; tx: number; ty: number }
const MIN = 1, MAX = 6, MOVE = 8

export function usePinchZoom(onTap: (clientX: number, clientY: number) => void) {
  const box = useRef<HTMLDivElement>(null)
  const [view, setViewState] = useState<View>({ s: 1, tx: 0, ty: 0 })
  const v = useRef(view)                                  // värske väärtus sündmuste jaoks
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const g = useRef({ moved: false, x0: 0, y0: 0, v0: view, d0: 1, m0: { x: 0, y: 0 } })

  function setView(n: View) {
    const W = box.current?.clientWidth ?? 0, H = box.current?.clientHeight ?? 0
    const s = Math.min(MAX, Math.max(MIN, n.s))
    // sisu peab konteineri täitma – ei saa pilti servast välja lohistada
    const tx = Math.min(0, Math.max(W - W * s, n.tx)), ty = Math.min(0, Math.max(H - H * s, n.ty))
    v.current = { s, tx, ty }; setViewState(v.current)
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const two = () => { const [a, b] = [...ptrs.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } }
  const startDrag = (p: { x: number; y: number }, moved: boolean) => { g.current = { ...g.current, moved, x0: p.x, y0: p.y, v0: v.current } }

  /** Suurenda teguriga k ümber konteineri punkti p. */
  function zoomAt(k: number, p: { x: number; y: number }, from = v.current) {
    const s = Math.min(MAX, Math.max(MIN, from.s * k))
    const cx = (p.x - from.tx) / from.s, cy = (p.y - from.ty) / from.s   // sisu punkt sõrmede all
    setView({ s, tx: p.x - cx * s, ty: p.y - cy * s })
  }

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      box.current!.setPointerCapture(e.pointerId)
      ptrs.current.set(e.pointerId, local(e))
      if (ptrs.current.size === 1) startDrag(local(e), false)
      if (ptrs.current.size === 2) { const t = two(); g.current = { ...g.current, moved: true, v0: v.current, d0: t.d, m0: t.m } }
    },
    onPointerMove(e: React.PointerEvent) {
      if (!ptrs.current.has(e.pointerId)) return
      const p = local(e); ptrs.current.set(e.pointerId, p)
      if (ptrs.current.size === 2) {
        const t = two(), o = g.current
        // suurendus ümber algse keskpunkti + nihe keskpunkti liikumise võrra
        const s = Math.min(MAX, Math.max(MIN, o.v0.s * t.d / o.d0))
        const cx = (o.m0.x - o.v0.tx) / o.v0.s, cy = (o.m0.y - o.v0.ty) / o.v0.s
        setView({ s, tx: t.m.x - cx * s, ty: t.m.y - cy * s })
      } else if (ptrs.current.size === 1) {
        const o = g.current
        if (!o.moved && Math.hypot(p.x - o.x0, p.y - o.y0) > MOVE) o.moved = true
        if (o.moved && o.v0.s > 1) setView({ s: o.v0.s, tx: o.v0.tx + p.x - o.x0, ty: o.v0.ty + p.y - o.y0 })
      }
    },
    onPointerUp(e: React.PointerEvent) {
      if (!ptrs.current.has(e.pointerId)) return
      const wasSingle = ptrs.current.size === 1
      ptrs.current.delete(e.pointerId)
      if (wasSingle && !g.current.moved) onTap(e.clientX, e.clientY)
      // pärast pinch'i jääb üks sõrm – jätka lohistamist sealt, ilma et see tap'iks loeks
      if (ptrs.current.size === 1) startDrag([...ptrs.current.values()][0], true)
    },
    onPointerCancel(e: React.PointerEvent) { ptrs.current.delete(e.pointerId) },
    onWheel(e: React.WheelEvent) { zoomAt(e.deltaY < 0 ? 1.25 : 0.8, local(e)) },
  }

  const center = () => ({ x: (box.current?.clientWidth ?? 0) / 2, y: (box.current?.clientHeight ?? 0) / 2 })
  return {
    box, view, handlers,
    zoomIn: () => zoomAt(1.6, center()),
    zoomOut: () => zoomAt(1 / 1.6, center()),
    reset: () => setView({ s: 1, tx: 0, ty: 0 }),
    style: { transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`, transformOrigin: '0 0' } as React.CSSProperties,
  }
}
