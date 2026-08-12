# Reply draft for ioBroker.repositories PR #6370

Post this comment after `v0.5.2` is on npm:

```text
RE-CHECK!

Fixed remaining repository checker findings in release 0.5.2:

**Errors**
- E6013: removed all `iobroker url` / GitHub tarball / direct npm adapter install instructions from README.md. End users are directed to install via ioBroker Admin (Latest) only.

**Warnings**
- W6017 / W6018: removed root `CHANGELOG.md`; user-facing changelog is only in README.md; older history lives under `docs/CHANGELOG_OLD.md` (not both root changelog files)
- W4001: please ignore – this PR adds the adapter to Latest
- W5051: false positive – `sleep` in `src/lib/health.ts` is Tractive sleep/activity payload (`content.sleep`), not a wait/delay helper
- W5015: `i18n: false` kept intentionally; jsonConfig labels already provide inline multilingual objects
- W0062 (`@alcalzone/release-script`, `@iobroker/adapter-dev`): planned for a later release; current CI uses GitHub Actions + Trusted Publishing

Object structure dump was already attached earlier and checked ✔.
```
