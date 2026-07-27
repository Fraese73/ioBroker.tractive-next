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
- [x] Fehlende Endpunkte tolerant behandeln
- [x] Objekttypen bei `null`-Werten verbessern
- [x] Unix-Zeitstempel als `value.time` (ms) für lesbare Anzeige
- [x] strukturierte Debug-Protokolle
- [x] Unit-Tests für Datentyp-Erkennung
- [x] Adapter-Checker-Befunde (0.2.8) und Linting ergänzt

## Phase 3 – Zusätzliche Daten

- [x] Aktivitätsdaten
- [x] Gesundheitsdaten
- [x] Batteriestatus und Ladezustand
- [x] Kartenlink zu OpenStreetMap
- [x] Admin-Übersichtstab mit Karte (erste Version)
- [x] Positionshistorie (24h als JSON)
- [x] Geofence-Informationen (JSON, sofern API liefert)
- [x] Live-Tracking-Status (read-only)

## Phase 4 – Steuerung

- [x] Live-Tracking starten und stoppen
- [x] Tracker-Licht schalten
- [x] Tonsignal auslösen
- [x] Schreibschutz und Bestätigungslogik (`enableCommands`)
- [x] Fehlerbehandlung für nicht unterstützte Tracker
- [x] Optimistischer Status bei `pending` + Poll-Grace (0.4.1)
- [x] Admin-Übersicht: Control-Buttons + höhere Karte (0.4.1)
- [x] Vis-2 Material-Übersicht zum Import (`docs/vis-2/`)
- [x] Admin-Tagesverlauf: Track, Heatmap, Zeit-Slider (0.5.0)

## Phase 5 – Veröffentlichung

Detaillierte Checkliste: [`docs/PUBLISHING.md`](PUBLISHING.md)

- [x] Passwort in `encryptedNative` / `protectedNative`
- [x] Metadaten vervollständigen (`author`, `news`, Keywords, repository-Felder)
- [x] GitHub-Repo öffentlich + Topics
- [x] ESLint und Adapter-Checker-Fixes (0.2.8)
- [x] GitHub Actions (Tests Node 22/24 + Deploy-Job)
- [x] Version taggen (`v0.2.9`) und Checker erneut laufen lassen
- [x] npm-Paket veröffentlichen + Owner `bluefox` (Einladung angenommen)
- [x] Trusted Publishing auf npmjs.com
- [x] Eintrag ins Latest-Repository (ADD TO LATEST ausgelöst; Merge abwarten)
- [ ] Forum-Testthread
- [ ] vollständige Dokumentation (EN/DE) inkl. Hersteller-Link und API-Hinweis
- [ ] später Stable nach Feedback
