# AGENTS.md

## Projektziel

`ioBroker.tractive-next` ist ein moderner, inoffizieller ioBroker-Adapter für Tractive-GPS-Tracker.

Der Adapter soll:

- Tractive-Konten sicher authentifizieren
- mehrere Tracker unterstützen
- Tracker-, Hardware- und Positionsdaten lesen
- neue API-Felder automatisch als ioBroker-Datenpunkte anlegen
- 401/403-Fehler durch Token-Erneuerung abfangen
- später Live-Tracking, Aktivitätsdaten, Geofences, Licht und Tonsignal unterstützen

## Technischer Rahmen

- Sprache: TypeScript
- Laufzeit: Node.js
- Plattform: ioBroker
- HTTP-Client: Axios
- Quellcode: `src/`
- Build-Ausgabe: `build/`
- Admin-Konfiguration: `admin/jsonConfig.json`
- Adapter-Metadaten: `io-package.json`

## Entwicklungsregeln

1. Keine Zugangsdaten, Token oder Tracker-IDs fest im Quellcode speichern.
2. Tractive-API-Aufrufe zentral über `apiGet()` beziehungsweise eine gemeinsame API-Schicht ausführen.
3. HTTP 401 und 403 höchstens einmal automatisch wiederholen.
4. Schreibende Funktionen nur bewusst und mit klaren Datenpunkten implementieren.
5. Neue API-Felder robust behandeln:
   - `null` darf keinen Absturz verursachen.
   - Objekte und Arrays als JSON speichern.
   - Datentypen bei später eintreffenden konkreten Werten aktualisieren.
6. Alle erzeugten ioBroker-Objekte müssen passende Rollen, Lese- und Schreibrechte erhalten.
7. Logs dürfen keine Passwörter oder Access-Tokens enthalten.
8. Nach Änderungen mindestens `npm run build` ausführen.
9. Bestehende Datenpunkt-IDs möglichst stabil halten.
10. Änderungen in `CHANGELOG.md` und bei größeren Funktionen in `docs/ROADMAP.md` dokumentieren.

## Aktuelle Prioritäten

1. Steuerbefehle am realen Tracker testen (`enableCommands`)
2. Aktivitäts-/Gesundheitsdaten und Historie im Betrieb validieren
3. Dokumentation EN/DE und Forum-Testthread
4. Optional Admin-Tab um Control-Schalter ergänzen
