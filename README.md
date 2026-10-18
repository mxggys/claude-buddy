# Claude Buddy

Kleiner Pixel-Begleiter für Windows 11, der unten an der Taskleiste sitzt.

Figuren: Mini-Claude, Klassik-Ente, Boo (Geist, schwebt), Frosti (Pinguin, watschelt beim Tippen),
Glibber (Schleim, wabbelt bei jedem Tastendruck, wird beim Landen platt), Axo (Axolotl, Kiemen wackeln beim Tippen),
Hopsi (Hase, springt höher, klappt im Schlaf ein Ohr um), Pando (Panda).

## Was sie kann
- Sitzt unten rechts an der Taskleiste. Gedrückt halten und ziehen setzt sie um, der Platz wird gemerkt.
  Mit „Schwerkraft“ aus bleibt sie überall stehen, wo du sie hinziehst (oben, Mitte, unten).
- Schaut zum Mauszeiger, tippt mit, wenn du tippst, bewegt den Mund zum Mikrofon (optional).
- Klick: Hüpfer. Doppelklick: großer Sprung. Streicheln (Maus hin und her): Herzen.
  Festhalten: zappelt. Aus großer Höhe fallen lassen: kurz schwindelig.
  Figuren mit Armen: Klick auf einen Arm winkt mit diesem Arm, ruht der Zeiger auf ihr, reckt sie die Arme hoch.
- Feste Rangfolge, damit sich nichts vermischt: Festhalten > Reaktion > Sprung > Schlaf > Mittippen
  > Mikrofon > Streicheln > Leerlauf.
- Leerlauf: gähnen, strecken, putzen, picken, schütteln, watscheln, umschauen, Pilz, Ideen-Glühbirne;
  Mini-Claude winkt, zwinkert und tanzt (auch nach 3 Minuten Tippen am Stück).
- Schlaf: Zzz, Schnarchblase, die Ente dreht sich ab und zu um.
- Akku: in Ruhe 15, im Schlaf 8 Bilder pro Sekunde, im Akkubetrieb höchstens 30. Keine GPU-Nutzung,
  nur 2 Prozesse (Grafik und Netzwerk im Hauptprozess), unnötige Chromium-Dienste aus.
- Energiesparmodus in Stufen (Bewegung / Ruhe / Schlaf in Bildern pro Sekunde):
  Leicht 30 / 10 / 5 · Mittel 20 / 6 / 3, niedrige Priorität, Zwischenspeicher wird geleert ·
  Hart 10 / 2 / 1, niedrigste Priorität, Mikrofon aus, keine Leerlauf-Animationen und Effekte,
  Augen folgen nicht, Zeiger und Fenster werden nur noch selten abgefragt.
- Animationen mit Stauchen und Strecken beim Springen und Landen, Drehung zum Mauszeiger,
  leuchtende Tasten beim Mittippen, Atmen im Schlaf, Strecken beim Aufwachen.
- Tippzähler oben im Menü: heute, Woche (pro Tag), gesamt und Rekord (nur die Anzahl, nicht welche Tasten).
- Mini-Claude denkt mit (drei Punkte), wenn ein Claude-Fenster vorne ist.
- Extras: Weihnachtsmütze im Dezember, Partyhut an Silvester/Neujahr und am Geburtstag (mit Konfetti),
  Wetter für deinen Ort (Schirm, Sonnenbrille, Regen, Schnee, Temperatur; Daten von Open-Meteo),
  Wetter-Schild mit Symbol neben der Figur.
- Begrüßung beim Start, Doppelklick aufs Symbol holt die Figur zurück.
- Reaktionen: erschrickt bei sehr schnellem Tippen, wird schwindelig bei Klick-Spam,
  jubelt nach 10 Minuten konzentriertem Tippen, wird traurig, wenn sie lange nicht beachtet wird.
- Müde und Schlaf nur nach längerer Pause (tagsüber 6 / 12 Minuten, abends 4 / 7 Minuten).
- Nicht stören: 1 Stunde schlafen und auf nichts reagieren.
- Vollbild-Spiele und -Videos: wird ausgeblendet (abschaltbar).
- Läuft zusammen mit TranslucentTB (durchsichtige Taskleiste): Fährt der Zeiger über die Figur, holt sie sich
  wieder nach vorne, damit sie sich auch direkt nach einem Klick auf die Taskleiste anfassen und ziehen lässt.

## Menü
Links- oder Rechtsklick auf das Symbol unten rechts in der Taskleiste, oder Rechtsklick auf die Figur:
Tippzähler, Figur, Größe (10 bis 300 %, auch eigene Werte und Strg + Mausrad auf der Figur), Zurückholen,
Extras, Nicht stören, Mittippen, Mikrofon, Vollbild, Energiesparmodus, Autostart, Updates, Fehler-Log, Beenden.
Läuft der Update-Schlüssel bald ab (oder ist abgelaufen), steht ganz oben im Menü ein Hinweis.

## Installieren
`Claude-Buddy-Setup-<version>.exe` aus dem neuesten Release starten. Beim ersten Mal zeigt Windows
„Der Computer wurde durch Windows geschützt“: **Weitere Informationen → Trotzdem ausführen**
(die App ist nicht signiert).

## Automatische Updates (privates Repo)
1. github.com → Profilbild → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Name: `Claude Buddy`, Ablaufdatum nach Wunsch
3. **Repository access → Only select repositories → `claude-buddy`**
4. **Permissions → Repository permissions → Contents → Read-only**
5. **Generate token**, Schlüssel kopieren (`github_pat_…`)
6. In der App: Menü → **Updates → Update-Schlüssel eingeben …** → einfügen → OK

Hattest du schon einen Schlüssel für `peak`: dort unter **Edit → Repository access** `claude-buddy` hinzufügen.

Der Schlüssel wird mit Windows-Verschlüsselung gespeichert, bleibt auch nach Updates erhalten und kann nur lesen.
Die App prüft beim Start und alle 4 Stunden, lädt neue Versionen im Hintergrund
und installiert sie beim Beenden (oder sofort per „Neu starten und installieren“).

## Neue Version veröffentlichen
Versionsnummer in `package.json` erhöhen und pushen. Der Workflow
`.github/workflows/release.yml` baut auf Windows und erstellt das Release.

## Entwickeln
```
npm install
npm start
```
Browser-Vorschau: `src/index.html` öffnen (M = Mikrofon, andere Tasten = mittippen).
