import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { loadModel, detect, toOriginal, type Box } from './lib/yolo'
import { supabase, activeModel, saveCount, bundleId, installErrorLog, reportError, type Det } from './lib/supabase'
import Login from './Login'
import Review from './Review'
import History from './History'

const APP_VERSION = '0.5.0'
installErrorLog(APP_VERSION)

type Model = { tag: string; file: string; conf: number }
// Kui andmebaasist ei saa mudeli infot (nt võrk puudub), kasutame vaikimisi faili.
const FALLBACK: Model = { tag: 'coco_test', file: 'model.onnx', conf: 0.25 }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!checked) return null
  if (!session) return <Login />
  return <Main email={session.user.email ?? ''} />
}

function Main({ email }: { email: string }) {
  const [view, setView] = useState<'count' | 'history'>('count')
  return (
    <div className="wrap">
      <div className="top">
        <h1>Varraste Loendur</h1>
        <button className="link" onClick={() => setView(view === 'count' ? 'history' : 'count')}>
          {view === 'count' ? 'Ajalugu' : '← Loendama'}
        </button>
        <button className="link" onClick={() => supabase.auth.signOut()}>Logi välja</button>
      </div>
      <div className="who">{email}</div>
      {/* Loendaja jääb alles ka ajaloo ajal (peidetult) – mudelit ei pea uuesti laadima */}
      <div hidden={view !== 'count'}><Counter /></div>
      {view === 'history' && <History />}
    </div>
  )
}

function Counter() {
  const [status, setStatus] = useState('Vajuta "Laadi mudel"')
  const [model, setModel] = useState<Model | null>(null)
  const [shot, setShot] = useState<Shot | null>(null)          // praegu ülevaatusel olev foto
  const [last, setLast] = useState<number | null>(null)        // viimati kinnitatud arv
  const [code, setCode] = useState('')                          // kimbu kood saatelehelt (valikuline)
  const work = useRef<HTMLCanvasElement>(null)                 // nähtamatu canvas mudeli sisendiks

  useEffect(() => { document.title = shot ? 'Kinnita · Varraste Loendur' : 'Varraste Loendur' }, [shot])

  async function onLoad() {
    setStatus('Laen mudelit…')
    let m = FALLBACK
    try {
      const a = await activeModel()
      m = { tag: a.tag, file: a.file_name, conf: a.conf_threshold }
    } catch { /* jääb vaikimisi */ }
    try {
      const ep = await loadModel(`${import.meta.env.BASE_URL}${m.file}`)
      setModel(m)
      setStatus(`Mudel ${m.tag} laetud (${ep}). Pildista kimbu otsa.`)
    } catch (err) {
      console.error(err)
      setStatus(`Mudeli faili "${m.file}" ei õnnestunud laadida.`)
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !model) return
    e.target.value = ''                          // sama faili saab uuesti valida
    const img = await createImageBitmap(f)
    setStatus('Loendan…'); setLast(null)
    const t0 = performance.now()
    const boxes = await detect(img, work.current!, model.conf)
    const ms = Math.round(performance.now() - t0)
    const key = Date.now()
    const bundleCode = code.trim().toUpperCase()
    setShot({ key, img, boxes, countId: null, saveFailed: false, code: bundleCode })
    setStatus(`${ms} ms`)

    // Salvestus taustal, samal ajal kui töötaja parandab. Kinnita-nupp ootab count.id-d.
    try {
      const photo = await toJpeg(img, 2048)
      const predicted: Det[] = boxes.map(b => ({ ...clamp(toOriginal(b, img.width, img.height)), confidence: round(b.s), status: 'predicted' }))
      const bid = await bundleId(bundleCode)
      const countId = await saveCount({ photo: photo.blob, width: photo.w, height: photo.h, modelTag: model.tag, conf: model.conf, predicted, latencyMs: ms, bundleId: bid ?? undefined })
      setShot(s => s && s.key === key ? { ...s, countId } : s)
    } catch (err) {
      console.error(err)
      const msg = reportError('salvestamine', err)
      setShot(s => s && s.key === key ? { ...s, saveFailed: true, saveError: msg } : s)
    }
  }

  function onConfirmed(n: number) { setShot(null); setLast(n); setCode(''); setStatus('Pildista järgmine kimp.') }

  return (
    <>
      {!shot && <>
        <button className="btn" onClick={onLoad} disabled={!!model}>1 · Laadi mudel</button>
        <input className="code" placeholder="Kimbu kood (valikuline)" value={code} autoCapitalize="characters"
               autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value.toUpperCase())} />
        <label className="btn sec" style={{ textAlign: 'center', opacity: model ? 1 : .5 }}>2 · Pildista
          <input type="file" accept="image/*" capture="environment" hidden disabled={!model} onChange={onPhoto} />
        </label>
        {last != null && <div className="status ok center">✓ Kinnitatud: {last}</div>}
      </>}
      <div className="status">{status}</div>
      {shot && <>
        {shot.code && <div className="status center">Kimp: <b>{shot.code}</b></div>}
        <Review key={shot.key} img={shot.img} boxes={shot.boxes} countId={shot.countId} saveFailed={shot.saveFailed} onDone={onConfirmed} />
        {shot.saveFailed && <div className="error">Foto salvestamine ebaõnnestus: {shot.saveError}</div>}
        <button className="link" onClick={() => setShot(null)}>Tühista ja pildista uuesti</button>
      </>}
      <canvas ref={work} width={1024} height={1024} hidden />
    </>
  )
}

type Shot = { key: number; img: ImageBitmap; boxes: Box[]; countId: string | null; saveFailed: boolean; saveError?: string; code: string }

/** Foto JPEG-iks, pikem külg max `max` px (~1 MB) – Storage'i tasuta 1 GB jaoks. */
async function toJpeg(img: ImageBitmap, max: number) {
  const r = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.round(img.width * r), h = Math.round(img.height * r)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob>((ok, fail) => c.toBlob(b => b ? ok(b) : fail(new Error('toBlob')), 'image/jpeg', 0.85))
  return { blob, w, h }
}

// Andmebaas lubab ainult 0–1; serva-kastid võivad pildist natuke välja ulatuda.
const c01 = (v: number) => Math.min(1, Math.max(0, v))
const clamp = (d: { cx: number; cy: number; w: number; h: number }) => ({ cx: c01(d.cx), cy: c01(d.cy), w: c01(d.w), h: c01(d.h) })
const round = (v: number) => Math.round(v * 1000) / 1000
