# Järgmised sammud – sammhaaval

Kolm tööd, mis seisavad praegu ees. Järjekord on tähtis: **1 ja 2** annavad äpile päris mudeli, **3** teeb äpi laos mugavamaks ja seda saab teha paralleelselt.

| # | Mis | Kes | Aeg |
|---|---|---|---|
| 1 | 100 fotot märgistada + esimene treening | B (märgistamisel aitavad kõik) | 2–3 tööpäeva |
| 2 | Treenitud mudel äppi | B + C | 30 min |
| 3 | Kimbu kood ja ajaloovaade | C | 1 tööpäev |

---

## 1. Märgistamine Roboflow's ja esimene treening Colabis

### 1.1 Fotod (laos)

1. Loe läbi `docs/pildistamisjuhend.md` – otse otsa poole, terve kimp kaadris, ei mingit kilet ega külgvaadet.
2. Pildista **vähemalt 100 erinevat kimpu**. Üks kimp = üks foto (kaks fotot samast kimbust on lubatud, kuid siis peavad mõlemad minema samasse ossa – vt 1.3).
3. Erinevus on väärtus: eri läbimõõdud, materjalid, valgus, telefonid, kaugused. 100 väga sarnast fotot õpetab vähem kui 50 erinevat.

### 1.2 Märgistamine

Täpne juhend on `docs/roboflow-juhend.md`. Lühidalt:

1. app.roboflow.com → projekt **varraste-loendur** → **Upload Data** → fotod üles, partii nimi nt `ladu-2026-10-06`.
2. **Annotate** → iga varda otsa ümber kast (klahv **B**), klass `bar-end`. **Iga ots = üks kast**, ka pooleldi varjatud.
3. Jagage töö: igaüks võtab ~35 fotot. Roboflow ei anna sama fotot kahele.
4. Pärast ~30 fotot: **Versions → Generate → Train (Fast)** ja lülita sisse **Label Assist** – ülejäänud lähevad 2–3× kiiremini.

### 1.3 Kuldne test (30 fotot)

1. Vali 30 fotot **teistest kimpudest** kui ülejäänud 70.
2. Märgista need eriti hoolikalt, loe kimp käsitsi üle ja võrdle kastide arvuga.
3. Lisa neile tag `kuldne-test`.

> Ilma kuldse testita ei tea me, kas mudel on hea – see on ainus „õige vastus“, millega võrrelda.

### 1.4 Eksport

1. **Versions → Generate New Version**.
2. Split: `kuldne-test` → **Test**, ülejäänud ~80% **Train** / ~20% **Valid**.
3. Preprocessing: **eemalda Resize**. Augmentation: tühi.
4. **Download Dataset → YOLOv11 → zip**.
5. Pane zip Google Drive'i: `Minu Drive / varraste-loendur / dataset.zip`.

### 1.5 Treening Colabis

1. Ava colab.research.google.com → **File → Open notebook → GitHub** → kirjuta `AIgonen/varraste-loendur` → vali `notebooks/varraste_loendur_treening.ipynb`.
2. **Runtime → Change runtime type → T4 GPU → Save**.
3. Jaotis **1 · Seaded**: jäta nii nagu on (`KATSE_NIMI = yolo11n_v01`, `ANDMED_ALLIKAS = zip`).
4. **Runtime → Run all**. Esimene lahter küsib Drive'i ligipääsu – luba.
5. Treening kestab ~30–60 min. Kui Colab vahepeal katkestab: ava notebook uuesti ja **Run all** – jätkab viimasest salvestusest.
6. Valmis, kui Drive'is on:
   - `varraste-loendur/runs/yolo11n_v01.onnx` – mudel äpi jaoks
   - `varraste-loendur/runs/katsed.csv` – tulemuste rida

### 1.6 Kas mudel on piisavalt hea?

Vaata jaotist **5 · Loendusviga kuldsel testil**. Kolm numbrit:

