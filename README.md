# 🌦️ Meteostanice – public test (simulátor)

Tento repozitář obsahuje **veřejný test chytré meteostanice**, která není postavená jen na sběru dat, ale hlavně na **rozhodování, plánování a práci s energií**.

Projekt aktuálně běží v **plně funkčním simulátoru**, který se chová stejně, jako se bude chovat budoucí **reálné fyzické zařízení** postavené na ESP32.

👉 **Live demo (public test):**  
https://martypetrzel-lab.github.io/meteostanice-publictest/

---

## 🧠 O co v projektu jde?

Cílem je vytvořit meteostanici, která:

- ❌ není závislá na cloudu ani internetu
- ❌ není jen „hloupý teploměr s grafem“
- ✅ rozumí času (den / noc)
- ✅ hlídá si vlastní energii
- ✅ umí se chovat úsporně
- ✅ dokáže se sama rozhodovat podle podmínek

Jednoduše řečeno:  
**zařízení, které se dokáže o sebe postarat samo.**

---

## 🧪 Proč simulátor?

Než vznikne hardware, běží celý projekt v simulátoru, který umožňuje bezpečně testovat chování systému v čase.

Simulátor:

- běží v **reálném čase** (1 s = 1 s)
- simuluje **denní cyklus** (světlo, teplota)
- počítá **solární příjem i spotřebu**
- ukládá stav (refresh stránky ≠ restart dne)
- umožňuje ladit logiku bez rizika poškození HW

Simulace se chová stejně, jako se bude chovat:
➡️ **ESP32 + baterie + solární panel**

---

## ⚙️ Architektura projektu

Projekt je rozdělený do logických částí:

- `world.js` – simulace prostředí (čas, světlo, teplota)
- `device.js` – virtuální hardware (baterie, spotřeba, solární příjem)
- `brain.js` – logika rozhodování (režimy, větrák, chování)
- `memory.js` – paměť a historická data
- `simulator.js` – propojení systému + persistence stavu
- `ui.js` – vizualizace, grafy, přehledy
- `index.html / style.css` – UI inspirované Home Assistantem

Cílem je mít **jasně oddělené vrstvy**, které půjde později snadno přenést do reálného zařízení.

---

## 🔋 Energie & chování zařízení

Stanice pracuje s těmito principy:

- solární příjem (dle intenzity světla)
- spotřeba zařízení
- výpočet energetické bilance (W / Wh)
- přepínání provozních režimů:
  - `NORMAL`
  - `SAVE`
  - `CRITICAL`

Na základě těchto stavů zařízení dynamicky upravuje:
- chování větráku
- vlastní spotřebu
- hlavní stavovou hlášku
- celkové chování systému

Cílem není maximální výkon, ale **dlouhodobé přežití a stabilita**.

---

## 📡 Směr do budoucna

Plánovaný vývoj projektu:

- ✅ ESP32 jako hlavní řídicí jednotka
- 🔜 reálné senzory (teplota, světlo, napětí)
- 🔜 **LoRa komunikace** (řádově desítky kilometrů, bez internetu)
- 🔜 více uzlů → síť meteostanic
- 🔜 sdílení stavu mezi uzly
- 🔜 varování a události (extrémní podmínky, nízká energie)

Dlouhodobou vizí je **síť soběstačných zařízení**, která:
- se hlídají navzájem
- fungují mimo infrastrukturu
- a dokážou si vyměňovat základní informace i v krizových situacích

---

## 🧪 Stav projektu

- 🔧 **Public test**
- 🧠 Logika ve vývoji
- 🧪 Simulace běží nonstop
- 🚧 UI i data se ladí za provozu

Projekt je otevřený záměrně – cílem je ukázat **celý proces vzniku**, včetně chyb, úprav a postupného zlepšování.

---

## 👀 Pro koho je projekt určený?

- bastlíře
- IT / embedded nadšence
- lidi, kteří řeší energii a soběstačnost
- všechny, koho baví **chytrá zařízení, která dávají smysl**

---

## 📬 Autor

**Martin Petržel**  
Projekt vzniká jako osobní vývojový a testovací projekt.

Nejde o hotový produkt, ale o **cestu k funkčnímu a reálnému zařízení**.


# 📜 CHANGELOG – Projekt EIRA

> EIRA je experimentální simulátor autonomní meteostanice, která se neučí jen měřit,
> ale rozumět světu, energii a sama sobě.

---

## 🟢 v0.1 – První dech
**(ZÁLOHA 0.1)**

- základní Node.js simulátor
- jednoduchý běh v čase
- generování teploty a světla
- statický svět bez paměti
- žádná energie, žádné rozhodování
- cíl: ověřit základní funkčnost simulátoru

---

## 🟢 v0.2 – Svět dostává tvar
**(ZÁLOHA 0.2)**

- oddělení světa a zařízení
- základní den / noc
- realističtější změny světla
- první struktura `state`
- příprava na paměť a historii

---

## 🟢 v0.3 – Paměť a historie
**(ZÁLOHA 0.3)**

- zavedení paměti zařízení
- ukládání denních hodnot
- výpočet min / max
- rozlišení dnešních dat a historie
- odhaleny limity nekonzistentní paměti

---

## 🟢 v0.4 – Stabilizace dat
**(ZÁLOHA 0.4)**

- sjednocení struktury paměti
- opravy pádů při zápisu dat
- bezpečná migrace paměti
- stabilní běh při změnách struktury

---

## 🟡 B 3.0 – Zrození EIRA

- oddělení modulů `world`, `device`, `brain`
- vznik koncepce autonomního zařízení
- základní mozek (`brain.js`)
- zařízení zatím bez stresu a krizí

---

## 🟡 B 3.1 – Reálný čas

- simulátor běží 1:1 s reálným časem
- žádné zrychlování ani demo smyčky
- připraveno pro dlouhodobý běh

---

## 🟡 B 3.2 – Energie vstupuje do hry

- zavedení baterie a SOC
- simulace příjmu energie ze světla
- simulace spotřeby zařízení
- energie jako omezený zdroj
- zařízení může být ohroženo vybitím

---

## 🟡 B 3.3 – Mozek začíná přemýšlet

- mozek vyhodnocuje stav světa
- reakce na energetické podmínky
- ukládání kontextu rozhodování
- první náznaky adaptivního chování

---

## 🟡 B 3.4 – Stres & nestabilita

- testování výkyvů světla
- simulace energetické nestability
- odhalení limitů paměti a rozhodování
- rozhodnutí odložit UI ve prospěch reality

---

## 🟢 B 3.5 – Stabilní mysl
**(AKTUÁLNÍ STABILNÍ VERZE)**

- stabilní backend simulátoru
- konzistentní struktura `state`
- spolehlivá paměť zařízení
- zařízení sleduje svět, energii i historii
- záměrně bez UI
- připraveno na dlouhodobé scénáře a krize

---

## 🔮 Další směr (preview)

- B 3.6 – dlouhodobá paměť a učení
- B 3.7 – přehřátí, mráz, stres, větrák
- B 3.8 – sezónnost, délka dne
- B 3.9 – kombinace extrémů
- 4.0 – predikce a přežití
