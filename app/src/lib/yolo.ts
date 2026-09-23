// YOLO ONNX brauseris – sama loogika, mis telefonitestis, TypeScriptis.
import type * as ortTypes from 'onnxruntime-web'
// Runtime tuleb globaalist (index.html laeb public/ort/ort.all.min.js); npm-pakett on ainult tüüpide jaoks.
declare const ort: typeof ortTypes

export type Box = { x1: number; y1: number; x2: number; y2: number; s: number }
export const SIZE = 1024
let session: ortTypes.InferenceSession | null = null

export async function loadModel(url: string): Promise<'webgpu' | 'wasm'> {
  ort.env.wasm.wasmPaths = new URL('ort/', new URL(import.meta.env.BASE_URL, location.href)).href
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
  const providers: ortTypes.InferenceSession.ExecutionProviderConfig[] = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm']
  session = await ort.InferenceSession.create(url, { executionProviders: providers, graphOptimizationLevel: 'all' })
  return 'gpu' in navigator && (ort.env as any).webgpu?.adapter ? 'webgpu' : 'wasm'
}

/** Joonistab pildi letterbox-ruutu canvasele ja tagastab kastid canvase koordinaatides (0..SIZE). */
export async function detect(img: ImageBitmap, canvas: HTMLCanvasElement, conf = 0.25, iou = 0.5): Promise<Box[]> {
  if (!session) throw new Error('mudel laadimata')
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#727272'; ctx.fillRect(0, 0, SIZE, SIZE)
  const r = Math.min(SIZE / img.width, SIZE / img.height)
  const w = Math.round(img.width * r), h = Math.round(img.height * r)
  ctx.drawImage(img, Math.floor((SIZE - w) / 2), Math.floor((SIZE - h) / 2), w, h)
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data
  const n = SIZE * SIZE, f = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) { f[i] = data[i * 4] / 255; f[n + i] = data[i * 4 + 1] / 255; f[2 * n + i] = data[i * 4 + 2] / 255 }
  const out = await session.run({ images: new ort.Tensor('float32', f, [1, 3, SIZE, SIZE]) })
  return nms(out.output0, conf, iou)
}

function nms(out: ortTypes.Tensor, conf: number, iou: number): Box[] {
  const d = out.data as Float32Array, N = out.dims[2], C = out.dims[1] - 4
  const boxes: Box[] = []
  for (let i = 0; i < N; i++) {
    let best = 0
    for (let c = 0; c < C; c++) { const s = d[(4 + c) * N + i]; if (s > best) best = s }
    if (best < conf) continue
    const cx = d[i], cy = d[N + i], w = d[2 * N + i], h = d[3 * N + i]
    boxes.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, s: best })
  }
  boxes.sort((a, b) => b.s - a.s)
  const keep: Box[] = []
  for (const b of boxes) {
    let ok = true
    for (const k of keep) {
      const ix = Math.max(0, Math.min(b.x2, k.x2) - Math.max(b.x1, k.x1)), iy = Math.max(0, Math.min(b.y2, k.y2) - Math.max(b.y1, k.y1))
      const inter = ix * iy, uni = (b.x2 - b.x1) * (b.y2 - b.y1) + (k.x2 - k.x1) * (k.y2 - k.y1) - inter
      if (inter / uni > iou) { ok = false; break }
    }
    if (ok) keep.push(b)
  }
  return keep
}

/** Canvase kast → 0–1 originaalfoto suhtes (nii salvestatakse Supabase'i). */
export function toOriginal(b: Box, imgW: number, imgH: number) {
  const r = Math.min(SIZE / imgW, SIZE / imgH), dx = Math.floor((SIZE - imgW * r) / 2), dy = Math.floor((SIZE - imgH * r) / 2)
  const x1 = (b.x1 - dx) / r, y1 = (b.y1 - dy) / r, x2 = (b.x2 - dx) / r, y2 = (b.y2 - dy) / r
  return { cx: (x1 + x2) / 2 / imgW, cy: (y1 + y2) / 2 / imgH, w: (x2 - x1) / imgW, h: (y2 - y1) / imgH }
}
