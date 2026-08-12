# Older changelog entries

Kept for history. Recent changes are in [README.md](../README.md).

## 0.2.11 – Stabilisierung (Phase 2)

- bekannte API-Felder behalten bei `null` den richtigen Typ/Rolle
- fehlende/temporäre API-Abschnitte brechen den Poll nicht mehr ab
- Fehlerlogs redaktieren sensible Felder; strukturierte API-Debug-Logs
- reine Helper in `src/lib/` + Unit-Tests (`npm run test:unit`)

## 0.2.10 – Trusted Publishing / Latest-Vorbereitung

- `common.news` nur noch für auf npm existierende Versionen
- Release über GitHub Actions + Trusted Publishing (Provenance)

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

## 0.2.7 – Schema-Bereinigung

- ungültiges `common.author` aus `io-package.json` entfernt
- veraltete `materialize`/`materializeTab` und `adminTab.icon` entfernt
- `common.title` entfernt (nur `titleLang`)

## 0.2.6 – Adapter-Checker Author-Fix

- `package.json` `author` als Objekt (`name`/`email`) statt String

## 0.2.5 – CI und ESLint

- `@iobroker/eslint-config` und `npm run lint`
- Package-Tests mit `@iobroker/testing`
- GitHub Actions Workflow `.github/workflows/test-and-release.yml`

## 0.2.4 – Öffentliches Repository

- GitHub-Repository auf öffentlich gestellt
- Topics: `iobroker`, `tractive`, `gps`, `geoposition`, `pet`, `tracker`

## 0.2.3 – Metadaten

- package/io-package Metadaten vervollständigt
- README: Link zur Herstellerseite Tractive

## 0.2.2 – Passwort-Verschlüsselung

- Tractive-Passwort in `encryptedNative` / `protectedNative`

## 0.2.1 – Admin-Tab Socket-Fix

- Socket-Verbindung im Admin-Tab für Admin 7 korrigiert

## 0.2.0 – Admin-Übersichtstab

- Admin-Tab mit Kartenübersicht pro Tracker

## 0.1.5 – Update-Skript für den Pi

- `UPDATE_ON_PI.sh`

## 0.1.4 – OpenStreetMap-Link

- `device_pos_report.osmMapUrl`

## 0.1.3 – Zeitstempel-Anzeige

- Unix-Zeitfelder als Millisekunden mit Rolle `value.time`

## 0.1.2 – Admin jsonConfig

- `i18n: false` in `admin/jsonConfig.json` (Labels bleiben multilingual inline)

## 0.1.1 – Instanzobjekte

- `info`, `info.connection`, `info.lastUpdate` und `rawJson` als `instanceObjects`

## 0.1.0 – Entwicklungsstand

- Erste Projektstruktur, Anmeldung, Polling, dynamische Datenpunkte
