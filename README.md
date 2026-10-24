# Varraste Loendur

Rakendus, mis loeb foto järgi kokku kimpu pakitud metallvardad. Mudel jookseb telefoni brauseris, andmed Supabase'is, leht GitHub Pagesil. Kõik tasuta.

**Seis:** v0.6.0 (24.10.2026) – tuunimise paneel, loendatava ala valik, kontrastivõimendus, PNG/PDF eksport, demorežiim ilma kontota. Parim puhas mudelitulemus kuldsel testil: keskmine viga 1,97 varrast/foto (vt `docs/katsed.md`).

## Mida rakendus teeb
1. Kasutaja pildistab kimbu otsa või valib foto galeriist (JPEG/PNG/WebP, suvaline suurus ja suund).
2. YOLO11n (ONNX) tuvastab telefonis iga varda otsa, ~0,7–0,9 s (WebGPU, varuks WASM).
3. Kinnitusvaade näitab arvu ja ringe. Kasutaja saab:
   - **tuunida** (paneel „Seaded“) – iga liuguri liigutus muudab ringe ja arvu kohe;
   - **parandada** – puudutus eemaldab ringi / lisab puuduva otsa, kahe sõrmega suurendus;
   - **eksportida** – PNG (foto + nummerdatud ringid + päis) või A4 PDF-raport trükkimiseks;
   - **kinnitada** – lõplik arv ja iga ots salvestatakse Supabase'i (järgmise treeningu andmed).
4. **Demorežiim** (sisselogimise lehel „Proovi ilma kontota“): kõik peale salvestamise. Esitluse ja hindajate jaoks.

## Tuunimine – mis iga parameeter teeb
Tuvastus on kahes osas (`app/src/lib/yolo.ts`): `infer()` jookseb mudeli korra ja hoiab alles kõik ~21 000 kandidaadist need, mille usaldusväärsus on üle 0,05; `select()` teeb neist lõpliku tulemuse. Liugurid muudavad ainult `select()` sisendit, seega eelvaade uueneb millisekunditega. Ainult kontrastivõimendus muudab mudeli sisendit ja käivitab mudeli uuesti (400 ms pärast liuguri peatumist, ~1 s).

| Parameeter | Samm | Mida muudab | Millal kasutada |
|---|---|---|---|
| Tundlikkus (CONF, 0,05–0,90) | lävi | madalam → rohkem ringe, ka valesid | jäävad otsad leidmata → alla; taustal valeleiud → üles |
| Kattuvate liitmine (IoU, 0,1–0,9) | NMS | madalam → kõrvuti kastid liidetakse kergemini | ühel otsal kaks ringi → alla; tihedas kimbus kaovad naabrid → üles |
| Väikseim ots (% mediaanist) | suurusfilter | kaotab tüüpilisest palju väiksemad leiud | taga oleva kimbu otsad, müra |
| Suurim ots (% mediaanist) | suurusfilter | kaotab liiga suured leiud | kaks otsa ühes kastis, ringikujuline taust |
| Kontrastivõimendus (CLAHE, 0–4) | eeltöötlus | tõstab kohalikku kontrasti 8×8 plokis, lõikepiiriga | hämar ladu, vari, roostes otsad |
| Loendatav ala (ristkülik) | filter | loeb ainult otsi, mille keskpunkt on alas | taustal teised kimbud |

Suurusfiltrid on suhtelised (mediaani suhtes), mitte pikslites – nii töötavad need sõltumata kaugusest ja varda läbimõõdust.

**Piirangud:** mudel näeb pilti 1024 px ruuduna – väga kaugelt tehtud fotol on otsad mudeli jaoks liiga väikesed (pildistamisjuhend: ots vähemalt ~40 px 1024 px pildil); kile all olevaid otsi ei loendata; CLAHE ei aita ülesäritatud (valgeks põlenud) piltidel; mudeli täpsus sõltub treeningfotodest (praegu üks ladu).

