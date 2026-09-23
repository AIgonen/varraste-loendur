// Varraste Loendur · Supabase kliendi näited (arendaja C)
// npm i @supabase/supabase-js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

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
  const det = await supabase.from('detection').insert(p.predicted.map(d => ({ count_id: id, ...d, status: 'predicted' })))
  if (det.error) throw det.error
  return id
}

/** 2) Kui töötaja on parandanud ja vajutab "Kinnita": lõplik arv + kõik otsad lõpliku staatusega. */
export async function confirmCount(countId: string, finalCount: number, detections: Det[]) {
  const { error } = await supabase.rpc('confirm_count', { p_count_id: countId, p_final_count: finalCount, p_detections: detections })
  if (error) throw error
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
