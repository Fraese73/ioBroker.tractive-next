# ioBroker.tractive-next

Development version of a modern, unofficial Tractive GPS adapter for ioBroker.

## Features in 0.1.0

- Tractive account login
- Automatic token renewal
- One automatic retry after HTTP 401 or 403
- Tracker list
- Tracker details
- Hardware report
- Current position report
- Automatic ioBroker object creation
- Automatic data-type inference for new API fields
- `temperature_state` and future API fields no longer require a hard-coded definition
- Raw JSON state for diagnostics

## Important

Tractive does not provide a documented public consumer API for these trackers. This adapter uses the unofficial endpoint used by existing open-source integrations. Tractive can change it at any time.

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

## Development status

This is an initial development build. Read-only API access is implemented. Live tracking, history, virtual fences, LED and sound commands are intentionally not yet enabled.
