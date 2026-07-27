# Vis-2: Tractive Overview

Material-Übersicht für Tracker `tractive-next.0.XLYLJQDD` (Tablet quer, 1280×800).

## In bestehendes Projekt einfügen (empfohlen)

Du brauchst **keine** neue Projekt-ZIP – nur eine einzelne Seite:

1. Bestehendes Vis-2-Projekt öffnen.
2. Links oben **Seiten** → Icon **Importieren** (neben dem Plus).
3. Inhalt von [`TractiveOverview-view.json`](TractiveOverview-view.json) komplett kopieren und einfügen  
   (oder die Datei öffnen und den JSON-Inhalt paste’n).
4. View-Name z. B. `tractive` vergeben → **Import view**.
5. Seite speichern und im Runtime prüfen.

Die Styles sind in den HTML-Widgets **inline** – du musst nichts an `vis-user.css` ändern.

### Voraussetzungen

- `vis-2-widgets-material` installiert
- `enableCommands` in `tractive-next.0` aktiv (für die Schalter)

### Widget-IDs

Die Widgets heißen `wTr…`, damit sie seltener mit bestehenden IDs kollidieren. Falls Vis-2 trotzdem umbenennt: ok.

## Alternativ: komplettes Projekt

[`TractiveOverview.zip`](TractiveOverview.zip) = eigenständiges Projekt (nur nötig, wenn du kein bestehendes Projekt hast).

## Anpassen

- Andere Tracker-ID: in der importierten View alle Vorkommen von `XLYLJQDD` ersetzen.
- Andere Instanz: `tractive-next.0` → `tractive-next.N`.
