# Varraste Loendur · Supabase (arendaja C)

## Seadistus (15 min)
1. supabase.com → New project (tasuta plaan, region **eu-central-1 Frankfurt**). Salvesta DB parool.
2. SQL Editor → New query → kleebi `001_schema.sql` → Run. Lõpus peab olema "Success".
3. Authentication → Providers: jäta Email sisse; Settings → lülita "Confirm email" välja (laotöötajad ei loe e-posti). Kasutajad lisa Authentication → Users → "Add user" (e-post + PIN-parool).
4. Project Settings → API: kopeeri `Project URL` ja `anon public` võti → repo `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Anon-võti on avalik (see on lehes niikuinii); turvalisus tuleb RLS-ist, mitte võtmest.
5. Repo → Settings → Secrets → lisa samad kaks nime (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) ja pane `.github/workflows/keepalive.yml` repo juurde – hoiab projekti ärkvel.

## Mis skeemis on
| Tabel | Mis |
|---|---|
| `model_version` | aktiivne mudel (`is_active`), fail, `conf_threshold`, testinumbrid. Rakendus laeb selle enne mudelit. |
| `bundle` | kimp (tähis saatelehelt), valikuline |
| `count` | üks loendus: foto tee, ennustatud arv, lõplik arv, mudel, seade |
| `detection` | iga ots: `cx,cy,w,h` 0–1 originaalfoto suhtes, `status` predicted/confirmed/removed/added_by_user |
| `error_log` | vead telefonist |
| `training_export` (vaade) | kinnitatud otsad YOLO-formaadi jaoks – Colab loeb seda service role võtmega |

**RLS:** iga töötaja näeb ja muudab ainult enda loendusi ja fotosid (`photos/<user_id>/...`). `model_version` on kõigile loetav, kirjutab ainult service role (Colab/admin). Testitud: teine kasutaja ei näe esimese loendusi ega saa neid kinnitada.

**`confirm_count(count_id, final_count, detections)`** – üks RPC-kutse, mis asendab loenduse kõik otsad lõpliku staatusega ja märgib kinnitatuks. Vt `api.ts`.

## Rakenduse voog
1. `activeModel()` → laeb `public/<file_name>` ONNX-i, kasutab `conf_threshold`.
2. Foto → mudel → NMS → `toOriginal()` iga kasti jaoks → `saveCount(...)` (foto + loendus + predicted otsad).
3. Töötaja parandab → `confirmCount(id, finalCount, dets)` kus eemaldatud on `status:'removed'`, lisatud `'added_by_user'`, ülejäänud `'confirmed'`.
4. Offline: kui `saveCount` ebaõnnestub võrgu tõttu, pane foto + JSON IndexedDB-sse ja proovi uuesti `online` sündmusel.

## Uue mudeli avaldamine (B teeb pärast treeningut)
```sql
update model_version set is_active = false where is_active;
insert into model_version (tag, file_name, conf_threshold, imgsz, test_mae, test_exact, trained_on, is_active)
values ('yolo11n_v01', 'model_v01.onnx', 0.35, 1024, 1.2, 0.63, 180, true);
```
+ ONNX-fail repo `public/model_v01.onnx` → git push. Telefonid saavad uue mudeli järgmisel avamisel.

## Mahud tasuta plaanil
500 MB andmebaas (loendus + 70 otsa ≈ 10 KB → ~50 000 loendust), 1 GB Storage (~1000 fotot 1 MB). Kui Storage täitub: vanad fotod arhiveerida Drive'i (Colab teeb seda treeningu käigus niikuinii) ja kustutada.