| Näitaja | Tähendus | Esimese katse jaoks hea märk |
|---|---|---|
| `keskm_viga` | mitu varrast keskmiselt valesti | ≤ 2 |
| `täpselt` | mitmel fotol arv täpselt õige | ≥ 50% |
| `max_viga` | halvim foto | annab teada, kus mudel hätta jääb |

Need on orienteeruvad sihid, mitte nõuded. Isegi kehvem esimene mudel on kasulik: töötaja parandab vähem kui nullist lugedes, ja iga kinnitus läheb uueks treeningandmeks.

Jaotis **„Fotode kaupa“** näitab 6 halvimat fotot – vaadake koos, mis neil ühist on (varjud? peenikesed vardad? nurk?). Sellest tuleb järgmise pildistamisringi fookus.

Pange kirja ka **CONF** väärtus, mille notebook valis (jaotis 5 lõpus) – seda läheb vaja sammus 2.

---

## 2. Treenitud mudel äppi

Põhimõte: mudelifail läheb reposse **oma nimega** (mitte `model.onnx` üle), andmebaas ütleb äpile, millist faili kasutada. Nii saab alati vana mudeli tagasi lülitada.

### 2.1 Fail reposse

1. Laadi Drive'ist alla `runs/yolo11n_v01.onnx` (~11 MB).
2. GitHub Desktopis: tee haru `mudel/yolo11n_v01`.
3. Kopeeri fail repo kausta `app/public/` (sinna, kus on `model.onnx`).
4. Commit („mudel yolo11n_v01“) → Push → Pull request → Merge.
5. Oota, kuni Actions on roheline. Kontroll: `https://aigonen.github.io/varraste-loendur/yolo11n_v01.onnx` peab alla laadima faili.

### 2.2 Mudel andmebaasi

Supabase → SQL Editor. Asenda numbrid oma katse tulemustega (`katsed.csv`):

```sql
insert into model_version (tag, file_name, conf_threshold, imgsz, test_mae, test_exact, trained_on, is_active)
values ('yolo11n_v01', 'yolo11n_v01.onnx', 0.35, 1024, 1.8, 0.55, 70, false);
--                                          ^CONF       ^keskm_viga ^täpselt ^train_fotod
```

### 2.3 Lülita aktiivseks

```sql
begin;
update model_version set is_active = false where is_active;
update model_version set is_active = true  where tag = 'yolo11n_v01';
commit;
```

(Kaks rida ühes tehingus, sest korraga tohib aktiivne olla ainult üks mudel.)

### 2.4 Test telefonis

1. Ava äpp uuesti, vajuta **Laadi mudel** – staatus peab ütlema `Mudel yolo11n_v01 laetud`.
2. Pildista paar kimpu, mida mudel pole näinud. Kas ringid on varraste otstel?
3. Kui midagi on väga valesti – lülita tagasi:
   ```sql
   begin;
   update model_version set is_active = false where is_active;
   update model_version set is_active = true  where tag = 'coco_test';
   commit;
   ```

### 2.5 Järgmine mudel

Iga uus katse = uus `KATSE_NIMI` (nt `yolo11n_v02`) → uus fail → uus rida tabelis. Vanu faile ära kustuta enne, kui uus on vähemalt nädal laos töötanud.

---

## 3. Äpi järgmised täiendused (C)

> ✅ **Tehtud versioonis 0.4.0** (`App.tsx`, `History.tsx`, `lib/supabase.ts`). Allolev jääb alles selgitusena, kuidas see töötab.

Mõlemad on väikesed ja sõltumatud – tee eraldi harudes ja eraldi pull requestidena.

### 3A. Kimbu kood

**Eesmärk:** töötaja saab enne pildistamist sisestada kimbu tähise saatelehelt. Siis saab hiljem võrrelda, kas sama kimp loeti eri päevadel sama arvuga.

Andmebaas on juba valmis: tabel `bundle` (`code` on unikaalne) ja `count.bundle_id`. SQL-i muuta pole vaja.

1. Haru `feat/kimbu-kood`.
2. **`App.tsx` → `Counter`**: lisa olek `const [code, setCode] = useState('')` ja pildista-nupu kohale tekstiväli:
   ```tsx
   <input className="code" placeholder="Kimbu kood (valikuline)" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} />
   ```
   `inputMode="text"`, `autoCapitalize="characters"` – laos on kindad, suured tähed on loetavamad.
