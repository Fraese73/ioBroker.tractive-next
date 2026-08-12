# Reply draft for ioBroker.repositories PR #6370

Post this comment after `v0.5.1` is on npm:

```text
RE-CHECK!

Fixed repository checker findings in release 0.5.1:

**Errors**
- E2004: removed unpublished `0.4.1` from `common.news` (news now only lists versions that exist on npm)
- E6012: README installation now uses `iobroker url …` only (no direct adapter install via `npm install <adapter>`)

**Warnings**
- W4001: please ignore – this PR adds the adapter to Latest
- W5051: false positive – `sleep` in `src/lib/health.ts` is Tractive sleep/activity payload (`content.sleep`), not a wait/delay helper
- W5015: `i18n: false` kept intentionally; all jsonConfig labels already provide inline multilingual objects (en/de/…)
- W6017 / W6020: changelog remains in README.md; older entries moved to CHANGELOG_OLD.md
- W0062 (`@alcalzone/release-script`, `@iobroker/adapter-dev`): planned for a later release; current CI uses GitHub Actions + Trusted Publishing

Object structure dump was already attached earlier and checked ✔.
```
