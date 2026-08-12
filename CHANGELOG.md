# Changelog

The user-facing changelog lives in [README.md](README.md). This file mirrors recent entries for maintainers.

## 0.5.1 – Repository-Checker-Fixes

- `common.news` nur noch für auf npm existierende Versionen (E2004: `0.4.1` entfernt)
- README-Installation über `iobroker url` statt Direkt-`npm install` des Adapters (E6012)
- ältere Changelog-Einträge nach `CHANGELOG_OLD.md` (W6020)

## 0.5.0 – Tagesverlauf im Admin

- Admin-Übersicht: 24h-Weg als Polyline, Heatmap ein/aus, Zeit-Slider für Positions-Playback
- neuer Datenpunkt `…history.distanceKm`
- Parser/Tests für Track-Punkte (`src/lib/history.ts`)

## 0.4.1 – Command-Status Sync (nur Git; nicht separat auf npm)

- Bei `pending` behält der Adapter den angeforderten Control-Wert
- Poll-Grace nach Befehlen
- Admin-Buttons + Vis-2-Übersicht (mit 0.5.0 veröffentlicht)

## 0.4.0 – Steuerung (Phase 4)

- optionale Schreibbefehle: Live-Tracking, LED, Tonsignal (`…controls.*`)
- Schreibschutz über Instanzoption `enableCommands` (Standard: aus)
- Fix: `overview.charging` wertet `NOT_CHARGING` korrekt als `false`

## 0.3.0 – Zusätzliche Lesedaten (Phase 3)

- Aktivitäts-/Gesundheitsübersicht, 24h-Historie, Controls-Status, Geofence-JSON

Older entries: [`CHANGELOG_OLD.md`](CHANGELOG_OLD.md)
