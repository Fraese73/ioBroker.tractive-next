# ioBroker.tractive-next

Development version of a modern, unofficial Tractive GPS adapter for ioBroker.

## Features in 0.2.7

- Tractive account login
- Automatic token renewal
- One automatic retry after HTTP 401 or 403
- Tracker list
- Tracker details
- Hardware report
- Current position report
- OpenStreetMap link per tracker (`device_pos_report.osmMapUrl`)
- Admin sidebar tab with map cards per tracker
- Overview states (`…overview.*`) for name, position, battery, sensor and address
- Automatic ioBroker object creation
- Automatic data-type inference for new API fields
- Unix timestamp fields converted to milliseconds with role `value.time` for readable display
- `temperature_state` and future API fields no longer require a hard-coded definition
- Raw JSON state for diagnostics
- Pi update script (`UPDATE_ON_PI.sh`) for pull, install, build and restart
- Password stored encrypted via `encryptedNative` / `protectedNative`
- ESLint (`npm run lint`), package tests and GitHub Actions CI

## Important

Manufacturer website: [https://tractive.com/](https://tractive.com/)

Tractive does not provide a documented public consumer API for these trackers. This adapter uses the unofficial endpoint used by existing open-source integrations. Tractive can change it at any time.

## Publishing (ioBroker Latest / npm)

This project is not yet in the official ioBroker adapter repository.  
See the checklist in [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for everything still required before other users can install and update it normally via the Admin UI.

## Update on the Raspberry Pi

From the git clone on the Pi (not from `/opt/iobroker/...`):

```bash
cd ~/ioBroker.tractive-next
chmod +x UPDATE_ON_PI.sh
./UPDATE_ON_PI.sh
```

The script runs `git pull`, copies into `/opt/iobroker/node_modules/iobroker.tractive-next`, runs `npm install` + `npm run build`, uploads the admin UI and restarts `tractive-next.0`.

## Build on the Raspberry Pi

```bash
cd /opt/iobroker
npm install /path/to/ioBroker.tractive-next
cd node_modules/iobroker.tractive-next
npm install
npm run build
cd /opt/iobroker
iobroker upload tractive-next
iobroker add tractive-next
```

For a manual test installation from an extracted folder:

```bash
sudo mkdir -p /opt/iobroker/node_modules/iobroker.tractive-next
sudo cp -R ./* /opt/iobroker/node_modules/iobroker.tractive-next/
sudo chown -R iobroker:iobroker /opt/iobroker/node_modules/iobroker.tractive-next
cd /opt/iobroker/node_modules/iobroker.tractive-next
sudo -u iobroker npm install
sudo -u iobroker npm run build
cd /opt/iobroker
iobroker upload tractive-next
iobroker add tractive-next
```

Then open the instance configuration and enter the Tractive email address and password.

After updating to 0.2.2 or newer, open the instance settings once and save the password again so it is stored encrypted.

## Development status

This is an initial development build. Read-only API access is implemented. Live tracking, history, virtual fences, LED and sound commands are intentionally not yet enabled.
