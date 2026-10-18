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
- Erinnerung / Wecker im Menü: in 5 bis 60 Minuten, eigene Minuten oder eine Uhrzeit. Dann klingelt die Figur
  mit Glocke und hüpft (bis du draufklickst, höchstens 30 s), und am Symbol erscheint eine Windows-Meldung.
- Werfen: schnell ziehen und loslassen, die Figur fliegt, prallt an den Bildschirmrändern ab und bleibt dort, wo sie landet.
  Frosti rutscht danach auf dem Bauch weiter, Glibber prallt noch einmal ab.
- Tageszeit: morgens nach dem Aufwachen ein Winken, mittags ab und zu ein Nickerchen, abends öfter Gähnen,
  nachts schläft sie mit Schlafmütze. Nach über 10 Minuten Pause: Willkommen zurück.
- Fenster: Wird ein Fenster nah an der Figur verschoben, schaut sie hin; schiebt es sich über sie, erschrickt sie.
- Auf Fenster setzen (im Menü einschalten): Figur an den Rahmen eines Fensters ziehen, z. B. beim Claude-Fenster.
  Oben (auch auf den Ecken) sitzt sie, links und rechts hält sie sich seitlich fest, unten hängt sie dran.
  Sie fährt mit, wenn du das Fenster verschiebst oder größer ziehst, und fällt runter, wenn es zugeht oder minimiert wird.
  Beim Ziehen hört sie über einem Fensterrand auf zu zappeln: dann einfach loslassen.
- Springt auf das aktive Fenster (im Menü einschalten): ab und zu hüpft sie auf das Fenster, in dem du gerade arbeitest,
  bleibt ein paar Minuten oben und springt dann wieder nach Hause.
- Läuft herum (im Menü einschalten): ab und zu ein Stück an der Taskleiste (oder auf dem Fenster) entlang und wieder zurück.
- Füttern (im Menü): ein Snack fällt in den Mund, sie kaut und freut sich. Frosti bekommt Fisch, Hopsi eine Karotte,
  Pando Bambus, die anderen Apfel oder Keks.
- Neuer Tipp-Rekord: Jubel mit Konfetti (Axo feiert doppelt und tanzt).
- Abklatschen: Zeiger auf ihr ruhen lassen, bis sie die Arme hochreckt, dann klicken.
- Mausrad über der Figur: sie dreht sich einmal im Kreis. Zeiger zweimal um sie kreisen lassen: ihr wird schwindelig.
- Neue Leerlauf-Aktionen für alle: Niesen (mit Staubwolke) und Pirouette.
- Ball zum Spielen (im Menü): die Figur jagt den Ball, schießt ihn weg oder bringt ihn nach Hause; Klick auf den Ball
  stößt ihn an. Nach einer Minute ohne Spiel räumt sie ihn weg.
- Anschleichen: Ruht der Zeiger in ihrer Nähe am Boden, schleicht sie sich heran und springt drauf.
- Zweite Figur (im Menü wählbar oder aus): beide schauen sich an, winken sich zu und schauen hin, wenn die andere hüpft.
- Laune (abschaltbar): Füttern, Streicheln, Abklatschen und Spielen machen fröhlich, ohne Beachtung sinkt sie langsam.
  Steht im Menü; traurig ist sie öfter betrübt, überglücklich tanzt sie mehr.
- Pausen-Erinnerung (abschaltbar): nach 60 Minuten Tippen am Stück streckt sie sich und hält ein „Pause?“-Schild hoch.
- Abzeichen bei 1.000 bis 1 Million Tastendrücken mit Medaille und Konfetti, Liste im Tippzähler-Menü.
- Ist ein Download fertig, hüpft sie kurz vor Freude.
- Sitzt sie auf einem Fenster: Schütteln lässt sie herunterpurzeln, beim Minimieren springt sie ab und läuft nach Hause,
  schnelles Verschieben genießt sie.
- Stabiler und sparsamer: abgestürzte oder hängende Figur wird neu geladen, Posen werden zwischengespeichert,
  das Fehler-Log wird automatisch gekürzt.
- Eigenheiten: Pando kaut Bambus und kugelt sich bei Klick-Spam, Boo wird beim Anklicken durchsichtig und verblasst
  ab und zu, Hopsi macht Freudensprünge, Glibber zerfließt und ploppt zurück, alle hüpfen ab und zu vor Freude.
- Ostern (Hasenohren, Osterei) und Halloween (Kürbis, Fledermäuse am Abend), abschaltbar unter Extras.
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
