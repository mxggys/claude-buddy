# Claude Buddy

Kleiner Pixel-Begleiter für Windows 11, der unten an der Taskleiste sitzt.

Figuren: Mini-Claude (tippt auf einem Laptop, macht Kaffeepausen), Boo (Bettlaken-Geist, schwebt),
Frosti (Pinguin, watschelt beim Tippen), Axo (Axolotl, Kiemen wackeln beim Tippen),
Hopsi (Hase, springt höher, klappt im Schlaf ein Ohr um), Pando (Panda),
Kuschel (Koala, schläft beim Streicheln ein, auch seitlich am Fenster),
Mokka (Kaffeetasse, dampft, morgens und beim schnellen Tippen kräftiger),
Monsti (Energydose wie eine weiße Monster-Dose, mit Gesicht, sprudelt beim schnellen Tippen). Alle außer Mokka machen Kaffeepausen mit eigenem Becher.

## Was sie kann
- Sitzt unten rechts an der Taskleiste. Gedrückt halten und ziehen setzt sie um, der Platz wird gemerkt.
  Mit „Schwerkraft“ aus bleibt sie überall stehen, wo du sie hinziehst (oben, Mitte, unten).
- Schaut zum Mauszeiger, tippt mit, wenn du tippst, bewegt den Mund zum Mikrofon (optional).
- Klick: Hüpfer. Doppelklick: großer Sprung. Streicheln (Maus hin und her): Herzen.
  Oder rechte Maustaste gedrückt halten und über die Figur reiben (danach öffnet sich kein Menü).
  Festhalten: zappelt. Aus großer Höhe fallen lassen: kurz schwindelig.
  Figuren mit Armen: Klick auf einen Arm winkt mit diesem Arm, ruht der Zeiger auf ihr, reckt sie die Arme hoch.
- Feste Rangfolge, damit sich nichts vermischt: Festhalten > Reaktion > Sprung > Schlaf > Mittippen
  > Mikrofon > Streicheln > Leerlauf.
- Leerlauf: gähnen, strecken, putzen, picken, schütteln, watscheln, umschauen, Pilz, Ideen-Glühbirne;
  Mini-Claude winkt, zwinkert und tanzt (auch nach 3 Minuten Tippen am Stück).
- Schlaf: Zzz, Schnarchblase.
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
  Wetter für deinen Ort (Schirm, Sonnenbrille, Regen, Schnee, Temperatur; Daten von Open-Meteo).
  Regen und Schnee zeigt sie nur, wenn wirklich etwas fällt (gemessener Niederschlag der letzten 15 Minuten),
  alle 15 Minuten aktualisiert. Wetter-Schild mit Symbol, Temperatur und Regenrisiko in Prozent; im Menü dazu
  gefühlte Temperatur und Wind.
- Begrüßung beim Start, Doppelklick aufs Symbol holt die Figur zurück.
- Reaktionen: erschrickt bei sehr schnellem Tippen, wird schwindelig bei Klick-Spam,
  jubelt nach 10 Minuten konzentriertem Tippen, wird traurig, wenn sie lange nicht beachtet wird.
- Müde und Schlaf nur nach längerer Pause (tagsüber 6 / 12 Minuten, abends 4 / 7 Minuten).
- Nicht stören: 1 Stunde schlafen und auf nichts reagieren.
- Erinnerung / Wecker im Menü: in 5 bis 60 Minuten, eigene Minuten oder eine Uhrzeit. Dann klingelt die Figur
  mit Glocke und hüpft (bis du draufklickst, höchstens 30 s), und am Symbol erscheint eine Windows-Meldung.
- Werfen: schnell ziehen und loslassen, die Figur fliegt, prallt an den Bildschirmrändern ab und bleibt dort, wo sie landet.
  Frosti rutscht danach auf dem Bauch weiter.
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
- Füttern (im Menü): der Snack ploppt mit Funkeln über ihr auf und segelt im Bogen herunter, sie schaut hoch und
  schnappt ihn mit einem Hüpfer, isst ihn in drei Bissen (mit Krümeln) und freut sich. Frosti bekommt Fisch,
  Hopsi eine Karotte, Pando Bambus, die anderen Apfel oder Keks.
- Spielzeit im Menü: wie lange ihr schon zusammen verbracht habt (Stunden und Minuten, heute und insgesamt,
  seit dem ersten Start), mit Zeit-Abzeichen von 1 bis 10.000 Stunden.
- Neuer Tipp-Rekord: Jubel mit Konfetti (Axo feiert doppelt und tanzt).
- Abklatschen: Zeiger auf ihr ruhen lassen, bis sie die Arme hochreckt, dann klicken.
- Mausrad über der Figur: sie dreht sich einmal im Kreis. Zeiger zweimal um sie kreisen lassen: ihr wird schwindelig.
- Neue Leerlauf-Aktionen für alle: Niesen (mit Staubwolke) und Pirouette.
- Ball zum Spielen (im Menü): die Figur jagt den Ball, schießt ihn weg, köpft ihn hoch oder bringt ihn nach Hause.
  Ball festhalten und werfen, oder anklicken, um ihn hochzuspielen (fünfmal in der Luft halten: Jubel).
  Nach einer Minute ohne Spiel räumt sie ihn weg.
- Anschleichen: Ruht der Zeiger in ihrer Nähe am Boden, schleicht sie sich heran und springt drauf.
- Zweite Figur (im Menü wählbar oder aus): beide schauen sich an, winken sich zu und schauen hin, wenn die andere hüpft.
- Laune (abschaltbar): Füttern, Streicheln, Abklatschen und Spielen machen fröhlich, ohne Beachtung sinkt sie langsam.
  Steht im Menü; traurig ist sie öfter betrübt, überglücklich tanzt sie mehr.
