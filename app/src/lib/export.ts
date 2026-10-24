// Tulemuse eksport: PNG (foto + ringid + päis) ja ühe lehe A4 PDF-raport trükkimiseks.
// PDF tehakse ilma teegita: raport joonistatakse canvasele (200 dpi) ja pannakse JPEG-ina PDF-i lehele –
// nii ei ole fondi- ega täpitähtede probleeme ja fail avaneb igas PDF-lugejas.
import { SIZE, type Box, type Tune, MAX_OFF } from './yolo'

export type Report = {
  img: ImageBitmap
  kept: Box[]          // lõplikud ringid canvase (1024) koordinaatides, sh käsitsi lisatud
  added: number; removed: number; predicted: number
  code: string; modelTag: string; tune: Tune; manual: number | null
  when: Date
}

const INK = '#1b1e21', MUTED = '#4e555c', RING = '#e0b000', ADDED = '#2f7de0'

/** Originaalfoto (pikem külg kuni maxSide) koos nummerdatud ringidega. */
export function annotated(r: Report, maxSide: number, addedFrom: number) {
  const k = Math.min(1, maxSide / Math.max(r.img.width, r.img.height))
  const W = Math.round(r.img.width * k), H = Math.round(r.img.height * k)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.drawImage(r.img, 0, 0, W, H)
  // canvas 1024 → originaal → väljund
  const lr = Math.min(SIZE / r.img.width, SIZE / r.img.height)
  const dx = Math.floor((SIZE - r.img.width * lr) / 2), dy = Math.floor((SIZE - r.img.height * lr) / 2)
  const f = k / lr
  const lw = Math.max(2, Math.round(W / 500))
  ctx.lineWidth = lw; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  // järjekord: ülevalt alla, vasakult paremale – nii on paberil lihtne üle kontrollida
  const order = r.kept.map((b, i) => ({ b, i })).sort((a, b) => rowKey(a.b) - rowKey(b.b))
  order.forEach(({ b, i }, n) => {
    const cx = ((b.x1 + b.x2) / 2 - dx) * f, cy = ((b.y1 + b.y2) / 2 - dy) * f
    const rad = Math.max(b.x2 - b.x1, b.y2 - b.y1) / 2 * f
    ctx.strokeStyle = i >= addedFrom ? ADDED : RING
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke()
    if (rad > 9) {
      const fs = Math.max(9, Math.min(rad * 0.9, 28))
      ctx.font = `700 ${fs}px system-ui, sans-serif`
      ctx.lineWidth = Math.max(2, fs / 5); ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(String(n + 1), cx, cy)
      ctx.fillStyle = '#fff'; ctx.fillText(String(n + 1), cx, cy); ctx.lineWidth = lw
    }
  })
  return c
  function rowKey(b: Box) {                       // ligikaudne rida = y / tüüpiline läbimõõt
    const d = Math.max(1, Math.max(b.x2 - b.x1, b.y2 - b.y1))
    return Math.round(((b.y1 + b.y2) / 2) / d) * 1e5 + (b.x1 + b.x2) / 2
  }
}

const fmt = (d: Date) => d.toLocaleString('et-EE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const stamp = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`
const p2 = (n: number) => String(n).padStart(2, '0')
export const fileBase = (r: Report) => `loendus_${r.code ? r.code + '_' : ''}${stamp(r.when)}_${r.kept.length}`

export function tuneText(t: Tune) {
  return [
    `tundlikkus (CONF) ${t.conf.toFixed(2)}`,
    `kattuvus (IoU) ${t.iou.toFixed(2)}`,
    `väikseim ots ${t.minRel > 0 ? Math.round(t.minRel * 100) + '%' : 'piiranguta'}`,
    `suurim ots ${t.maxRel < MAX_OFF ? Math.round(t.maxRel * 100) + '%' : 'piiranguta'}`,
    `kontrast ${t.contrast > 0 ? t.contrast.toFixed(1) : 'väljas'}`,
    `ala ${t.roi ? 'valitud' : 'kogu foto'}`,
  ].join(' · ')
}

export async function downloadPng(r: Report, addedFrom: number) {
  const photo = annotated(r, 2400, addedFrom)
  const head = Math.round(photo.width * 0.09)
  const c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height + head
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, head)
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'
  ctx.font = `700 ${head * 0.5}px system-ui, sans-serif`; ctx.fillText(`${r.kept.length} varrast`, head * 0.3, head * 0.5)
  ctx.font = `${head * 0.22}px system-ui, sans-serif`; ctx.fillStyle = MUTED; ctx.textAlign = 'right'
  ctx.fillText([r.code && `Kimp ${r.code}`, fmt(r.when)].filter(Boolean).join(' · '), c.width - head * 0.3, head * 0.35)
  ctx.fillText(`Mudel ${r.modelTag}`, c.width - head * 0.3, head * 0.68)
  ctx.drawImage(photo, 0, head)
  save(await blob(c, 'image/png'), fileBase(r) + '.png')
}

