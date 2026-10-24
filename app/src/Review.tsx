import { useEffect, useMemo, useRef, useState } from 'react'
import { SIZE, toOriginal, select, defaultTune, letterbox, size, median, MAX_OFF, type Box, type Tune, type Roi, type Inference } from './lib/yolo'
import { confirmCount, reportError, type Det } from './lib/supabase'
import { usePinchZoom } from './lib/zoom'
import { downloadPdf, downloadPng, type Report } from './lib/export'

// Kinnitusvaade: töötaja tuunib ja parandab mudeli tulemuse ning kinnitab lõpliku arvu.
//  - "Seaded": liugurid (lävi, kattuvus, suurusfilter, kontrast) ja loendatava ala valik – ringid muutuvad kohe
//  - puuduta ringi  → eemalda (punane rist); uuesti puudutades taastub
//  - puuduta tühja kohta → lisa uus ots (sinine ring)
//  - kaks sõrme → suurenda; suurendatult üks sõrm lohistab
//  - "Kinnita" → confirm_count: lõplik arv + iga ots lõpliku staatusega (treeninguandmed)
//  - "PNG" / "PDF" → tulemus alla laadida (trükikõlblik raport)

type Props = {
  img: ImageBitmap; first: Inference; conf: number; rerun: (contrast: number) => Promise<Inference>
  countId: string | null; saveFailed: boolean; onDone: (final: number) => void
  demo: boolean; code: string; modelTag: string
}

