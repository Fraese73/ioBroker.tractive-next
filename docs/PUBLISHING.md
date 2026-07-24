# Veröffentlichung: Checkliste bis ioBroker Latest

Ziel: Andere Nutzer sollen `tractive-next` im Admin unter **Adapter** finden, installieren und aktualisieren können.

Installation für Endnutzer läuft über:

1. npm-Paket `iobroker.tractive-next`
2. Eintrag im **Latest**-Repository (`ioBroker.repositories`)
3. später optional **Stable** mit freigegebener Versionsnummer

Dieses Dokument spiegelt den Stand des Projekts (0.2.x) gegen die offiziellen Anforderungen.

Offizielle Quellen:

- [Publishing your adapter](https://iobroker.github.io/dev-docs/getting-started/04-publish-adapter/)
- [ioBroker.repositories README](https://github.com/ioBroker/ioBroker.repositories)
- [Adapter Checker](https://adapter-check.iobroker.in/)
- [iobroker.dev](https://www.iobroker.dev/)

---

## Ist-Stand (kurz)

| Bereich | Status |
| --- | --- |
| Funktionaler Adapter (Auth, Polling, Objekte, Tab) | weitgehend vorhanden |
| Öffentliches GitHub-Repo | erledigt (öffentlich) |
| npm-Paket | **fehlt** |
| GitHub Actions / Release-Pipeline | **fehlt** |
| Adapter-Checker / ESLint / Tests | **fehlt bzw. unvollständig** |
| Metadaten (`news`, `author`, Keywords, …) | erledigt (0.2.3) |
| Passwort-Verschlüsselung (`encryptedNative`) | erledigt (0.2.2) |
| Eintrag Latest/Stable | **fehlt** |

---

## Phase A – Repo und Basis-Metadaten

- [x] GitHub-Repository **öffentlich** schalten
- [x] Repo-Name bleibt `ioBroker.tractive-next` (großes **B**)
- [x] GitHub **Topics** setzen (`iobroker`, `tractive`, `gps`, `geoposition`, `pet`, `tracker`)
- [x] `package.json` ergänzen:
  - [x] `repository`, `bugs`, `homepage`
  - [x] `keywords`
  - [x] `author` im Format `Name <email>`
  - [ ] sinnvolle Scripts (`lint`, `test:integration`, `release`, …)
- [x] `io-package.json` ergänzen:
  - [x] `common.author` (Singular) und `common.authors` mit E-Mail
  - [x] `common.title` (kurz, Englisch; ohne „ioBroker“/„Adapter“)
  - [x] `common.news` für Releases
  - [x] `common.licenseInformation` (modernes Lizenzformat)
  - [x] `common.readme` / `common.extIcon` (öffentliche Raw-URLs)
  - [x] ggf. `tier`
- [x] README auf Veröffentlichungsniveau:
  - [ ] Englisch verpflichtend, Deutsch willkommen
  - [x] Link zur Herstellerseite (Tractive)
  - [ ] Installation über Admin beschreiben
  - [ ] Changelog einbinden oder verlinken
  - [x] klarer Hinweis: **inoffizielle API**
- [ ] Datenschutz-/Sicherheitshinweise (Zugangsdaten, Token, Logging)

## Phase B – Sicherheit und Objektqualität

- [x] `password` in `encryptedNative` + `protectedNative`
- [ ] Abhängigkeiten prüfen (`js-controller` / `admin` für Encryption)
- [ ] Rollen prüfen: keine „faulen“ Rollen wie reines `state`, wo vermeidbar
- [ ] `null`-Behandlung und Typwechsel final absichern
- [ ] Compact Mode testen (Start / Lauf / Stop ohne hängende Timer)
- [ ] Admin-Tab unter aktuellem Admin (7.x) stabil verifizieren

## Phase C – Qualitätssicherung (Pflicht für Latest)

- [ ] Adapter an Creator-/Template-Standard annähern (`npx @iobroker/create-adapter` als Referenz)
- [ ] ESLint einrichten und grün fahren
- [ ] GitHub Actions:
  - [ ] Package-/Adapter-Tests
  - [ ] Integrationstests (mindestens Install/Run)
  - [ ] `test-and-release` Workflow
- [ ] Release-Script (`@iobroker/adapter-dev` / Release per Kommentar)
- [ ] https://adapter-check.iobroker.in/ gegen das öffentliche Repo laufen lassen
- [ ] **alle** Checker-Fehler beheben (Warnungen nach Möglichkeit auch)

## Phase D – npm

- [ ] npm-Account anlegen (2FA)
- [ ] Erstveröffentlichung: `npm publish --access public`
- [ ] Owner hinzufügen (ioBroker-Anforderung), typischerweise:
  - `npm owner add bluefox iobroker.tractive-next`
- [ ] Trusted Publishing für GitHub Actions einrichten **oder** `NPM_TOKEN` Secret
- [ ] Prüfen: Paket enthält `build/`, `admin/`, `io-package.json`, README, LICENSE (`files` in `package.json`)

## Phase E – Latest Repository

Voraussetzungen: öffentliches Repo, npm-Paket, grüner Checker, CI grün.

- [ ] Über [iobroker.dev](https://www.iobroker.dev/) → Manage → **ADD TO LATEST**  
  **oder** PR an `ioBroker.repositories` (`sources-dist.json`, Typ `geoposition`)
- [ ] Nach Merge: im eigenen ioBroker **Latest**-Repo aktivieren und Installation testen
- [ ] Forum-Thread im [Tester-Bereich](https://forum.iobroker.net/category/91/tester) anlegen

## Phase F – Stable (später)

- [ ] Längerer Betrieb im Latest
- [ ] Positives User-Feedback im Forum
- [ ] Feste Version in Stable eintragen (`addToStable`)
- [ ] Discovery nur falls sinnvoll (bei Cloud-Login typischerweise begrenzt)

---

## Empfohlene Reihenfolge für dieses Projekt

1. Passwort-Verschlüsselung + Metadaten nachziehen  
2. Repo öffentlich + Topics  
3. ESLint + GitHub Actions + Adapter-Checker  
4. npm publish + Owner  
5. ADD TO LATEST  
6. Forum-Tests → irgendwann Stable  

Feature-Arbeit (Aktivität, Live-Tracking, …) kann parallel laufen, sollte die Veröffentlichung aber nicht blockieren, sobald der Adapter stabil und checker-grün ist.

---

## Was Endnutzer danach tun

Im Admin:

1. Adapter-Repository **Latest** (für neue Adapter nötig)
2. Adapter suchen: **Tractive Next** / `tractive-next`
3. Installieren / Aktualisieren wie jeden anderen Adapter

Manuelles `git pull` auf dem Pi ist dann nur noch für Entwickler relevant.
