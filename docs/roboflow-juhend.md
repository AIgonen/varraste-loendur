# Roboflow juhend – fotode märgistamine

Lihtsas keeles, sammhaaval. Roboflow on veebileht, kus me näitame mudelile, kus fotol on iga varda ots. Ilma selleta mudel ei õpi.

**Üks mõte, mis kõike seletab:** mudel on nagu uus töötaja. Sa pead talle 100 fotot näitama ja igal fotol näpuga iga varda otsa peale osutama. Näpuga osutamine = kasti joonistamine. Kui joonistad ühel fotol 67 kasti, siis *see ongi* tegelik arv 67 – eraldi numbrit ei kirjuta kuhugi.

---

## 0. Ligipääs (ühekordne)

Projekt on juba loodud: app.roboflow.com → workspace **varraste-loendur** → projekt **varraste-loendur** (Object Detection, klass `bar-end`). Küsi Andreilt kutse – Settings → Members → Invite. Tasuta plaanil võib projektis olla mitu inimest.

---

## 1. Fotode üleslaadimine

Kaks võimalust:

**A. Telefonist otse** (mugavaim laos)
1. Roboflow'is: vasakul **Upload Data** → paremal QR-kood „Upload data from your phone".
2. Skänni telefoniga → avaneb leht → pildista või vali galeriist → Upload.

**B. Arvutist**
1. Vasakul **Upload Data**.
2. Batch Name: pane tähenduslik, nt `ladu-2026-09-30-telefon-A`.
3. Lohista fotod aknasse (või Select Files) → **Save and Continue**.
4. Kui küsib jaotust (Train / Valid / Test): vali **kõik Train** – jaotuse teeme hiljem käsitsi.

---

## 2. Märgistamine – põhitöö

1. Vasakul **Annotate** → vali partii → ava esimene foto.
2. Klahv **B** = Bounding Box tööriist (või vasakul ikoon).
3. Tõmba kast **iga** varda otsa ümber. Klass on `bar-end` (ainus, jääb meelde).
4. Kast tihedalt ümber otsa – mitte lõdvalt, mitte poolikult.
5. Kui valmis, paremal ülal **Next** (või klahv **D**) → järgmine foto.

**Reeglid, mis otsustavad kvaliteedi:**
- Iga ots saab kasti – ka see, mis on pooleldi paberi all või varjus.
- Pooleldi kaadrist väljas ots: kast ainult nähtavale osale.
- Kaks otsa kõrvuti = kaks kasti, ka kui nad puutuvad kokku.
- Ära märgi asju, mis ei ole varda otsad (raam, põrand, paberitükk).
- Kui ei ole kindel, kas see on ots – suurenda (hiireratas). Kui ikka ei tea, jäta kast tegemata ja kirjuta foto juurde märkus.

**Kiirklahvid:** B = kast, D = järgmine, A = eelmine, Delete = kustuta valitud kast, Ctrl+Z = tagasi, hiireratas = suurenda.

Ühele fotole ~65 otsaga kulub alguses 4–5 minutit, hiljem 2–3.

---

## 3. Label Assist – pärast 30 fotot muutub kiiremaks

Kui ~30 fotot on käsitsi märgistatud:
1. Vasakul **Versions** → **Generate New Version** (seaded: vt punkt 5) → **Train** → vali tasuta „Fast" treening. Kestab ~20 min.
2. Annotate-vaates paremal ülal ilmub **Label Assist** (võlukepi ikoon). Lülita sisse, vali oma treenitud mudel.
3. Nüüd pakub Roboflow igal uuel fotol kastid ette. Sina ainult: kustutad valed, lisad puuduvad, vajutad Next.

See teeb ülejäänud 70 fotot 2–3× kiiremaks.

---

## 4. Kuldne test – 30 kõige tähtsamat fotot

Mudeli täpsust mõõdetakse 30 fotol, mida mudel **kunagi treeningus ei näe**. Nende märgistus peab olema täiuslik, sest see on „õige vastus".

1. Vali 30 fotot, mis on **erinevatest kimpudest** kui ülejäänud 70. Sama kimbu teine foto ei tohi olla testis, kui esimene on treeningus.
2. Märgista need eriti hoolikalt. Kontrolli teist korda või lase teisel inimesel üle vaadata.
3. Loe kimbult vardad käsitsi üle ja võrdle kastide arvuga (Roboflow näitab arvu foto juures). Kui ei klapi – vaata foto uuesti üle.
4. Märgi need fotod: Annotate-vaates vali foto → paremal **Tags** → lisa tag `kuldne-test`. Nii leiad need hiljem üles.

---

## 5. Ekspordi datasett Colabi jaoks

1. Vasakul **Versions** → **Generate New Version**.
2. **Train/Test Split**: vajuta „Rebalance" → vali käsitsi: tag `kuldne-test` fotod → **Test**; ülejäänutest ~80% Train, ~20% Valid.
3. **Preprocessing**: eemalda **Resize** (vaikimisi on „Stretch to 640×640" – see rikub resolutsiooni, meie mudel vajab 1024). Auto-Orient võib jääda.
4. **Augmentation**: jäta tühjaks – notebook teeb ise.
5. **Generate**.
6. Versiooni lehel **Download Dataset** → Format: **YOLOv11** → „Download zip to computer".
7. Zip → Google Drive kausta `varraste-loendur/` nimega `dataset.zip`. Ütle B-le – tema käivitab treeningu.

Alternatiiv sammule 6–7: „Show download code" → kopeeri API key, workspace, project, version → B paneb need notebooki jaotisse 1 ja Colab laeb ise.

---

## 6. Kui midagi läheb valesti

| Mis juhtus | Mida teha |
|---|---|
| Kast läks valesse kohta | Kliki kastile → lohista servast; või Delete ja uuesti |
| Kogemata märgistasin vale klassi | Meil on üks klass, ei saa valesti minna |
| Foto on udune / kile peal / külgvaade | Ära märgista. Vali foto → paremal „Mark as Null" või kustuta. Mudel ei pea seda õppima |
| Ei jõua ühe päevaga valmis | Pole hullu, töö salvestub iga kasti järel. Jätka järgmine kord samast kohast |
| Kaks inimest märgistavad korraga | Roboflow jagab partii ise ära; sama fotot kaks inimest ei saa |

---

## Reeglid ühe lausega

- Iga ots = üks kast, kastide arv = tegelik arv.
- 30 kuldse testi fotot on tähtsamad kui 70 ülejäänut.
- Sama kimp ei tohi olla nii treeningus kui testis.
- Ekspordil Resize välja, formaat YOLOv11.
