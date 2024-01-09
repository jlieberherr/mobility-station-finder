# Wofür?
Wer eine Reise von A nach B plant und dabei den <a href="https://www.mobility.ch/de">Car-Sharing-Anbieter Mobility</a> nutzen möchte, steht oft vor der Frage, an welcher Mobility-Station das Auto angemietet werden soll. Möglichst nah von zu Hause? Das kann teuer werden (da ein Mobility-Kilometer einiges kostet). Oder möglichst nahe am Ziel? Das kann lange dauern (da der öV nicht immer schnell ist). Oder gibt es vielleicht irgendwo dazwischen eine Mobility-Station, wo der Trade-off zwischen Kosten und Zeit für die persönliche Situation, in welcher man sich gerade befindet, in der Balance ist?

Die Beantwortung dieser Frage(n) hängt von verschiedensten Parametern ab:
- der effektiven öV-Verbindung von zu Hause zur Mobility-Station
- den Kosten, welche für die mit dem Mobility zurückgelegte Wegstrecke anfallen
- der persönlichen Zahlungsbereitschaft resp. der Bereitschaft, eine längere Fahrt in Kauf zu nehmen.

Die Webseite <a href="http://mobility-station-finder.ch/">mobility-station-finder.ch</a> soll es Mobility-Nutzern erleichtert, diese Frage(n) zu beantworten. Und zwar indem alle relevanten Informationen auf einer Webseite zur Verfügung gestellt werden. Damit entfällt das lästige Wechseln zwischen verschiedenen Webseiten (z.B. Mobility-Webseite, SBB-App, Google Maps).

Zu beachten:
- Die Webseite verwendet nur öffentlich zugängliche Daten und kostenlose Services (siehe weiter unten). Die Qualtität dieser Daten resp. Services ist nicht immer so gut, wie dies bei zahlungspflichtigen Diensten der Fall sein kann. Entsprechend ist bei der Interpretation Vorsicht geboten.
- Das Projekt ist auf eine private Initiative hin entstanden und verfolgt keinen kommerziellen Hintergrund. Für die Resultate wird selbstverständlich keine Haftung übernommen.

# Anwendung
## Start und Ziel der Reise definieren
Start resp. Ziel der Reise können auf zwei Arten definiert werden:
- Via die Eingabe einer Adresse in den Suchfeldern "Suche Startpunkt" resp. "Suche Zielpunkt.
- Mausklick rechts auf den Punkt in der Karte, wo die Reise beginnen resp. enden soll -> "Hier Startpunkt setzen" resp. 
"Hier Zielpunkt setzen" anklicken.
In beiden Fällen wird für den Start- resp. Zielpunkt ein Marker gesetzt (rot = Startpunkt, blau = Zielpunkt) und Koordinaten (WGS84) ermittelt, welche als Input für den Algorithmus dienen. Die Position der Marker kann mit der Maus beliebig verschoben werden.
Einschränkung: Start- und Zielpunkt müssen in der Schweiz liegen.

## Mobility-Stationen aufrufen
Sobald Start- und Zielpunkt der Reise definiert sind, kann mittels Klick auf den "Suche"-Button die Suche für die Mobility-Station gestartet werden.
Die gefundenen Mobility-Stationen werden jetzt auf der Karte als Kreise dargestellt. Zudem erscheint links ein Slider. Mit diesem Slider kann eingestellt werden, ob einem die Kosten oder die Zeit wichtig sind. Wenn die Kosten wichtig sind (tiefer Wert im Slider), werden in der Regel die dem Ziel am nächsten liegenden Mobility-Stationen rot eingefärbt (möglichst kurzer Mobility-Weg, sodass die Kosten gering sind). Wenn die Zeit wichtig ist (hoher Wert im Slider), werden in der Regel die Mobility-Stationen in der Nähe des Startes angezeigt (möglichst kurze Reisezeit). Für Posititionen des Sliders dazwischen erscheinen jeweils die Mobility-Stationen in rot, welche für das gerade gesetzte Kosten-Zeit-Verhältnis optimal sind.
Via den oberen Button links kann auch Übersichtstabelle angezeigt werden, in welcher wichtige Kennwerte für die rot angezeigten Mobility-Stationen analysiert werden können.

## Detailinformationen abrufen
Mittels Klick auf einen zu einer Mobility-Station gehörenden Kreis resp. eine Zeile in der Übersichtstabelle, werden Detailinformationen zur Reise geladen. Hier wird nun auch die angegebene gewünschte Abfahrtszeit (inkl. Datum) berücksichtigt. Die Detailinformationen werden einerseits auf der Karte als geographischer Verlauf dargestellt (blau = öV-Weg, rot = Mobility-Weg), andrerseits als Tabelle mit den Ab- und Ankunftszeiten sowie den Umsteigehaltestellen.

# Grundlagen
## Daten und Services
Die Berechnung der Mobility-Stationen erfolgt auf Basis der folgenden Daten:
- Reisezeit- und Umsteigehäufigkeitsmatrizen zwischen den Bezirken des Nationalen Personenverkehrsmodells NPVM (siehe ???)
- Table-Service von OSRM
Die Berechnung der Detailinformationen erfolgt mittels:
- öV-Verbindungsabrfrage auf OJP
- Car-Routing auf OSRM
Weiteres:
- Die angezeigte Karte basiert auf OpenStreetMap-Daten
## Auswahl der Mobility-Stationen
- Start- und Zielpunkt werden via WGS84-Koordinaten aufgelöst
- Für alle Mobility-Stationen in der Schweiz wird die öV-Reisezeite sowie die öV-Umsteiggehäufigkeit vom Startpunkt zu dieser Mobility-Station sowie die Auto-Fahrzeit und die Auto-Kistanz von dieser Mobility-Station zum Ziel ermittelt.
- Für alle Mobility-Stationen und verschiedene Zeitwerte werden generalisierte Kosten berechnet. Die Mobility-Stationen, welche für einen Zeitwert die geringsten generalisierten Kosten haben, werden eruiert und zurückgegeben. Dies sind die in der Karte dargestellten Mobility-Stationen.

