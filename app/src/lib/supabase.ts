// Varraste Loendur · Supabase kliendi näited (arendaja C)
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY puudub – loo app/.env (vt .env.example)')
export const supabase = createClient(url, key)

export type Det = { cx: number; cy: number; w: number; h: number; confidence: number | null;
                    status: 'predicted' | 'confirmed' | 'removed' | 'added_by_user' }

/** Aktiivne mudel: fail + lävi, mida rakendus laeb. */
export async function activeModel() {
  const { data, error } = await supabase.from('model_version').select('tag,file_name,conf_threshold,imgsz').eq('is_active', true).single()
  if (error) throw error
  return data
}

/** 1) Kohe pärast tuvastust: foto Storage'i + loendus + ennustatud otsad. Tagastab count.id. */
export async function saveCount(p: {
  photo: Blob; width: number; height: number; modelTag: string; conf: number;
  predicted: Det[]; bundleId?: string; latencyMs?: number
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('pole sisse logitud')
  const id = crypto.randomUUID()
  const path = `${user.id}/${id}.jpg`                      // RLS nõuab: esimene kaust = oma user_id
  const up = await supabase.storage.from('photos').upload(path, p.photo, { contentType: 'image/jpeg' })
  if (up.error) throw up.error
  const ins = await supabase.from('count').insert({
    id, bundle_id: p.bundleId ?? null, photo_path: path, photo_width: p.width, photo_height: p.height,
    model_tag: p.modelTag, conf_threshold: p.conf, predicted_count: p.predicted.length,
    device: navigator.userAgent.slice(0, 120), latency_ms: p.latencyMs ?? null,
  })
  if (ins.error) throw ins.error
  if (p.predicted.length) {                       // 0 leiu korral pole midagi lisada
    const det = await supabase.from('detection').insert(p.predicted.map(d => ({ count_id: id, ...d, status: 'predicted' })))
    if (det.error) throw det.error
  }
  return id
}

/** Kimbu kood → bundle.id. Olemasolev kimp leitakse, uus luuakse. Tühi kood → null. */
export async function bundleId(code: string): Promise<string | null> {
  const c = code.trim().toUpperCase(); if (!c) return null
  const found = await supabase.from('bundle').select('id').eq('code', c).maybeSingle()
  if (found.error) throw found.error
  if (found.data) return found.data.id
  // upsert'i ei kasuta – see vajaks update-õigust, mida RLS ei anna (ega pea andma)
  const made = await supabase.from('bundle').insert({ code: c }).select('id').single()
  if (made.error?.code === '23505') return bundleId(c)      // keegi lõi sama koodi samal hetkel
  if (made.error) throw made.error
  return made.data.id
}

export type HistoryRow = {
  id: string; created_at: string; predicted_count: number; final_count: number | null
  photo_path: string; model_tag: string; bundle: { code: string | null } | null
}

/** Kasutaja viimased loendused (RLS: igaüks näeb ainult enda omi). */
export async function myCounts(limit = 20): Promise<HistoryRow[]> {
  const { data, error } = await supabase.from('count')
    .select('id, created_at, predicted_count, final_count, photo_path, model_tag, bundle(code)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as unknown as HistoryRow[]
}

/** Privaatse foto ajutine link (10 min). */
export async function photoUrl(path: string) {
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

/** 2) Kui töötaja on parandanud ja vajutab "Kinnita": lõplik arv + kõik otsad lõpliku staatusega. */
export async function confirmCount(countId: string, finalCount: number, detections: Det[]) {
  const { error } = await supabase.rpc('confirm_count', { p_count_id: countId, p_final_count: finalCount, p_detections: detections })
  if (error) throw error
}

/** Püütud viga → error_log + loetav tekst kasutajale (nt "kinnitamine: permission denied for table detection"). */
export function reportError(where: string, err: unknown): string {
  const e = err as { message?: string; details?: string; hint?: string; code?: string; stack?: string }
  const msg = [e?.message ?? String(err), e?.details, e?.hint, e?.code && `kood ${e.code}`].filter(Boolean).join(' · ')
  supabase.from('error_log').insert({ message: `${where}: ${msg}`, stack: e?.stack ?? null, device: navigator.userAgent.slice(0, 120) }).then(() => {})
  return msg
}

/** Vead telefonist andmebaasi (window.onerror + unhandledrejection). */
export function installErrorLog(appVersion: string) {
  const send = (message: string, stack?: string) =>
    supabase.from('error_log').insert({ message, stack, device: navigator.userAgent.slice(0, 120), app_version: appVersion }).then(() => {})
  window.addEventListener('error', e => send(e.message, e.error?.stack))
  window.addEventListener('unhandledrejection', e => send(String(e.reason), e.reason?.stack))
}

// Koordinaadid: detection.cx/cy/w/h on 0–1 ORIGINAALFOTO suhtes.
// Mudel töötab 1024 px letterbox-ruudus – teisenda enne salvestamist:
// toOriginal() on failis ./yolo.ts
