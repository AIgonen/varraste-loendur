// YOLO ONNX brauseris. Kaks sammu, et tuunimine oleks kiire:
//   infer()  – eeltöötlus (letterbox + valikuline kontrastivõimendus) + mudel → kõik kandidaadid (~1 s)
//   select() – lävi, ala, NMS, suurusfilter → lõplikud kastid (millisekundid, jookseb iga liuguri liigutusega)
import type * as ortTypes from 'onnxruntime-web'
import { clahe } from './contrast'
// Runtime tuleb globaalist (index.html laeb public/ort/ort.all.min.js); npm-pakett on ainult tüüpide jaoks.
declare const ort: typeof ortTypes

export type Box = { x1: number; y1: number; x2: number; y2: number; s: number; id?: number }
export type Roi = { x1: number; y1: number; x2: number; y2: number }
/** Kasutaja tuunitavad parameetrid. Kõik on üksteisest sõltumatud. */
export type Tune = {
  conf: number      // usaldusväärsuse lävi: madalam → rohkem ringe (ka valesid)
  iou: number       // NMS: kui palju kaks kasti võivad kattuda, enne kui nõrgem kustutatakse
  minRel: number    // väikseim lubatud ots, osa tüüpilisest (mediaan) suurusest; 0 = väljas
  maxRel: number    // suurim lubatud ots, osa tüüpilisest; >= MAX_OFF = väljas
  contrast: number  // CLAHE kontrastivõimendus (lõikepiir); 0 = väljas. Ainus, mis käivitab mudeli uuesti
  roi: Roi | null   // loendatav ala canvase koordinaatides; null = kogu pilt
}
export const MAX_OFF = 3
export const defaultTune = (conf: number): Tune => ({ conf, iou: 0.5, minRel: 0, maxRel: MAX_OFF, contrast: 0, roi: null })

export const SIZE = 1024
const PRE_CONF = 0.05          // infer() hoiab alles kõik kandidaadid üle selle – liugur saab minna nii madalale
let session: ortTypes.InferenceSession | null = null

export async function loadModel(url: string): Promise<'webgpu' | 'wasm'> {
  ort.env.wasm.wasmPaths = new URL('ort/', new URL(import.meta.env.BASE_URL, location.href)).href
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
  const providers: ortTypes.InferenceSession.ExecutionProviderConfig[] = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm']
  session = await ort.InferenceSession.create(url, { executionProviders: providers, graphOptimizationLevel: 'all' })
  return 'gpu' in navigator && (ort.env as any).webgpu?.adapter ? 'webgpu' : 'wasm'
}

export type Inference = { cands: Box[]; view: ImageData; ms: number }

/** Foto letterbox-ruutu (1024), soovi korral kontrastivõimendus, mudel. Tagastab kandidaadid ja mudeli nähtud pildi. */
export async function infer(img: ImageBitmap, canvas: HTMLCanvasElement, contrast = 0): Promise<Inference> {
  if (!session) throw new Error('mudel laadimata')
  const t0 = performance.now()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#727272'; ctx.fillRect(0, 0, SIZE, SIZE)
  const { dx, dy, w, h } = letterbox(img.width, img.height)
  ctx.drawImage(img, dx, dy, w, h)
  const view = ctx.getImageData(0, 0, SIZE, SIZE)
  if (contrast > 0) clahe(view, contrast, { x: dx, y: dy, w, h })
  const data = view.data, n = SIZE * SIZE, f = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) { f[i] = data[i * 4] / 255; f[n + i] = data[i * 4 + 1] / 255; f[2 * n + i] = data[i * 4 + 2] / 255 }
  const out = await session.run({ images: new ort.Tensor('float32', f, [1, 3, SIZE, SIZE]) })
  return { cands: candidates(out.output0), view, ms: Math.round(performance.now() - t0) }
}

/** Vana liides (üks samm): kastid vaikimisi seadetega. */
export async function detect(img: ImageBitmap, canvas: HTMLCanvasElement, conf = 0.25, iou = 0.5): Promise<Box[]> {
  return select((await infer(img, canvas)).cands, { ...defaultTune(conf), iou })
}

function candidates(out: ortTypes.Tensor): Box[] {
  const d = out.data as Float32Array, N = out.dims[2], C = out.dims[1] - 4
  const boxes: Box[] = []
  for (let i = 0; i < N; i++) {
    let best = 0
    for (let c = 0; c < C; c++) { const s = d[(4 + c) * N + i]; if (s > best) best = s }
    if (best < PRE_CONF) continue
    const cx = d[i], cy = d[N + i], w = d[2 * N + i], h = d[3 * N + i]
    boxes.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, s: best, id: i })
  }
  return boxes.sort((a, b) => b.s - a.s)
}

/** Kandidaatidest lõplikud kastid: lävi → ala → NMS → suurusfilter. Puhas funktsioon, kiire. */
export function select(cands: Box[], t: Tune): Box[] {
  const inRoi = (b: Box) => {
    if (!t.roi) return true
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2
    return cx >= t.roi.x1 && cx <= t.roi.x2 && cy >= t.roi.y1 && cy <= t.roi.y2
  }
  const keep: Box[] = []
  for (const b of cands) {                         // cands on usaldusväärsuse järgi kahanevas järjekorras
    if (b.s < t.conf) break
    if (!inRoi(b)) continue
    if (keep.every(k => iou(b, k) <= t.iou)) keep.push(b)
  }
  if (t.minRel <= 0 && t.maxRel >= MAX_OFF) return keep
  const m = median(keep.map(size))
  return keep.filter(b => { const s = size(b); return s >= t.minRel * m && (t.maxRel >= MAX_OFF || s <= t.maxRel * m) })
}

export const size = (b: Box) => Math.max(b.x2 - b.x1, b.y2 - b.y1)
export const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }

function iou(a: Box, b: Box) {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)), iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))
  const inter = ix * iy, uni = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter
  return uni > 0 ? inter / uni : 0
}

/** Kus foto letterbox-ruudus asub (ülejäänu on hall ääris). */
export function letterbox(imgW: number, imgH: number) {
  const r = Math.min(SIZE / imgW, SIZE / imgH)
  const w = Math.round(imgW * r), h = Math.round(imgH * r)
  return { r, w, h, dx: Math.floor((SIZE - w) / 2), dy: Math.floor((SIZE - h) / 2) }
}

/** Canvase kast → 0–1 originaalfoto suhtes (nii salvestatakse Supabase'i). */
export function toOriginal(b: Box, imgW: number, imgH: number) {
  const r = Math.min(SIZE / imgW, SIZE / imgH), dx = Math.floor((SIZE - imgW * r) / 2), dy = Math.floor((SIZE - imgH * r) / 2)
  const x1 = (b.x1 - dx) / r, y1 = (b.y1 - dy) / r, x2 = (b.x2 - dx) / r, y2 = (b.y2 - dy) / r
  return { cx: (x1 + x2) / 2 / imgW, cy: (y1 + y2) / 2 / imgH, w: (x2 - x1) / imgW, h: (y2 - y1) / imgH }
}