export default function Review({ img, first, conf, rerun, countId, saveFailed, onDone, demo, code, modelTag }: Props) {
  const [inf, setInf] = useState(first)
  const [infContrast, setInfContrast] = useState(0)          // millise kontrastiga `inf` arvutati
  const [tune, setTune] = useState<Tune>(() => defaultTune(conf))
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
  const [added, setAdded] = useState<Box[]>([])
  const [rerunning, setRerunning] = useState(false)
  const [roiMode, setRoiMode] = useState(false)
  const [drag, setDrag] = useState<Roi | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')                    // käsitsi üle loetud arv (valikuline)
  const canvas = useRef<HTMLCanvasElement>(null)

  const predicted = useMemo(() => select(first.cands, defaultTune(conf)).length, [first, conf])
  const shown = useMemo(() => select(inf.cands, tune), [inf, tune])           // jookseb iga liuguri liigutusega
  const kept = shown.filter(b => !removedIds.has(b.id!))
  const removed = shown.length - kept.length
  const final = kept.length + added.length
  const manualN = /^\d+$/.test(manual.trim()) ? parseInt(manual.trim(), 10) : null
  const diff = manualN == null ? 0 : manualN - final

  useEffect(() => { draw(canvas.current!, inf.view, shown, removedIds, added, tune.roi, drag) }, [inf, shown, removedIds, added, tune.roi, drag])

  // kontrast muudab mudeli sisendit → mudel uuesti, aga alles siis, kui liugur on 400 ms paigal
  useEffect(() => {
    if (tune.contrast === infContrast) return
    const want = tune.contrast
    const t = setTimeout(async () => {
      setRerunning(true)
      try { const r = await rerun(want); setInf(r); setInfContrast(want); setRemovedIds(new Set()) }
      catch (err) { setError(`Uus tuvastus ebaõnnestus: ${reportError('kontrast', err)}`) }
      finally { setRerunning(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [tune.contrast, infContrast, rerun])

  const zoom = usePinchZoom(onTap)
  // ala valimisel too pilt nähtavale (nupp on paneelis pildi all)
  useEffect(() => { if (roiMode) zoom.box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [roiMode])
  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvas.current!.getBoundingClientRect(), k = SIZE / rect.width   // arvestab ka suurendust
    return { x: (clientX - rect.left) * k, y: (clientY - rect.top) * k, k }
  }

  function onTap(clientX: number, clientY: number) {
    const { x, y, k } = toCanvas(clientX, clientY)
    const minHit = 14 * k                           // vähemalt ~14 px sõrme all, ka väikeste otste puhul
    const near = (b: Box) => { const { cx, cy, r } = circle(b), d = Math.hypot(x - cx, y - cy); return d <= Math.max(r, minHit) ? d : Infinity }
    let ai = -1, ad = Infinity; added.forEach((b, i) => { const d = near(b); if (d < ad) { ad = d; ai = i } })
    let mi = -1, md = Infinity; shown.forEach((b, i) => { const d = near(b); if (d < md) { md = d; mi = i } })
    if (ai >= 0 && ad <= md) { setAdded(added.filter((_, i) => i !== ai)); return }                 // lisatud: kustuta
    if (mi >= 0) {                                                                                  // mudeli oma: lülita
      const id = shown[mi].id!, s = new Set(removedIds); s.has(id) ? s.delete(id) : s.add(id); setRemovedIds(s); return
    }
    const { dx, dy, w, h } = letterbox(img.width, img.height)
    if (x < dx || x > dx + w || y < dy || y > dy + h) return       // hall ääris fotost väljas
    const s = median(shown.map(size)) || 40
    setAdded([...added, { x1: x - s / 2, y1: y - s / 2, x2: x + s / 2, y2: y + s / 2, s: 1 }])
  }

  // loendatava ala valik: lohista ristkülik (suurendus ja puudutused on selle ajal välja lülitatud)
  const roiStart = useRef<{ x: number; y: number } | null>(null)
  const roiHandlers = {
    onPointerDown(e: React.PointerEvent) {
      e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId)
      const p = toCanvas(e.clientX, e.clientY); roiStart.current = p; setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
    },
    onPointerMove(e: React.PointerEvent) {
      e.stopPropagation(); if (!roiStart.current) return
      const p = toCanvas(e.clientX, e.clientY), s = roiStart.current
      setDrag({ x1: Math.min(s.x, p.x), y1: Math.min(s.y, p.y), x2: Math.max(s.x, p.x), y2: Math.max(s.y, p.y) })
    },
    onPointerUp(e: React.PointerEvent) {
      e.stopPropagation(); roiStart.current = null
      if (drag && drag.x2 - drag.x1 > 30 && drag.y2 - drag.y1 > 30) { setTune({ ...tune, roi: drag }); setRoiMode(false) }
      setDrag(null)
    },
  }

  function report(): Report {
    return { img, kept: [...kept, ...added], added: added.length, removed, predicted, code, modelTag, tune, manual: manualN, when: new Date() }
  }
  async function exportAs(kind: 'png' | 'pdf') {
    try { await (kind === 'png' ? downloadPng : downloadPdf)(report(), kept.length) }
    catch (err) { setError(`Eksport ebaõnnestus: ${reportError('eksport', err)}`) }
  }

  async function onConfirm() {
    if (!countId) return
    setBusy(true); setError('')
    try {
      const det = (b: Box, status: Det['status']): Det => ({
        ...clamp(toOriginal(b, img.width, img.height)), confidence: status === 'added_by_user' ? null : Math.round(b.s * 1000) / 1000, status,
      })
      const dets = [...shown.map(b => det(b, removedIds.has(b.id!) ? 'removed' : 'confirmed')), ...added.map(b => det(b, 'added_by_user'))]
      await confirmCount(countId, final, dets, manualN)
      onDone(final)
    } catch (err) {
      console.error(err)
      setError(`Kinnitamine ebaõnnestus: ${reportError('kinnitamine', err)}`)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="count">{final}</div>
      <div className="status center">
        {rerunning ? 'Tuvastan uuesti…' : <>Mudel leidis {predicted}{shown.length !== predicted ? ` · seadetega ${shown.length}` : ''}
          {removed ? ` · eemaldatud ${removed}` : ''}{added.length ? ` · lisatud ${added.length}` : ''}</>}
      </div>
      <div className="zoombox" ref={zoom.box} {...zoom.handlers}>
        <canvas ref={canvas} width={SIZE} height={SIZE} className="tap" style={zoom.style} />
        {roiMode && <div className="roilayer" {...roiHandlers} />}
        <div className="zoombtns" onPointerDown={e => e.stopPropagation()}>
          <button onClick={zoom.zoomIn} aria-label="Suurenda">+</button>
          <button onClick={zoom.zoomOut} aria-label="Vähenda" disabled={zoom.view.s <= 1}>−</button>
          {zoom.view.s > 1 && <button onClick={zoom.reset} aria-label="Kogu pilt">⤢</button>}
        </div>
      </div>
      <div className="hint">
        {roiMode ? 'Lohista sõrmega ristkülik ümber kimbu, mida loendada. Väljapoole jäävaid otsi ei loeta.'
                 : 'Puuduta ringi, et see eemaldada. Puuduta tühja otsa kohta, et lisada. Kahe sõrmega saab suurendada.'}
      </div>

      <Tuning tune={tune} setTune={setTune} conf={conf} roiMode={roiMode} setRoiMode={setRoiMode} rerunning={rerunning} />

      <div className="row2">
        <button className="btn sec" onClick={() => exportAs('png')}>⬇ PNG</button>
        <button className="btn sec" onClick={() => exportAs('pdf')}>⬇ PDF-raport</button>
      </div>

      <label className="manual">Käsitsi loetud arv <span className="muted">(kui lugesid kimbu üle)</span>
        <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="nt 152" value={manual}
               onChange={e => setManual(e.target.value.replace(/\D/g, '').slice(0, 5))} />
      </label>
      {manualN != null && diff !== 0 && (
        <div className="warn">
          Ringe on {final}, käsitsi {manualN} – {diff > 0 ? `${diff} otsa on märkimata` : `${-diff} ringi on liigsed`}?
          Paranda ringid, kui leiad. Võid kinnitada ka nii – erinevus salvestatakse.
        </div>
      )}
      {demo ? <div className="status center">Demorežiim – tulemust ei salvestata. Lae alla PNG või PDF.</div>
        : <button className="btn" onClick={onConfirm} disabled={busy || !countId || rerunning}>
            {busy ? 'Kinnitan…' : countId ? `Kinnita ${final}` : saveFailed ? 'Foto salvestamine ebaõnnestus' : 'Salvestan fotot…'}
          </button>}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

/** Tuunimise paneel. Iga liugur mõjutab ühte sammu, ülejäänud jäävad samaks. */
function Tuning({ tune, setTune, conf, roiMode, setRoiMode, rerunning }: {
  tune: Tune; setTune: (t: Tune) => void; conf: number; roiMode: boolean; setRoiMode: (v: boolean) => void; rerunning: boolean
}) {
  const set = (k: keyof Tune) => (e: React.ChangeEvent<HTMLInputElement>) => setTune({ ...tune, [k]: parseFloat(e.target.value) })
  const changed = JSON.stringify(tune) !== JSON.stringify(defaultTune(conf))
  return (
    <details className="tune">
      <summary>Seaded {changed && <span className="muted">· muudetud</span>}</summary>
      <Slider label="Tundlikkus" value={tune.conf} min={0.05} max={0.9} step={0.01} onChange={set('conf')}
              show={v => v.toFixed(2)} help="Madalam → mudel julgeb rohkem otsi pakkuda (ka valesid). Kõrgem → ainult kindlad otsad." />
      <Slider label="Kattuvate liitmine" value={tune.iou} min={0.1} max={0.9} step={0.05} onChange={set('iou')}
              show={v => v.toFixed(2)} help="Madalam → kõrvuti kastid liidetakse kergemini üheks. Kõrgem → tihedas kimbus jäävad naabrid alles." />
      <Slider label="Väikseim ots" value={tune.minRel} min={0} max={0.9} step={0.05} onChange={set('minRel')}
              show={v => v > 0 ? `${Math.round(v * 100)}% tüüpilisest` : 'piiranguta'} help="Kaotab tüüpilisest palju väiksemad leiud – nt taga oleva kimbu otsad või müra." />
      <Slider label="Suurim ots" value={tune.maxRel} min={1.1} max={MAX_OFF} step={0.1} onChange={set('maxRel')}
              show={v => v < MAX_OFF ? `${Math.round(v * 100)}% tüüpilisest` : 'piiranguta'} help="Kaotab liiga suured leiud – nt kaks otsa ühes kastis või ringikujuline taust." />
      <Slider label="Kontrastivõimendus" value={tune.contrast} min={0} max={4} step={0.5} onChange={set('contrast')}
              show={v => v > 0 ? v.toFixed(1) : 'väljas'} help={rerunning ? 'Tuvastan uuesti…' : 'Hämaral või madala kontrastiga fotol tõstab otste ja vahede erinevust (CLAHE). Mudel jookseb uuesti (~1 s).'} />
      <div className="row2">
        <button className={`btn sec small-btn${roiMode ? ' on' : ''}`} onClick={() => setRoiMode(!roiMode)}>
          {roiMode ? 'Tühista ala valik' : tune.roi ? 'Vali ala uuesti' : 'Vali loendatav ala'}
        </button>
        <button className="btn sec small-btn" disabled={!tune.roi} onClick={() => setTune({ ...tune, roi: null })}>Kogu foto</button>
      </div>
      <button className="link" disabled={!changed} onClick={() => setTune(defaultTune(conf))}>Taasta vaikimisi</button>
    </details>
  )
}

function Slider({ label, value, min, max, step, onChange, show, help }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; show: (v: number) => string; help: string
}) {
  return (
    <label className="slider">
      <span className="sl-head"><b>{label}</b><span>{show(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      <span className="sl-help">{help}</span>
    </label>
  )
}

function circle(b: Box) {
  return { cx: (b.x1 + b.x2) / 2, cy: (b.y1 + b.y2) / 2, r: Math.max(b.x2 - b.x1, b.y2 - b.y1) / 2 }
}

function draw(c: HTMLCanvasElement, view: ImageData, shown: Box[], removedIds: Set<number>, added: Box[], roi: Roi | null, drag: Roi | null) {
  const ctx = c.getContext('2d')!
  ctx.putImageData(view, 0, 0)                     // mudeli nähtud pilt (kontrastiga, kui see on sees)
  const area = drag ?? roi
  if (area) {                                      // väljaspool ala tumedaks
    ctx.fillStyle = 'rgba(0,0,0,.55)'
    ctx.beginPath(); ctx.rect(0, 0, SIZE, SIZE); ctx.rect(area.x1, area.y1, area.x2 - area.x1, area.y2 - area.y1); ctx.fill('evenodd')
    ctx.setLineDash([12, 8]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3
    ctx.strokeRect(area.x1, area.y1, area.x2 - area.x1, area.y2 - area.y1); ctx.setLineDash([])
  }
  ctx.lineWidth = 3
  for (const b of shown) {
    const { cx, cy, r } = circle(b)
    if (removedIds.has(b.id!)) {
      ctx.strokeStyle = '#e03030'; const k = r * 0.7
      ctx.beginPath(); ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k); ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k); ctx.stroke()
    } else { ctx.strokeStyle = '#e0b000'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke() }
  }
  ctx.strokeStyle = '#2f7de0'
  for (const b of added) { const { cx, cy, r } = circle(b); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke() }
}

const c01 = (v: number) => Math.min(1, Math.max(0, v))
const clamp = (d: { cx: number; cy: number; w: number; h: number }) => ({ cx: c01(d.cx), cy: c01(d.cy), w: c01(d.w), h: c01(d.h) })
