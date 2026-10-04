import { useEffect, useRef, useState } from 'react'
import { SIZE, toOriginal, type Box } from './lib/yolo'
import { confirmCount, type Det } from './lib/supabase'
import { usePinchZoom } from './lib/zoom'

// Kinnitusvaade: töötaja parandab mudeli tulemuse ja kinnitab lõpliku arvu.
//  - puuduta ringi  → eemalda (punane rist); uuesti puudutades taastub
//  - puuduta tühja kohta → lisa uus ots (sinine ring)
//  - kaks sõrme → suurenda; suurendatult üks sõrm lohistab
//  - "Kinnita" → confirm_count: lõplik arv + iga ots lõpliku staatusega (treeninguandmed)

type Item = { b: Box; kind: 'model' | 'added'; removed: boolean }

export default function Review({ img, boxes, countId, saveFailed, onDone }: {
  img: ImageBitmap; boxes: Box[]; countId: string | null; saveFailed: boolean; onDone: (final: number) => void
}) {
  const [items, setItems] = useState<Item[]>(() => boxes.map(b => ({ b, kind: 'model', removed: false })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const final = items.filter(i => !i.removed).length
  const removed = items.filter(i => i.removed).length
  const added = items.filter(i => i.kind === 'added').length

  useEffect(() => { draw(canvas.current!, img, items) }, [img, items])
  const zoom = usePinchZoom(onTap)

  function onTap(clientX: number, clientY: number) {
    // getBoundingClientRect arvestab ka suurendust, seega koordinaadid on alati õiged
    const c = canvas.current!, rect = c.getBoundingClientRect()
    const scale = SIZE / rect.width
    const x = (clientX - rect.left) * scale, y = (clientY - rect.top) * scale
    const minHit = 14 * scale                       // vähemalt ~14 px sõrme all, ka väikeste otste puhul
    // lähim ring, mille sisse puudutus jääb
    let hit = -1, best = Infinity
    items.forEach((it, i) => {
      const { cx, cy, r } = circle(it.b), d = Math.hypot(x - cx, y - cy)
      if (d <= Math.max(r, minHit) && d < best) { best = d; hit = i }
    })
    if (hit >= 0) {
      const it = items[hit]
      setItems(it.kind === 'added' ? items.filter((_, i) => i !== hit)                    // lisatud: kustuta
                                   : items.map((v, i) => i === hit ? { ...v, removed: !v.removed } : v))
    } else {
      // hall ääris fotost väljas – sinna otsa lisada ei saa
      const k = Math.min(SIZE / img.width, SIZE / img.height)
      const dx = (SIZE - img.width * k) / 2, dy = (SIZE - img.height * k) / 2
      if (x < dx || x > SIZE - dx || y < dy || y > SIZE - dy) return
      const s = typicalSize(items)
      setItems([...items, { b: { x1: x - s / 2, y1: y - s / 2, x2: x + s / 2, y2: y + s / 2, s: 1 }, kind: 'added', removed: false }])
    }
  }

  async function onConfirm() {
    if (!countId) return
    setBusy(true); setError('')
    try {
      const dets: Det[] = items.map(it => ({
        ...clamp(toOriginal(it.b, img.width, img.height)),
        confidence: it.kind === 'added' ? null : Math.round(it.b.s * 1000) / 1000,
        status: it.kind === 'added' ? 'added_by_user' : it.removed ? 'removed' : 'confirmed',
      }))
      await confirmCount(countId, final, dets)
      onDone(final)
    } catch (err) {
      console.error(err)
      setError('Kinnitamine ebaõnnestus – kontrolli võrku ja proovi uuesti.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="count">{final}</div>
      <div className="status center">
        Mudel leidis {boxes.length}{removed ? ` · eemaldatud ${removed}` : ''}{added ? ` · lisatud ${added}` : ''}
      </div>
      <div className="zoombox" ref={zoom.box} {...zoom.handlers}>
        <canvas ref={canvas} width={SIZE} height={SIZE} className="tap" style={zoom.style} />
        <div className="zoombtns" onPointerDown={e => e.stopPropagation()}>
          <button onClick={zoom.zoomIn} aria-label="Suurenda">+</button>
          <button onClick={zoom.zoomOut} aria-label="Vähenda" disabled={zoom.view.s <= 1}>−</button>
          {zoom.view.s > 1 && <button onClick={zoom.reset} aria-label="Kogu pilt">⤢</button>}
        </div>
      </div>
      <div className="hint">Puuduta ringi, et see eemaldada. Puuduta tühja otsa kohta, et lisada. Kahe sõrmega saab suurendada.</div>
      <button className="btn" onClick={onConfirm} disabled={busy || !countId}>
        {busy ? 'Kinnitan…' : countId ? `Kinnita ${final}` : saveFailed ? 'Foto salvestamine ebaõnnestus' : 'Salvestan fotot…'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

function circle(b: Box) {
  return { cx: (b.x1 + b.x2) / 2, cy: (b.y1 + b.y2) / 2, r: Math.max(b.x2 - b.x1, b.y2 - b.y1) / 2 }
}

/** Uue ringi suurus = mudeli leitud otste mediaan (kõik vardad kimbus on enam-vähem sama jämedad). */
function typicalSize(items: Item[]) {
  const s = items.map(i => Math.max(i.b.x2 - i.b.x1, i.b.y2 - i.b.y1)).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 40
}

function draw(c: HTMLCanvasElement, img: ImageBitmap, items: Item[]) {
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#727272'; ctx.fillRect(0, 0, SIZE, SIZE)
  const r = Math.min(SIZE / img.width, SIZE / img.height)
  const w = Math.round(img.width * r), h = Math.round(img.height * r)
  ctx.drawImage(img, Math.floor((SIZE - w) / 2), Math.floor((SIZE - h) / 2), w, h)
  ctx.lineWidth = 3
  for (const it of items) {
    const { cx, cy, r } = circle(it.b)
    if (it.removed) {
      ctx.strokeStyle = '#e03030'; const k = r * 0.7
      ctx.beginPath(); ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k); ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k); ctx.stroke()
    } else {
      ctx.strokeStyle = it.kind === 'added' ? '#2f7de0' : '#e0b000'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    }
  }
}

const c01 = (v: number) => Math.min(1, Math.max(0, v))
const clamp = (d: { cx: number; cy: number; w: number; h: number }) => ({ cx: c01(d.cx), cy: c01(d.cy), w: c01(d.w), h: c01(d.h) })
