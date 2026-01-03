# 🌦️ Meteostanice – public test (simulátor)

Tento repozitář obsahuje **veřejný test chytré meteostanice**, která není postavená jen na sběru dat, ale na **rozhodování, plánování a práci s energií**.

Aktuálně projekt běží **v plně funkčním simulátoru**, který se chová stejně, jako se bude chovat budoucí fyzické zařízení.

👉 **Live demo (public test):**  
https://martypetrzel-lab.github.io/meteostanice-publictest/

---

## 🧠 Co je cílem projektu?

Vytvořit meteostanici, která:

- ❌ není závislá na cloudu
- ❌ není „hloupý teploměr“
- ✅ rozumí času (den / noc)
- ✅ hlídá si vlastní energii
- ✅ umí se chovat úsporně
- ✅ rozhoduje se sama podle podmínek

---

## 🔬 Proč simulátor?

Než vznikne hardware, běží celý projekt v simulátoru, který:

- běží v **reálném čase**
- simuluje **denní cyklus (světlo, teplota)**
- počítá **solární příjem a spotřebu**
- ukládá stav (refresh webu ≠ restart dne)
- umožňuje ladit chování bez rizika HW

Simulátor se chová stejně, jako bude chovat:
➡️ **ESP32 + solární napájení**

---

## ⚙️ Architektura projektu

- `world.js` – simulace prostředí (čas, světlo, teplota)
- `device.js` – virtuální hardware (baterie, spotřeba, solár)
- `brain.js` – logika rozhodování (režimy, větrák, chování)
- `memory.js` – paměť a historická data
- `simulator.js` – propojení všeho + persistence stavu
- `ui.js` – vizualizace, grafy, přehledy
- `index.html / style.css` – UI inspirované Home Assistantem

---

## 🔋 Energie & chování

Stanice pracuje s těmito principy:

- solární příjem (dle světla)
- spotřeba zařízení
- výpočet bilance (W / Wh)
- přepínání režimů:
  - `NORMAL`
  - `SAVE`
  - `CRITICAL`

Na základě toho upravuje:
- chování větráku
- spotřebu
- hlavní stavovou hlášku

---

## 📡 Budoucí verze

Plánovaný vývoj:

- ✅ ESP32 jako hlavní řídicí jednotka
- 🔜 reálné senzory (teplota, světlo, napětí)
- 🔜 **LoRa komunikace** (řádově desítky kilometrů)
- 🔜 více uzlů → síť meteostanic
- 🔜 varování a události (např. extrémní podmínky)

---

## 🧪 Stav projektu

- 🔧 **Public test**
- 🧠 Logika ve vývoji
- 🧪 Simulace běží nonstop
- 🚧 UI a data se ladí za provozu

Projekt je otevřený k nahlédnutí – cílem je ukázat **celý proces vzniku**, ne jen hotový výsledek.

---

## 👀 Pro koho je projekt?

- bastlíři
- IT / embedded nadšenci
- lidi, co řeší energii
- všichni, koho baví „chytrá zařízení, co dávají smysl“

---

## 📬 Kontakt / autor

Autor: **Martin Petržel**  
Projekt vzniká jako osobní vývojový a testovací projekt.

