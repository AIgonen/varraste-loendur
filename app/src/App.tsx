import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { loadModel, infer, select, defaultTune, toOriginal, type Inference } from './lib/yolo'
import { supabase, activeModel, saveCount, bundleId, installErrorLog, reportError, type Det } from './lib/supabase'
import Login from './Login'
import Review from './Review'
import History from './History'

const APP_VERSION = '0.6.0'
installErrorLog(APP_VERSION)

type Model = { tag: string; file: string; conf: number }
// Kui andmebaasist ei saa mudeli infot (nt võrk puudub), kasutame vaikimisi faili.
const FALLBACK: Model = { tag: 'coco_test', file: 'model.onnx', conf: 0.25 }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [demo, setDemo] = useState(false)                       // ilma kontota: loendab ja ekspordib, ei salvesta

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!checked) return null
  if (demo) return <Main email="demorežiim (ei salvestata)" demo onExit={() => setDemo(false)} />
  if (!session) return <Login onDemo={() => setDemo(true)} />
  return <Main email={session.user.email ?? ''} demo={false} onExit={() => supabase.auth.signOut()} />
}

function Main({ email, demo, onExit }: { email: string; demo: boolean; onExit: () => void }) {
  const [view, setView] = useState<'count' | 'history'>('count')
  return (
    <div className="wrap">
      <div className="top">
        <h1>Varraste Loendur</h1>
        {!demo && <button className="link" onClick={() => setView(view === 'count' ? 'history' : 'count')}>
          {view === 'count' ? 'Ajalugu' : '← Loendama'}
        </button>}
        <button className="link" onClick={onExit}>{demo ? 'Välju' : 'Logi välja'}</button>
      </div>
      <div className="who">{email}</div>
      {/* Loendaja jääb alles ka ajaloo ajal (peidetult) – mudelit ei pea uuesti laadima */}
      <div hidden={view !== 'count'}><Counter demo={demo} /></div>
      {view === 'history' && <History />}
    </div>
  )
}

function Counter({ demo }: { demo: boolean }) {
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
    let img: ImageBitmap
    try { img = await createImageBitmap(f, { imageOrientation: 'from-image' }) }
    catch { setStatus('Seda faili ei saa pildina avada. Vali JPEG, PNG või WebP foto.'); return }
    setStatus('Loendan…'); setLast(null)
    const first = await infer(img, work.current!, 0)
    const boxes = select(first.cands, defaultTune(model.conf))     // salvestatakse vaikimisi seadetega tulemus
    const ms = first.ms
    const key = Date.now()
    const bundleCode = code.trim().toUpperCase()
    setShot({ key, img, first, countId: null, saveFailed: false, code: bundleCode })
    setStatus(`${ms} ms`)
    if (demo) return

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

  // kontrastivõimenduse muutmisel jookseb mudel samal fotol uuesti
  const shotImg = shot?.img
  const rerun = useCallback((contrast: number) => infer(shotImg!, work.current!, contrast), [shotImg])

  function onConfirmed(n: number) { setShot(null); setLast(n); setCode(''); setStatus('Pildista järgmine kimp.') }

  return (
    <>
      {!shot && <>
        <button className="btn" onClick={onLoad} disabled={!!model}>1 · Laadi mudel</button>
        <input className="code" placeholder="Kimbu kood (valikuline)" value={code} autoCapitalize="characters"
               autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value.toUpperCase())} />
        <div className="row2">
          <label className="btn sec" style={{ textAlign: 'center', opacity: model ? 1 : .5 }}>2 · Pildista
            <input type="file" accept="image/*" capture="environment" hidden disabled={!model} onChange={onPhoto} />
          </label>
          <label className="btn sec" style={{ textAlign: 'center', opacity: model ? 1 : .5 }}>või vali foto
            <input type="file" accept="image/*" hidden disabled={!model} onChange={onPhoto} />
          </label>
        </div>
        {last != null && <div className="status ok center">✓ Kinnitatud: {last}</div>}
      </>}
      <div className="status">{status}</div>
      {shot && <>
        {shot.code && <div className="status center">Kimp: <b>{shot.code}</b></div>}
        <Review key={shot.key} img={shot.img} first={shot.first} conf={model!.conf} rerun={rerun}
                countId={shot.countId} saveFailed={shot.saveFailed} onDone={onConfirmed}
                demo={demo} code={shot.code} modelTag={model!.tag} />
        {shot.saveFailed && <div className="error">Foto salvestamine ebaõnnestus: {shot.saveError}</div>}
        <button className="link" onClick={() => setShot(null)}>Tühista ja pildista uuesti</button>
      </>}
      <canvas ref={work} width={1024} height={1024} hidden />
    </>
  )
}

type Shot = { key: number; img: ImageBitmap; first: Inference; countId: string | null; saveFailed: boolean; saveError?: string; code: string }

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
