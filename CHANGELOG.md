# Changelog

## 0.3.0 – Zusätzliche Lesedaten (Phase 3)

- Aktivitäts-/Gesundheitsübersicht über APS `health/overview` (`…health.*`)
- stabile Overview-Felder `minutesActive` / `minutesGoal` / `liveTrackingActive`
- 24h-Positionshistorie (`…history.positionsJson`, `pointCount`)
- Live-Tracking-/LED-/Buzzer-Status read-only (`…controls.*`)
- Geofence-JSON, falls die API einen Endpunkt liefert

## 0.2.11 – Stabilisierung (Phase 2)

- bekannte API-Felder behalten bei `null` den richtigen Typ/Rolle
- fehlende/temporäre API-Abschnitte brechen den Poll nicht mehr ab
- Fehlerlogs redaktieren sensible Felder; strukturierte API-Debug-Logs
- reine Helper in `src/lib/` + Unit-Tests (`npm run test:unit`)

## 0.2.10 – Trusted Publishing / Latest-Vorbereitung

- `common.news` nur noch für auf npm existierende Versionen (`0.2.10`, `0.2.9`)
- Release über GitHub Actions + Trusted Publishing (Provenance)
- behebt iobroker.dev-Fehler E2004, E2008 und ersetzt fehlgeschlagenen Tag-Deploy von 0.2.9

## 0.2.9 – Checker-Nachbesserungen

- `common.nogit` (Schema-Name) statt ungültigem `noGit`
- echte Übersetzungen für `common.news`
- Deploy-Job auf Node.js 24
- `@iobroker/adapter-core` auf `^3.4.1`

## 0.2.8 – Adapter-Checker-Fixes

- Node.js `>=22`, js-controller `>=6.0.11`, admin `>=7.6.20`
- news auf 7 Einträge begrenzt, jsonConfig Größen/Sprachen
- README: `## Changelog` und `## License`
- CI: Node 24 in der Test-Matrix, Deploy-Job ergänzt
- `.commitinfo` in `.gitignore`, `mocha` aus package.json entfernt

## 0.2.7 – Schema-Bereinigung

- ungültiges `common.author` aus `io-package.json` entfernt (nur `authors` ist erlaubt)
- veraltete `materialize`/`materializeTab` und `adminTab.icon` entfernt
- `common.title` entfernt (nur `titleLang`)

## 0.2.6 – Adapter-Checker Author-Fix

- `package.json` `author` als Objekt (`name`/`email`) statt String – behebt Checker-Fehler E999

## 0.2.5 – CI und ESLint

- `@iobroker/eslint-config` und `npm run lint`
- Package-Tests mit `@iobroker/testing`
- GitHub Actions Workflow `.github/workflows/test-and-release.yml`
- TypeScript-Check-Script `npm run check`

## 0.2.4 – Öffentliches Repository

- GitHub-Repository auf öffentlich gestellt
- Topics: `iobroker`, `tractive`, `gps`, `geoposition`, `pet`, `tracker`

## 0.2.3 – Metadaten

- `package.json`: Author mit E-Mail, Keywords, repository/bugs/homepage
- `io-package.json`: `title`, `author`, `news`, `keywords`, `licenseInformation`, `readme`, `tier`
- README: Link zur Herstellerseite Tractive

## 0.2.2 – Passwort-Verschlüsselung

- Tractive-Passwort in `encryptedNative` / `protectedNative` (js-Controller verschlüsselt automatisch)
- nach dem Update Passwort in der Instanzkonfiguration einmal neu speichern

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
