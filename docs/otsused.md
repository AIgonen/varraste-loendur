# Otsused

Iga tehniline otsus, mis kestab üle nädala, kirjutatakse siia – mitte vestlusesse. Vorm: kuupäev, otsus, miks, mis sellest sõltub.

| Kuupäev | Otsus | Miks | Mõju |
|---|---|---|---|
| 2026-09-06 | Inimene jääb ahelasse: rakendus pakub arvu, töötaja kinnitab | Mudel eksib alati vahel; kinnitused on treeningandmed | UI-s kinnitusnupp ja parandus on kohustuslikud |
| 2026-09-13 | Ainult tasuta tarkvara ja teenused, ilma oma riistvarata | Ettevõtte tingimus | Serverit ei ole; mudel telefonis |
| 2026-09-13 | Katsetame kõigepealt YOLO-ga (AGPL), tootmislitsents otsustatakse 8. nädalal | Kiireim tee esimese tulemuseni; testimiseks vaba | Kasutuselevõtuks kas kood avalikuks või D-FINE-N |
| 2026-09-22 | Mudel jookseb telefoni brauseris (ONNX Runtime Web), leht GitHub Pagesil, andmed Supabase'is | Telefonitest: 3 Androidi, 0,7–0,9 s/pilt WebGPU-l | Ainult kerged mudelid (<~10 MB); RF-DETR jääb välja |
| 2026-09-22 | Loendusviga on põhimõõdik, mitte mAP | Laole loeb, mitu varrast läks valesti | Notebook otsib conf-läve minimaalse vea järgi |
| 2026-09-23 | Üks repo GitHubis: kood, notebook, SQL, dokumendid, issue'd | Kolm inimest, 1 päev nädalas – info ei tohi hajuda | Skeemimuudatused ainult SQL-failidena; otsused siia tabelisse |

## Lisaandmed treeninguks (07.10.2026)
- Kasutame lisaks oma fotodele Roboflow Universe'i datasetti **„object detection“** (autor *jerry*, https://universe.roboflow.com/jerry-4ceaq/object-detection-wrram), 250 armatuurikimbu fotot, litsents **CC BY 4.0** – kasutus lubatud viitega allikale.
- Forgitud meie Roboflow workspace'i, eksporditud ilma Resize'ita → Drive `varraste-loendur/universe-rebar.zip`.
- Ainult treeningusse. Valideerimine ja kuldne test = ainult meie oma laofotod.

## Lisaandmed välja (27.10.2026)
- Katse v29 (ainult meie fotod) vs v26 (meie + Universe 250): keskmine viga 1,53 vs 1,97, täpselt õige 53% vs 34%. **Universe'i lisaandmeid edaspidi ei kasutata** (`KASUTA_LISA = False`).
- Seemnekatsed (v33, v36, v37 – sama seadistus, seed 0/1/2): keskmine viga 1,47–1,59. Alla ~0,1-vardane erinevus katsete vahel on juhus → iga uut seadistust tuleb jooksutada vähemalt kahe seemnega.

## Mudel rakenduses: yolo11n_v37 (28.10.2026)
- Fail `app/public/yolo11n_v37.onnx`, lävi 0,30, SQL `supabase/006_model_v37.sql`. Kuldne test: keskmine viga 1,47, täpselt õige 38%, ±2 piires 84%, max 8.
- Miks v37, mitte v35 (1,44): vahe on juhusliku kõikumise sees; v37 seadistust (100 epohhi) on korratud kolm korda, v35 seadistust (200 epohhi) ainult üks kord ja 150 epohhi (v34) andis 2,16. v37-l on ka parem täpselt õigete osakaal ja väiksem max viga.
- Kontrollitud: brauseri tulemus = Pythoni ONNX tulemus (2 kuldse testi fotot), telefonis töötab.
- Tagasi lülitamine: `update model_version set is_active = false where is_active; update model_version set is_active = true where tag = 'coco_test';`
- Järgmine: piloot laos; uus treening, kui Supabase'is on ~100–200 kinnitatud fotot.
