# Arendaja juhend – Varraste Loendur

Lihtsas keeles, sammhaaval. Kõik käsud kirjutatakse terminali (Windowsis PowerShell, Macis Terminal).

---

## 0. Ühekordne ettevalmistus (ainult esimesel korral)

1. Paigalda **Git** – git-scm.com → Download → Next-Next-Finish.
2. Paigalda **Node.js** – nodejs.org → LTS versioon → Next-Next-Finish.
3. Windowsis ava PowerShell ja luba skriptid (üks kord):
   ```
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
   Vasta `Y`.
4. Tõmba projekt oma arvutisse:
   ```
   git clone https://github.com/AIgonen/varraste-loendur.git
   cd varraste-loendur\app
   npm ci
   ```
5. Küsi Andreilt Supabase'i võtmed. Tee kaustas `app` fail nimega `.env` ja kleebi sinna:
   ```
   VITE_SUPABASE_URL=https://....supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

---

## 1. Kuidas äppi käivitada

1. Ava terminal.
2. Mine äpi kausta:
   ```
   cd varraste-loendur\app
   ```
3. Käivita:
   ```
   npm run dev
   ```
4. Terminal näitab aadressi, tavaliselt `http://localhost:5173`. Ava see brauseris.
5. Kui muudad koodi ja salvestad faili, uueneb brauser ise – ei pea uuesti käivitama.

**Telefonis testimiseks** ei pea midagi käivitama – avalik versioon on alati aadressil
`https://aigonen.github.io/varraste-loendur/` (uueneb ise, kui midagi jõuab `main` harru).

---

## 2. Kuidas äppi peatada

Terminalis, kus äpp jookseb, vajuta **Ctrl + C**. Kui küsib „Terminate batch job (Y/N)?", vasta `Y`.

Terminali akna sulgemine peatab samuti.

---

## 3. Kuidas uusim kood endale saada (pull)

Tee seda **alati enne**, kui hakkad midagi muutma.

```
cd varraste-loendur
git checkout main
git pull
```

Kui keegi on lisanud uusi pakette, jooksuta ka:
```
cd app
npm ci
```

---

## 4. Kuidas oma muudatus üles saata (push)

Me ei kirjuta kunagi otse `main` harru. Iga muudatus käib oma haru ja pull requesti kaudu, et teine inimene saaks selle üle vaadata.

1. Võta uusim kood (punkt 3).
2. Tee endale haru. Nimi lühike ja kirjeldav, ilma tühikuteta:
   ```
   git checkout -b feat/kinnitusnupp
   ```
3. Tee oma muudatused koodis. Kontrolli, et äpp töötab (`npm run dev`).
4. Salvesta muudatused Giti:
   ```
   git add -A
   git commit -m "Lisasin kinnitusnupu"
   ```
5. Saada üles:
   ```
   git push -u origin feat/kinnitusnupp
   ```
6. Ava brauseris https://github.com/AIgonen/varraste-loendur – üleval on roheline nupp **„Compare & pull request"**. Vajuta, kirjuta 2–3 lauset, mida tegid, ja **Create pull request**.
7. Ütle teisele arendajale, et vaataks üle. Tema vajutab **Merge**. Pärast merge'i uueneb avalik veebiversioon ise umbes 2 minutiga.

Kui pushimisel küsitakse kasutajanime ja parooli: tavaline GitHubi parool **ei tööta**. Paigalda GitHub CLI (cli.github.com), jooksuta `gh auth login`, vali GitHub.com → HTTPS → Login with a web browser. Pärast seda `git push` töötab.

---

## 5. Kui midagi läheb valesti

| Mis juhtus | Mida teha |
|---|---|
| `npm: cannot be loaded because running scripts is disabled` | Punkt 0, samm 3 |
| `Could not read package.json` | Oled vales kaustas – `cd varraste-loendur\app` |
| `git pull` ütleb, et on konflikt | Ära paanitse. Kirjuta chatti, mis fail – lahendame koos |
| Äpp ei avane telefonis | Kontrolli GitHubis Actions vahekaarti – kas viimane jooks on roheline |
| Tahad oma muudatustest loobuda | `git checkout -- .` (kustutab kõik salvestamata muudatused!) |
| Ei tea, mis harus oled | `git status` – esimene rida ütleb |

---

## Reeglid ühe lausega

- Enne tööd `git pull`, pärast tööd pull request.
- Otse `main`-i ei pushi keegi.
- `.env` faili ei panda kunagi Giti (see on juba `.gitignore`'is).
- Suured failid (fotod, mudelid peale `model.onnx`) lähevad Drive'i, mitte reposse.
