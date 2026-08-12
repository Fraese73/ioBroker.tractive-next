# ioBroker.tractive-next

Unofficial Tractive GPS adapter for ioBroker.

## Features

- Tractive account login with automatic token renewal
- One automatic retry after HTTP 401 or 403
- Tracker list / details / hardware / position
- Activity and health overview (`…health.*`)
- 24h position history (`…history.*`)
- Optional commands for live tracking, LED and buzzer (`…controls.*`, gated by `enableCommands`)
- Geofence payload as JSON when the API provides it
- OpenStreetMap link and admin map overview tab with live-tracking / LED / buzzer buttons
- Admin day track: path, heatmap toggle, time slider playback
- Optional Vis-2 Material overview project (`docs/vis-2/`)
- Automatic ioBroker object creation and datatype inference
- Encrypted password, ESLint, package/unit tests, GitHub Actions CI

## Important

Manufacturer website: [https://tractive.com/](https://tractive.com/)

Tractive does not provide a documented public consumer API for these trackers. This adapter uses the unofficial endpoint used by existing open-source integrations. Tractive can change it at any time.

## Installation

Until the adapter is listed in the official ioBroker **Latest** repository, install it with the ioBroker CLI (not with a direct global `npm install` of the adapter):

```bash
iobroker url iobroker.tractive-next
```

Or from GitHub:

```bash
iobroker url https://github.com/Fraese73/ioBroker.tractive-next/tarball/main
```

Then open the instance configuration and enter the Tractive email address and password.

After the first install or after password encryption changes, open the instance settings once and save the password again so it is stored encrypted.

Publishing checklist: [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Update (development / Raspberry Pi)

From a git clone on the host (developer workflow):

```bash
cd ~/ioBroker.tractive-next
chmod +x UPDATE_ON_PI.sh
./UPDATE_ON_PI.sh
```

The script pulls the repo, syncs files into the ioBroker adapter directory, builds, uploads the admin UI and restarts the instance.

## Configuration

To send live-tracking / LED / buzzer commands, enable **Enable tracker commands** in the instance settings. The writable states are under each tracker at `…controls.liveTrackingActive`, `…controls.ledActive` and `…controls.buzzerActive`.

Commands go through the Tractive cloud API. Inside a **Power Saving / home zone** the cloud often accepts the request as `pending` but does not activate LED, buzzer or live tracking on the device (the official app can still use Bluetooth Radar locally). Outside that zone, commands work; the adapter keeps an optimistic control value while the API reports `pending`, so the UI does not flip back to `false` before you can turn the feature off again.

## Development status

Read access (trackers, position, hardware, health/activity, history, geofences) and optional write commands (live tracking / LED / buzzer) are implemented. Commands require `enableCommands` in the instance settings.

## Changelog

### 0.5.1
* (Michael Fraessdorf) Repository checker fixes: news only for published npm versions; install docs use `iobroker url`

### 0.5.0
* (Michael Fraessdorf) Admin day track with heatmap toggle and time-slider playback; history.distanceKm

### 0.4.0
* (Michael Fraessdorf) Optional live-tracking / LED / buzzer commands with enableCommands safety switch
* (Michael Fraessdorf) Fixed overview.charging for NOT_CHARGING string values
* (Michael Fraessdorf) Optimistic pending control state, admin control buttons, Vis-2 overview (shipped in 0.5.0)

### 0.3.0
* (Michael Fraessdorf) Activity/health overview, 24h history, live-tracking status, geofence JSON (read-only)

### 0.2.11
* (Michael Fraessdorf) Stabilization: null type hints, tolerant API sections, unit tests, redacted logs

### 0.2.10
* (Michael Fraessdorf) Trusted Publishing release with provenance; news limited to npm versions

Older entries: [`CHANGELOG_OLD.md`](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2026 Michael Fraessdorf

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