## Koodi struktuur (`app/src`)
| Fail | Mis |
|---|---|
| `App.tsx` | sisselogimine/demo, mudeli laadimine, foto → `infer()` → salvestus taustal |
| `Review.tsx` | kinnitusvaade: tuunimise paneel, ala valik, puutega parandus, eksport, kinnitus |
| `lib/yolo.ts` | ONNX Runtime Web, letterbox, `infer()`, `select()` (lävi, ala, NMS, suurusfilter) |
| `lib/contrast.ts` | CLAHE heledusel (värv säilib) |
| `lib/export.ts` | PNG ja ühe lehe PDF (canvas → JPEG → minimaalne PDF, ilma teegita) |
| `lib/zoom.ts` | kahe sõrmega suurendus, lohistamine, puudutus |
| `lib/supabase.ts` | salvestus, kinnitus (RPC `confirm_count`), ajalugu, vealogi |

## Kaustad
| Kaust | Mis | Kelle |
|---|---|---|
| `app/` | Vite + React + TS PWA; `src/lib/yolo.ts` (mudel brauseris), `src/lib/supabase.ts` (salvestus) | C |
| `app/public/telefonitest/` | kiirustest, mille laotelefonid läbisid (0,7–0,9 s) | – |
| `notebooks/` | Colab: treening → loendusviga → ONNX | B |
| `supabase/` | skeem, RLS, RPC; iga muudatus uue `NNN_*.sql` failina | C |
| `docs/` | arhitektuur, arendusplaan, otsused, pildistamisjuhend, kokkuvõte | kõik |
| `docs/arendaja-juhend.md` | **alusta siit:** äpi käivitamine, pull, push | kõik |
| `docs/roboflow-juhend.md` | fotode märgistamine ja eksport | A |
| `Testdata/` | proovikomplekt notebooki katsetamiseks (mitte päris treeninguks) | B |
| `scripts/` | `loo_issued.sh` – sildid + 1. nädala issue'd | – |

## Esimene kord (C, ~30 min)
```bash
git clone <repo> && cd varraste-loendur
cd app && npm ci && cp .env.example .env   # täida Supabase'i väärtused
npm run dev                                 # http://localhost:5173 – kaamera töötab localhostil ilma HTTPS-ita
```
GitHubis: Settings → Pages → Source **GitHub Actions**; Settings → Secrets → `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Push main-i → leht avaldub ise.
Issue'd: `gh auth login && ./scripts/loo_issued.sh`, siis Projects → New project → Board, lisa repo issue'd.

## Kuidas me töötame
- `main` on alati töötav ja avaldub automaatselt. Muudatus = lühike haru + PR, teine inimene vaatab üle ja mergib.
- Iga nädala 3 asja inimese kohta on issue'd sildiga `A-andmed` / `B-mudel` / `C-rakendus`. Reedene 30 min kõne käib boardi järgi.
- Otsus, mis kestab üle nädala → `docs/otsused.md`. Skeemimuudatus → `supabase/NNN_*.sql`, mitte paneelist.
- Suured failid (fotod, `.pt`, datasetid) on Drive'is `varraste-loendur/`, mitte repos. Repos on ainult `app/public/model.onnx` (~11 MB).

## Uue mudeli avaldamine
1. Colabis: notebook → `runs/<katse>.onnx` Drive'is.
2. Kopeeri `app/public/model.onnx` peale, commit `model: <katse>, conf 0.35, MAE 1.2`.
3. Supabase SQL: `update model_version set is_active=false; insert ... is_active=true` (vt supabase/README.md).
4. Push → Pages uuendab → telefonid saavad uue mudeli järgmisel avamisel.

## Litsents
Kood: MIT. Mudel `app/public/model.onnx` on treenitud Ultralytics YOLO11-ga (AGPL-3.0) – kehtib katsetamise ajal; tootmislitsents otsustatakse 8. nädalal (vt docs/otsused.md).
