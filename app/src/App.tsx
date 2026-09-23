import { useEffect, useRef, useState } from 'react'
import { loadModel, detect, type Box } from './lib/yolo'

// Esimene nädal: kaamera → mudel → ringid. Supabase'i salvestus lisandub 2. nädalal (vt lib/supabase.ts).
export default function App() {
  const [status, setStatus] = useState('Vajuta "Laadi mudel"')
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  async function onLoad() {
    setStatus('Laen mudelit…')
    const ep = await loadModel(`${import.meta.env.BASE_URL}model.onnx`)
    setStatus(`Mudel laetud (${ep}). Pildista kimbu otsa.`); setReady(true)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const img = await createImageBitmap(f)
    setStatus('Loendan…')
    const t0 = performance.now()
    const boxes = await detect(img, canvas.current!, 0.25)
    draw(canvas.current!, boxes)
    setCount(boxes.length)
    setStatus(`${boxes.length} otsa, ${Math.round(performance.now() - t0)} ms`)
  }

  useEffect(() => { document.title = count == null ? 'Varraste Loendur' : `${count} · Varraste Loendur` }, [count])

  return (
    <div className="wrap">
      <h1>Varraste Loendur</h1>
      <button className="btn" onClick={onLoad} disabled={ready}>1 · Laadi mudel</button>
      <label className="btn sec" style={{ textAlign: 'center', opacity: ready ? 1 : .5 }}>2 · Pildista
        <input type="file" accept="image/*" capture="environment" hidden disabled={!ready} onChange={onPhoto} />
      </label>
      {count != null && <div style={{ fontSize: 40, fontWeight: 700, textAlign: 'center' }}>{count}</div>}
      <div className="status">{status}</div>
      <canvas ref={canvas} width={1024} height={1024} />
    </div>
  )
}

function draw(c: HTMLCanvasElement, boxes: Box[]) {
  const ctx = c.getContext('2d')!
  ctx.lineWidth = 3; ctx.strokeStyle = '#e0b000'
  for (const b of boxes) { ctx.beginPath(); ctx.arc((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, Math.max(b.x2 - b.x1, b.y2 - b.y1) / 2, 0, Math.PI * 2); ctx.stroke() }
}