export async function downloadPdf(r: Report, addedFrom: number) {
  const W = 1654, H = 2339, M = 130                 // A4 200 dpi, veeris ~1,65 cm
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = RING; ctx.fillRect(M, M, W - 2 * M, 10)
  ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'
  ctx.font = '700 54px system-ui, sans-serif'; ctx.fillText('Varraste loendus', M, M + 90)
  ctx.font = '700 120px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(String(r.kept.length), W - M, M + 150)
  ctx.font = '30px system-ui, sans-serif'; ctx.fillStyle = MUTED; ctx.fillText('varrast', W - M, M + 195)
  ctx.textAlign = 'left'
  const rows: [string, string][] = [
    ['Kimbu tähis', r.code || '–'],
    ['Aeg', fmt(r.when)],
    ['Mudel leidis', `${r.predicted}  (eemaldati ${r.removed}, lisati ${r.added})`],
    ['Käsitsi loetud', r.manual != null ? String(r.manual) : '–'],
    ['Mudel', r.modelTag],
  ]
  ctx.font = '30px system-ui, sans-serif'
  rows.forEach(([k, v], i) => {
    const y = M + 170 + i * 46
    ctx.fillStyle = MUTED; ctx.fillText(k, M, y); ctx.fillStyle = INK; ctx.fillText(v, M + 300, y)
  })
  // foto
  const top = M + 170 + rows.length * 46 + 10, bottom = H - M - 120
  const photo = annotated(r, 2000, addedFrom)
  const s = Math.min((W - 2 * M) / photo.width, (bottom - top) / photo.height)
  const pw = photo.width * s, ph = photo.height * s
  ctx.drawImage(photo, M + (W - 2 * M - pw) / 2, top, pw, ph)
  ctx.font = '24px system-ui, sans-serif'; ctx.fillStyle = MUTED
  ctx.fillText('Kollane ring = mudeli leitud ots, sinine = töötaja lisatud. Numbrid ridade kaupa ülevalt alla.', M, bottom + 45)
  ctx.fillText('Seaded: ' + tuneText(r.tune), M, bottom + 80)
  ctx.fillText('Allkiri: ______________________', W - M - 520, H - M + 10)
  const jpg = new Uint8Array(await (await blob(c, 'image/jpeg', 0.9)).arrayBuffer())
  save(pdfWithJpeg(jpg, W, H), fileBase(r) + '.pdf')
}

/** Minimaalne üheleheline PDF, mille ainus sisu on A4-suurune JPEG. */
function pdfWithJpeg(jpg: Uint8Array, w: number, h: number): Blob {
  const enc = new TextEncoder(), parts: BlobPart[] = [], offs: number[] = []
  let len = 0
  const add = (p: Uint8Array | string) => { const b = typeof p === "string" ? enc.encode(p) : p; parts.push(b as Uint8Array<ArrayBuffer>); len += b.length }
  const obj = (n: number, body: string | (() => void)) => {
    offs[n] = len; add(`${n} 0 obj\n`)
    if (typeof body === 'string') add(body); else body()
    add('\nendobj\n')
  }
  const content = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q'
  add('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')
  obj(4, () => {
    add(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`)
    add(jpg); add('\nendstream')
  })
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  const xref = len
  add(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`)
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

const blob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob(b => b ? ok(b) : fail(new Error('toBlob')), type, q))

function save(b: Blob, name: string) {
  const url = URL.createObjectURL(b), a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
