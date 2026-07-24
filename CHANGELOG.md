# Changelog

## 0.1.1 – Instanzobjekte

- `info`, `info.connection`, `info.lastUpdate` und `rawJson` als `instanceObjects` definiert
- fehlende Instanzobjekte werden beim Start defensiv angelegt (`setObjectNotExistsAsync`)
- behebt js-Controller-Warnungen „State has no existing object“

## 0.1.0 – Entwicklungsstand

- Erste Projektstruktur erstellt
- Anmeldung über Tractive-Zugangsdaten
- automatische Token-Erneuerung
- einmalige Wiederholung bei HTTP 401 oder 403
- Tracker-, Hardware- und Positionsdaten
- dynamische ioBroker-Datenpunkterzeugung
- automatische Datentyp-Erkennung
- Rohdaten-Datenpunkt für Diagnosezwecke
- Cursor-Regeln, AGENTS.md und Roadmap ergänzt
