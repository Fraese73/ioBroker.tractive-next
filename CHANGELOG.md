# Changelog

## 0.2.2 – Passwort-Verschlüsselung

- Tractive-Passwort in `encryptedNative` / `protectedNative` (js-Controller verschlüsselt automatisch)
- nach dem Update Passwort in der Instanzkonfiguration einmal neu speichern

## Unreleased

- Checkliste zur offiziellen Veröffentlichung ergänzt (`docs/PUBLISHING.md`)

## 0.2.1 – Admin-Tab Socket-Fix

- Socket-Verbindung im Admin-Tab für Admin 7 korrigiert
- Fallback-Erkennung über `overview`-Channels
- `materializeTab: true` gesetzt

## 0.2.0 – Admin-Übersichtstab

- Admin-Tab „Tractive Next“ in der linken Seitenleiste (`adminTab`)
- Kartenübersicht pro Tracker (Leaflet/OpenStreetMap)
- stabile Overview-Datenpunkte: Name, Lat/Lon, Genauigkeit, LastSeen, Batterie, Sensor, Adresse, OSM-Link
- Latitude/Longitude zusätzlich unter `device_pos_report`

## 0.1.5 – Update-Skript für den Pi

- `UPDATE_ON_PI.sh`: `git pull`, Kopie nach ioBroker, `npm install`/`build`, Upload und Restart

## 0.1.4 – OpenStreetMap-Link

- pro Tracker wird `device_pos_report.osmMapUrl` aus `latlong` erzeugt (Rolle `text.url`)

## 0.1.3 – Zeitstempel-Anzeige

- erkannte Unix-Zeitfelder (z. B. `time_pos`, `*_at`) werden in Millisekunden umgerechnet
- Rolle `value.time`, damit Admin und Visualisierungen normale Datum/Uhrzeit anzeigen
- bestehende Objekte aktualisieren Typ/Rolle automatisch nach

## 0.1.2 – Admin jsonConfig

- `i18n: false` in `admin/jsonConfig.json` gesetzt (behebt Admin-Warnung wegen fehlendem Pflichtfeld)

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
