#!/usr/bin/env bash
# Loob sildid ja 1. nädala issue'd. Vajab GitHub CLI-d (gh auth login). Käivita repo juurkaustast.
set -e
for l in "A-andmed:3b6ea5" "B-mudel:8a5a2b" "C-rakendus:4f7a3a" "nädal-1:e0b000" "otsus:b8531f"; do
  gh label create "${l%%:*}" --color "${l##*:}" --force >/dev/null && echo "silt ${l%%:*}"
done
mk(){ gh issue create --title "$1" --label "$2" --label "nädal-1" --body "$3" >/dev/null && echo "issue: $1"; }
mk "Pildistamisjuhend kinnitatud ja 100 fotot kogutud" "A-andmed" "**Valmis, kui:** Drive'is \`varraste-loendur/fotod/\` on ≥100 fotot ≥10 kimbust, igal tegelik arv failinimes.
- [ ] docs/pildistamisjuhend.md üle vaadatud lao inimesega
- [ ] fotod 2 telefoniga, 3 pildistajat
- [ ] iga foto juures tegelik arv"
mk "Otsus: Roboflow (avalik) või CVAT (privaatne) märgistuseks" "A-andmed" "**Valmis, kui:** docs/otsused.md-s on rida. Küsimus ettevõttele: kas kimbufotod tohivad olla avalikus datasetis?"
mk "Colab käib: notebook jookseb proovidatasetiga läbi" "B-mudel" "**Valmis, kui:** Drive'is on \`runs/yolo11n_v01.onnx\` ja \`runs/katsed.csv\`.
- [ ] notebooks/README.md sammud 1–5
- [ ] Ultralytics quickstart: \`yolo predict\` ühel meie fotol"
mk "Avalik rebar-mudel meie 3 fotol" "B-mudel" "**Valmis, kui:** issue'sse on lisatud 3 pilti tulemusega ja lause, kui kaugel valmis mudel on. universe.roboflow.com → otsi 'rebar counting' → Try."
mk "Vite + React app ehitub ja avaneb GitHub Pagesil" "C-rakendus" "**Valmis, kui:** https://<org>.github.io/<repo>/ avaneb telefonis ja 'Laadi mudel' töötab.
- [ ] Settings → Pages → Source: GitHub Actions
- [ ] npm ci && npm run build lokaalselt
- [ ] telefonis: mudel laeb, foto → ringid"
mk "Supabase projekt + skeem" "C-rakendus" "**Valmis, kui:** supabase/README.md sammud 1–5 tehtud, \`select * from model_version\` annab rea 'coco_test'.
- [ ] projekt eu-central-1
- [ ] 001_schema.sql jooksutatud
- [ ] 3 kasutajat loodud (PIN)
- [ ] repo secrets: SUPABASE_URL, SUPABASE_ANON_KEY"
mk "Reede 30 min: 1. nädala seis" "otsus" "Iga inimene: mis toimis, mis mitte, järgmise nädala 3 asja. Tulemus README 'Seis' jaotisse."