- Pausen-Erinnerung (abschaltbar): nach 60 Minuten Tippen am Stück streckt sie sich und hält ein „Pause?“-Schild hoch.
- Abzeichen bei 1.000 bis 1 Million Tastendrücken mit Medaille und Konfetti, Liste im Tippzähler-Menü.
- Ist ein Download fertig, hüpft sie kurz vor Freude.
- Neue Datei auf dem Desktop: sie erschrickt kurz und schaut mit der Lupe nach.
- Schnee im Winter (abschaltbar): Dezember bis Februar ist jeder dritte Tag ein Schneetag (bei echtem Schneewetter
  sowieso). Schnee bleibt auf der Taskleiste und auf dem Fenster liegen, sie baut einen Schneemann und bekommt
  eine kleine Schneehaube.
- Tägliches Geschenk: jeden Tag ein Päckchen neben ihr, Klick packt es aus. Zubehör für vier Plätze, die sich
  kombinieren lassen (Aussehen → Zubehör):
  - Kopf: Krone, Zauberhut, Zylinder, Heiligenschein, Teufelshörner, Piratenhut, Cowboyhut, Wikingerhelm,
    Propellermütze, Katzenohren, Sternen-Haarreif, Ninja-Stirnband, Drachenhörner, Einhorn-Horn, Hexenhut,
    Punk-Iro, Samurai-Helm, Buddy-Snapback, Fischerhut
  - Mund: Zigarette, Joint, Zigarre, Pfeife, Vape, Zahnstocher. Glut-Teile haben zwei feine, verschnörkelte Rauchfäden.
    Die Zigarette brennt ab (ca. 6 Minuten, jeder Zug kürzt sie), wird ausgedrückt und mit dem Feuerzeug neu angezündet.
    Nach dem Joint: rote, müde Augen und kurz darauf Heißhunger (Denkblase mit Keks, Füttern stillt ihn). Figuren mit Armen halten Zigarette & Co. in der Hand.
    Klick auf die Figur: Hand zum Mund, Zug mit halb geschlossenen Augen (Glut/LED leuchtet auf), Hand runter,
    dann ausatmen: ein Rauchstrahl, der nach vorne zieht, aufsteigt und zerfließt (manchmal mit Rauchring),
    bzw. eine dicke Vape-Wolke (mit gelegentlichem Husten). Ab und zu auch von selbst und meistens nach einem Sturz.
  - Begleiter: Kuschelkissen (hinter ihr), Skateboard (unter ihr), Teddy (neben ihr), Aschenbecher (neben ihr:
    Asche wird dort abgeklopft, ausgedrückte Kippen sammeln sich)
  - Effekt: Heldenumhang
  - selten im goldenen Päckchen (jedes 10. sicher): Goldkrone, Diamant-Diadem, Neon-Vape (wechselnde LED),
    Engelsflügel, Regenbogen-Glitzer, Flammen-Aura, Blitz-Aura
  Selbst gewähltes Zubehör geht vor Feiertags-Hüten.
- Eigener Name (Aussehen → Name geben): steht oben im Menü, am Taskleisten-Symbol und als Schild über der Figur,
  wenn der Zeiger auf ihr ruht.
- Wochenrückblick: Sonntagabend (oder bis Mittwoch nachgeholt) eine Meldung mit Tasten, gemeinsamer Zeit,
  Füttern, Streicheln, Ballkontakten und dem besten Tag; jederzeit unter Spielzeit → Wochenrückblick.
- Farbvarianten unter Aussehen: Original, Blau, Grün, Lila, Rosa, Gold, Mitternacht (auch für die zweite Figur).
- Spielzeit im Menü: wie oft gefüttert, gestreichelt, abgeklatscht, geworfen und mit dem Ball gespielt wurde,
  mit eigenen Abzeichen (Sterne) und Feier.
- Sitzt sie auf einem Fenster: Schütteln lässt sie herunterpurzeln, beim Minimieren springt sie ab und läuft nach Hause,
  schnelles Verschieben genießt sie.
- Stabiler und sparsamer: abgestürzte oder hängende Figur wird neu geladen, Posen werden zwischengespeichert,
  das Fehler-Log wird automatisch gekürzt.
- Eigenheiten: Pando kaut Bambus und kugelt sich bei Klick-Spam, Boo wird beim Anklicken durchsichtig und verblasst
  ab und zu, Hopsi macht Freudensprünge, alle hüpfen ab und zu vor Freude.
- Ostern (Hasenohren, Osterei) und Halloween (Kürbis, Fledermäuse am Abend), abschaltbar unter Extras.
- Vollbild-Spiele und -Videos: wird ausgeblendet (abschaltbar).
- Läuft zusammen mit TranslucentTB (durchsichtige Taskleiste): Fährt der Zeiger über die Figur, holt sie sich
  wieder nach vorne, damit sie sich auch direkt nach einem Klick auf die Taskleiste anfassen und ziehen lässt.

## Menü
Links- oder Rechtsklick auf das Symbol unten rechts in der Taskleiste, oder Rechtsklick auf die Figur:
- oben: Name und Laune, Füttern, Ball, Erinnerung / Wecker, Nicht stören
- Tippzähler (heute, Woche, gesamt, Rekord, Abzeichen) und Spielzeit
- Aussehen: Figur, zweite Figur, Farbe, Größe (10 bis 300 %, eigene Werte, Strg + Mausrad), Feiertage und Wetter
- Verhalten: Laufen, Schwerkraft, auf Fenster setzen / springen, Mittippen, Mikrofon, Pausen-Erinnerung, Laune
- System: Energiesparmodus, Vollbild, Autostart, Figur zurückholen, Fehler-Log
- Updates, Beenden

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
