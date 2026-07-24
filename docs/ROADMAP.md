# Roadmap

## Phase 1 – Basisadapter

- [x] TypeScript-Projektstruktur
- [x] Admin-Konfiguration für E-Mail, Passwort und Abfrageintervall
- [x] Anmeldung an der Tractive-API
- [x] automatische Token-Erneuerung
- [x] Wiederholungsversuch bei HTTP 401/403
- [x] Tracker-Liste
- [x] Hardwarebericht
- [x] Positionsbericht
- [x] dynamische Datenpunkterzeugung
- [x] vollständige Rohdaten als JSON

## Phase 2 – Stabilisierung

- [ ] API-Endpunkte mit realem Tractive-Konto testen
- [ ] Token-Ablaufzeit und Antwortformat validieren
- [ ] Fehlende Endpunkte tolerant behandeln
- [ ] Objekttypen bei `null`-Werten verbessern
- [x] Unix-Zeitstempel als `value.time` (ms) für lesbare Anzeige
- [ ] strukturierte Debug-Protokolle
- [ ] Unit-Tests für Datentyp-Erkennung
- [ ] Adapter-Checker und Linting ergänzen

## Phase 3 – Zusätzliche Daten

- [ ] Aktivitätsdaten
- [ ] Gesundheitsdaten
- [x] Batteriestatus und Ladezustand
- [x] Kartenlink zu OpenStreetMap
- [x] Admin-Übersichtstab mit Karte (erste Version)
- [ ] Positionshistorie
- [ ] Geofence-Informationen
- [ ] Live-Tracking-Status

## Phase 4 – Steuerung

- [ ] Live-Tracking starten und stoppen
- [ ] Tracker-Licht schalten
- [ ] Tonsignal auslösen
- [ ] Schreibschutz und Bestätigungslogik
- [ ] Fehlerbehandlung für nicht unterstützte Tracker

## Phase 5 – Veröffentlichung

Detaillierte Checkliste: [`docs/PUBLISHING.md`](PUBLISHING.md)

- [ ] Passwort in `encryptedNative` / `protectedNative`
- [ ] Metadaten vervollständigen (`author`, `news`, Keywords, repository-Felder)
- [ ] GitHub-Repo öffentlich + Topics
- [ ] ESLint und Adapter-Checker grün
- [ ] GitHub Actions (Tests + Release)
- [ ] npm-Paket veröffentlichen + Owner `bluefox`
- [ ] Eintrag ins Latest-Repository
- [ ] Forum-Testthread
- [ ] vollständige Dokumentation (EN/DE) inkl. Hersteller-Link und API-Hinweis
- [ ] später Stable nach Feedback
