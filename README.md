# 🌦️ EIRA – autonomní meteostanice (public test / simulátor)

EIRA je **experimentální open-source projekt autonomní meteostanice**, která není postavená jen na sběru dat,  
ale především na **rozhodování, plánování a práci s omezenou energií**.

Projekt aktuálně běží v **plně funkčním simulátoru**, který se chová stejně, jako se bude chovat budoucí
**reálné zařízení postavené na ESP32, baterii a solárním panelu**.

👉 **Live demo (public test):**  
https://martypetrzel-lab.github.io/meteostanice-publictest/

---

## 🧠 Smysl projektu

Cílem projektu EIRA je vytvořit zařízení, které:

- ❌ není závislé na cloudu ani internetu
- ❌ není jen „hloupý senzor s grafem“
- ✅ rozumí času (den / noc)
- ✅ sleduje vlastní energetickou situaci
- ✅ plánuje dopředu
- ✅ umí se samo přepnout do úsporných režimů
- ✅ dokáže dlouhodobě **přežít bez zásahu člověka**

Jednoduše řečeno:  
**zařízení, které se dokáže o sebe postarat samo.**

---

## 🧪 Proč simulátor?

Než vznikne reálný hardware, celý projekt běží v simulátoru, který umožňuje:

- testovat chování v dlouhém čase (dny / týdny)
- simulovat špatné podmínky bez rizika poškození HW
- ladit rozhodovací logiku a energetické chování

Simulátor:
- běží v **reálném čase** (1 s = 1 s)
- simuluje **světlo, teplotu, den / noc**
- počítá **příjem a spotřebu energie (W / Wh)**
- ukládá stav (obnovení stránky ≠ restart dne)
- chová se stejně jako budoucí:
  **ESP32 + baterie + solární panel**

---

## ⚙️ Architektura

Projekt je rozdělen do jasně oddělených vrstev:

- `world.js` – simulace prostředí (čas, světlo, teplota, scénáře)
- `device.js` – virtuální hardware (baterie, spotřeba, solární příjem)
- `brain.js` – rozhodovací logika (režimy, plánování, šetření)
- `memory.js` – paměť a historická data
- `simulator.js` – propojení systému + persistence stavu
- `ui.js` – vizualizace a přehledy
- `index.html / style.css` – uživatelské rozhraní

Cílem je **oddělení logiky**, aby bylo možné celý systém později
přenést do reálného zařízení bez zásadních změn.

---

## 🔋 Energie & rozhodování

Zařízení pracuje s těmito principy:

- solární příjem (podle intenzity světla)
- aktuální spotřeba zařízení
- integrace energie (Wh, rolling 24 h)
- odhad stavu baterie (SoC + confidence)
- predikce energie do konce dne
- výpočet výdrže v hodinách

Na základě toho přepíná provozní režimy:

- `COMFORT`
- `BALANCED`
- `SAVE`
- `SURVIVAL`

Cílem není maximální výkon, ale **dlouhodobá stabilita a přežití**.

---

## 🧠 Učení a adaptace

EIRA se učí z historie:

- solární profil (hodinové EMA)
- rozpoznání dne / noci z intenzity světla
- délku dne bez pevných časových tabulek
- chování v dlouhodobě špatných podmínkách

Rozhodování vždy pracuje s **nejistotou**, nikdy s absolutními hodnotami.

---

## 🧪 Stav projektu

- 🔧 public test
- 🧠 logika stabilní
- 🔋 energetický model ověřen
- ⏱️ dlouhodobý běh (21denní cykly)
- 🚧 hardware zatím neimplementován

Projekt je otevřený záměrně – cílem je ukázat **celý proces vývoje**,  
včetně slepých uliček, oprav a postupného zrání systému.

---

## 🔮 Směr do budoucna

Plánovaný vývoj:

- ESP32 jako hlavní řídicí jednotka
- reálné senzory (teplota, vlhkost, světlo, proud)
- solární napájení + baterie
- LoRa komunikace bez internetu
- síť více autonomních uzlů
- sdílení základních stavů a varování

Dlouhodobou vizí je **síť soběstačných zařízení**, která fungují
i bez infrastruktury.

---

## 👤 Autor

**Martin Petržel**

Osobní vývojový a testovací projekt.  
Nejde o hotový produkt, ale o **dlouhodobý výzkum a vývoj**.

---

## 🔐 Licence & použití

Projekt je open-source, ale **není určen pro komerční použití bez souhlasu autora**.

Podrobnosti viz soubor `LICENSE`.
