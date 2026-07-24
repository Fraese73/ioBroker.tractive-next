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
- [ ] strukturierte Debug-Protokolle
- [ ] Unit-Tests für Datentyp-Erkennung
- [ ] Adapter-Checker und Linting ergänzen

## Phase 3 – Zusätzliche Daten

- [ ] Aktivitätsdaten
- [ ] Gesundheitsdaten
- [ ] Batteriestatus und Ladezustand
- [ ] Kartenlink zu OpenStreetMap
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

- [ ] vollständige Dokumentation
- [ ] Datenschutz- und Sicherheitshinweise
- [ ] Tests auf aktuellem ioBroker
- [ ] GitHub Actions
- [ ] Release-Paket
- [ ] Vorbereitung für npm/ioBroker-Repository
