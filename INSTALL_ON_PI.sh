#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="/opt/iobroker/node_modules/iobroker.tractive-next"

sudo mkdir -p "$TARGET_DIR"
sudo cp -R "$SOURCE_DIR"/. "$TARGET_DIR"/
sudo chown -R iobroker:iobroker "$TARGET_DIR"

cd "$TARGET_DIR"
sudo -u iobroker npm install
sudo -u iobroker npm run build

cd /opt/iobroker
sudo -u iobroker iobroker upload tractive-next
sudo -u iobroker iobroker add tractive-next

echo "Installation completed. Configure tractive-next.0 in the ioBroker Admin UI."
