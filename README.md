# Varraste Loendur

Rakendus, mis loeb foto järgi kokku kimpu pakitud metallvardad. Mudel jookseb telefoni brauseris, andmed Supabase'is, leht GitHub Pagesil. Kõik tasuta.

**Seis (uuenda igal reedel):** nädal 1 – alustatud 2026-09-23.

## Kaustad
| Kaust | Mis | Kelle |
|---|---|---|
| `app/` | Vite + React + TS PWA; `src/lib/yolo.ts` (mudel brauseris), `src/lib/supabase.ts` (salvestus) | C |
| `app/public/telefonitest/` | kiirustest, mille laotelefonid läbisid (0,7–0,9 s) | – |
| `notebooks/` | Colab: treening → loendusviga → ONNX | B |
| `supabase/` | skeem, RLS, RPC; iga muudatus uue `NNN_*.sql` failina | C |
| `docs/` | arhitektuur, arendusplaan, otsused, pildistamisjuhend, kokkuvõte | kõik |
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
