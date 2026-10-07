# Varraste Loendur – treeningu notebook (arendaja B)

## Failid
- `varraste_loendur_treening.ipynb` – Colabi notebook: datasett → YOLO11n treening → loendusviga kuldsel testil → ONNX eksport → katsete logi
- `proov_dataset.zip` – 16 fotot ainult notebooki proovimiseks (üks foto kopeeritud, märgendid on OpenCV proovist, mitte käsitsi tehtud). Päris treeninguks kõlbmatu.

## Esimene kord (10 min, ilma päris fotodeta)
1. Google Drive'i loo kaust `varraste-loendur/` ja pane sinna `proov_dataset.zip` nimega `dataset.zip`.
2. Ava colab.research.google.com → File → Upload notebook → vali `.ipynb`.
3. Runtime → Change runtime type → T4 GPU.
4. Jaotises 1 pane `EPOHHE = 5` (kiire proov) ja Runtime → Run all. Drive'i ligipääsu küsimusele vasta jah.
5. Kui kõik lahtrid jooksevad läbi ja Drive'is on `runs/yolo11n_v01.onnx` ja `runs/katsed.csv`, on ahel korras.

## Päris treening
1. Roboflow'st: Export → Format "YOLOv11" → Download zip → Drive'i `varraste-loendur/dataset.zip`. (Või jaotises 1 `ANDMED_ALLIKAS = "roboflow"` + API key, siis laeb notebook ise.)
2. Kontrolli, et zipis on `test/` kaust – see on kuldne test (30 fotot, käsitsi kontrollitud märgendid). Roboflow'is jaota Train/Valid/Test nii, et test on need 30.
3. Jaotis 1: `KATSE_NIMI = "yolo11n_v01"`, `EPOHHE = 100`, `IMGSZ = 1024`. Run all. ~20–40 min.
4. Tulemus jaotises 5: keskmine viga vardaid, täpselt õigete osakaal, ±2 osakaal, ja `conf` väärtus, mis läheb rakendusse.
5. ONNX-fail Drive'is `runs/<KATSE_NIMI>.onnx` → äppi **oma nimega** (mitte `model.onnx` üle) ja aktiivseks andmebaasis – vt `docs/jargmised-sammud.md` samm 2.

## Tulemuste salvestamine

PDF-i **ei tee** – notebook salvestab kõik ise Drive'i kausta `varraste-loendur/runs/`.

Pärast iga katset:
1. **`katsed.csv`** – notebook lisas uue rea. See on katse ametlik tulemus.
2. **Rida reposse:** kopeeri see rida faili `docs/katsed.md` tabelisse (commit + push). Nii näeb kogu meeskond ühest kohast, kuidas mudel paraneb.
3. **Ekraanipilt** jaotisest „Fotode kaupa“ (6 halvimat fotot) → meeskonna chatti. Selle järgi otsustame, mida järgmisena pildistada.
4. **Notebook koos väljunditega** (soovi korral): File → Save a copy in Drive.
5. **Ära kustuta** `runs/` kaustast midagi. Iga uus katse saab uue `KATSE_NIMI` (nt `yolo11n_v02`).

## Järgmine katse
Muuda `KATSE_NIMI` (nt `yolo11s_v01`) ja `MUDEL` (`yolo11s.pt`), Run all. Sama datasett, sama test – `katsed.csv` saab uue rea. Lõpetatud katset ei treeni notebook uuesti (Drive'is `VALMIS.txt`), katkenud katse jätkub automaatselt.

## Kui Colab katkestab
Runtime → Run all uuesti. Treening jätkub viimasest salvestatud epohhist (kaalud on Drive'is iga 10 epohhi järel). Tasuta Colabi GPU-limiit on ~päevas piiratud – kaks treeningut päevas on realistlik, kolm mitte.
