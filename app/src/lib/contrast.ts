// CLAHE (Contrast Limited Adaptive Histogram Equalization) heledusel, otse ImageData peal.
// Miks: madala kontrastiga fotol (hämar ladu, rooste, vari) sulavad varraste otsad ja vahed kokku.
// Tavaline histogrammi võrdsustamine venitaks kogu pildi ühtemoodi ja võimendaks müra; CLAHE teeb seda
// plokiti (8×8 plokki) ja piirab võimendust (lõikepiir), nii et iga piirkonna kontrast tõuseb mõõdukalt.
// Värv säilib: muudetakse ainult heledust, R/G/B skaleeritakse sama teguriga.

const TILES = 8

/** @param clip lõikepiir (1–4 mõistlik); suurem = tugevam võimendus. @param area foto osa (letterbox-äärist ei puudu). */
export function clahe(img: ImageData, clip: number, area: { x: number; y: number; w: number; h: number }) {
  const { data, width } = img
  const tw = area.w / TILES, th = area.h / TILES
  // 1) iga ploki histogramm → lõigatud ja ümberjaotatud → kumulatiivne kaardistus 0..255
  const maps: Uint8Array[] = []
  for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) {
    const x0 = Math.floor(area.x + tx * tw), x1 = Math.floor(area.x + (tx + 1) * tw)
    const y0 = Math.floor(area.y + ty * th), y1 = Math.floor(area.y + (ty + 1) * th)
    const hist = new Float64Array(256); let n = 0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[luma(data, (y * width + x) * 4)]++; n++ }
    const limit = Math.max(1, clip * n / 256)
    let excess = 0
    for (let i = 0; i < 256; i++) if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit }
    const add = excess / 256
    const map = new Uint8Array(256); let cum = 0
    for (let i = 0; i < 256; i++) { cum += hist[i] + add; map[i] = Math.min(255, Math.round(cum / Math.max(1, n) * 255)) }
    maps.push(map)
  }
  // 2) iga piksel: nelja naaberploki kaardistuse bilineaarne interpolatsioon (muidu tekiksid ploki piirid)
  for (let y = area.y; y < area.y + area.h; y++) {
    const fy = Math.min(TILES - 1, Math.max(0, (y - area.y) / th - 0.5))
    const ty0 = Math.floor(fy), ty1 = Math.min(TILES - 1, ty0 + 1), wy = fy - ty0
    for (let x = area.x; x < area.x + area.w; x++) {
      const fx = Math.min(TILES - 1, Math.max(0, (x - area.x) / tw - 0.5))
      const tx0 = Math.floor(fx), tx1 = Math.min(TILES - 1, tx0 + 1), wx = fx - tx0
      const p = (y * width + x) * 4, l = luma(data, p)
      const v = (1 - wy) * ((1 - wx) * maps[ty0 * TILES + tx0][l] + wx * maps[ty0 * TILES + tx1][l])
              +      wy  * ((1 - wx) * maps[ty1 * TILES + tx0][l] + wx * maps[ty1 * TILES + tx1][l])
      const k = l > 0 ? v / l : 1
      data[p] = Math.min(255, data[p] * k); data[p + 1] = Math.min(255, data[p + 1] * k); data[p + 2] = Math.min(255, data[p + 2] * k)
      if (l === 0) { data[p] = data[p + 1] = data[p + 2] = v }
    }
  }
}

const luma = (d: Uint8ClampedArray, p: number) => (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8
