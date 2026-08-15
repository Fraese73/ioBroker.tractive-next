# Reply draft for ioBroker.repositories PR #6370

Post this comment after `v0.5.4` is on GitHub (and npm if applicable), with a **new object dump** attached:

```text
READY FOR RE_REVIEW

Fixed findings from the Claude/adapter review in release 0.5.4:

**Admin tab UI**
- `admin/tab_m.html`: `lang="en"`; all user-visible strings in English
- `admin/tab.js`: all user-visible strings translated to English (status, controls, day track, meta labels)

**Roles / normalize**
- Unknown null fields now use role `text` (no longer invalid `state`)
- `battery_level` always gets `value.battery` (also for concrete numbers)
- `charging_state` hint corrected to string/text
- Existing objects with invalid `role=state` (or pending null hints) are updated on next poll

**Polling**
- Interval capped in code: `Math.min(3600, Math.max(30, …))`

**jsonConfig**
- Real translations for all 11 languages (email, password, interval, enableCommands, notices)

Also included: admin day-track from–to range slider.

Please find a fresh object dump attached (after running 0.5.4 with history/health/controls present if possible).
```
