# Projekt in Cursor öffnen

## Auf dem Mac

1. ZIP-Datei entpacken.
2. Cursor starten.
3. **File → Open Folder** auswählen.
4. Den Ordner `ioBroker.tractive-next` öffnen.
5. Das integrierte Terminal öffnen.
6. Abhängigkeiten installieren:

```bash
npm install
```

7. Projekt kompilieren:

```bash
npm run build
```

## Projekt auf den Raspberry Pi übertragen

Standardmäßig verwendet das Skript den Hostnamen `shpi5` und den Benutzer `pi`:

```bash
./scripts/deploy-pi.sh
```

Bei einer IP-Adresse:

```bash
PI_HOST=192.168.2.100 ./scripts/deploy-pi.sh
```

Danach auf dem Pi:

```bash
ssh pi@shpi5
cd /home/pi/ioBroker.tractive-next
chmod +x INSTALL_ON_PI.sh
./INSTALL_ON_PI.sh
```

## Cursor-Auftrag für den ersten Test

In Cursor kann folgender Auftrag verwendet werden:

> Prüfe das gesamte Projekt anhand von AGENTS.md. Führe `npm install` und `npm run build` aus. Behebe ausschließlich echte TypeScript- oder Paketfehler. Ändere noch keine API-Endpunkte ohne vorher die bestehende Implementierung zu analysieren.