3. **`lib/supabase.ts`**: uus funktsioon, mis leiab olemasoleva kimbu või loob uue:
   ```ts
   export async function bundleId(code: string): Promise<string | null> {
     const c = code.trim(); if (!c) return null
     const found = await supabase.from('bundle').select('id').eq('code', c).maybeSingle()
     if (found.error) throw found.error
     if (found.data) return found.data.id
     const made = await supabase.from('bundle').insert({ code: c }).select('id').single()
     if (made.error?.code === '23505') return bundleId(c)   // keegi lõi samal hetkel – võta see
     if (made.error) throw made.error
     return made.data.id
   }
   ```
   (Ära kasuta `upsert`-i – selleks oleks vaja update-õigust tabelile, mida meil RLS-is pole ja polegi vaja.)
4. **`onPhoto`**: enne `saveCount` kutsu `const bid = await bundleId(code)` ja anna `saveCount({ ..., bundleId: bid ?? undefined })`. `saveCount` toetab `bundleId`-d juba.
5. Pärast kinnitamist tühjenda väli: `onConfirmed` sees `setCode('')`.
6. Test: sisesta `TEST-1`, pildista, kinnita. Supabase'is: `bundle` tabelis rida `TEST-1`, `count` viimasel real `bundle_id` täidetud. Pildista uuesti sama koodiga – `bundle` tabelisse **uut** rida ei tule.
7. CSS (`style.css`): `.code { width:100%; font-size:17px; padding:12px; border:1px solid var(--line); border-radius:6px; margin:8px 0 }`.

### 3B. Ajaloovaade „Minu loendused“

**Eesmärk:** töötaja näeb oma viimast 20 loendust – kuupäev, mudeli arv, kinnitatud arv, kimbu kood. Kasulik vaidluste korral („kas ma selle kimbu juba lugesin?“).

RLS lubab igaühel näha ainult oma loendusi – see on juba seadistatud.

1. Haru `feat/ajalugu`.
2. **`lib/supabase.ts`**:
   ```ts
   export async function myCounts(limit = 20) {
     const { data, error } = await supabase.from('count')
       .select('id, created_at, predicted_count, final_count, photo_path, bundle(code)')
       .order('created_at', { ascending: false }).limit(limit)
     if (error) throw error
     return data
   }
   export async function photoUrl(path: string) {
     const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 600)  // 10 min
     if (error) throw error
     return data.signedUrl
   }
   ```
   Bucket `photos` on privaatne, seepärast on vaja ajutist allkirjastatud linki, mitte tavalist URL-i.
3. Uus fail **`src/History.tsx`**: laeb `myCounts()` `useEffect`-is ja näitab tabelit:
   | Aeg | Kimp | Mudel | Kinnitatud |
   |---|---|---|---|
   | 06.10 14:32 | TEST-1 | 47 | 49 |
   | 06.10 14:20 | – | 52 | *kinnitamata* |

   Aeg: `new Date(r.created_at).toLocaleString('et-EE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })`.
   Rea puudutus → `photoUrl(r.photo_path)` → näita fotot (`<img>`) rea all.
4. **`App.tsx`**: üleval lisa nupp „Ajalugu“ kõrvale „Logi välja“-le; olek `const [view, setView] = useState<'count' | 'history'>('count')`; ajaloo vaates nupp „← Tagasi“.
5. Test: ajalugu näitab sinu ridu, kinnitatud on numbriga, kinnitamata on halliga. Logi sisse teise kasutajana – tema ajalugu on tühi (RLS töötab).

### 3C. Iga muudatuse lõpus

1. `npm run dev` – kontrolli arvutis.
2. `npm run build` – peab lõppema `✓ built`.
3. Commit → Push → Pull request → teine arendaja vaatab üle → Merge.
4. 2 min pärast telefonis üle.
5. Tõsta issue tahvlil **Done** alla.
