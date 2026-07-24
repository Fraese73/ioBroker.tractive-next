#!/usr/bin/env bash
set -euo pipefail

# Run on the Raspberry Pi from the git clone, e.g.:
#   cd ~/ioBroker.tractive-next && ./UPDATE_ON_PI.sh
#
# Optional overrides:
#   TARGET_DIR=/opt/iobroker/node_modules/iobroker.tractive-next
#   INSTANCE=tractive-next.0
#   IOBROKER_DIR=/opt/iobroker

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${TARGET_DIR:-/opt/iobroker/node_modules/iobroker.tractive-next}"
INSTANCE="${INSTANCE:-tractive-next.0}"
IOBROKER_DIR="${IOBROKER_DIR:-/opt/iobroker}"

cd "$SOURCE_DIR"

if [[ ! -d .git ]]; then
    echo "Fehler: ${SOURCE_DIR} ist kein Git-Repository." >&2
    echo "Bitte zuerst das Repo klonen und das Skript von dort aus starten." >&2
    exit 1
fi

echo "==> git pull in ${SOURCE_DIR}"
git pull

echo "==> Dateien nach ${TARGET_DIR} kopieren"
sudo mkdir -p "$TARGET_DIR"
if command -v rsync >/dev/null 2>&1; then
    sudo rsync -a --delete \
        --exclude '.git/' \
        --exclude 'node_modules/' \
        --exclude 'build/' \
        --exclude '.DS_Store' \
        --exclude '.cursor/' \
        "${SOURCE_DIR}/" "${TARGET_DIR}/"
else
    sudo find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules ! -name build -exec rm -rf {} +
    sudo cp -R "${SOURCE_DIR}/." "$TARGET_DIR"/
    sudo rm -rf "${TARGET_DIR}/.git" "${TARGET_DIR}/node_modules" "${TARGET_DIR}/build" "${TARGET_DIR}/.cursor"
fi

sudo chown -R iobroker:iobroker "$TARGET_DIR"

echo "==> npm install + build"
cd "$TARGET_DIR"
sudo -u iobroker npm install
sudo -u iobroker npm run build

echo "==> upload + restart ${INSTANCE}"
cd "$IOBROKER_DIR"
sudo -u iobroker iobroker upload tractive-next
sudo -u iobroker iobroker restart "$INSTANCE"

echo
echo "Update fertig: $(git -C "$SOURCE_DIR" log -1 --oneline)"
echo "Instanz ${INSTANCE} wurde neu gestartet."
