#!/usr/bin/env bash
set -euo pipefail

PI_HOST="${PI_HOST:-shpi5}"
PI_USER="${PI_USER:-pi}"
PI_TARGET="${PI_TARGET:-/home/pi/ioBroker.tractive-next}"

echo "Übertrage Projekt nach ${PI_USER}@${PI_HOST}:${PI_TARGET}"

ssh "${PI_USER}@${PI_HOST}" "mkdir -p '${PI_TARGET}'"

rsync -av --delete \
  --exclude node_modules \
  --exclude build \
  --exclude .git \
  ./ "${PI_USER}@${PI_HOST}:${PI_TARGET}/"

echo
echo "Übertragung abgeschlossen."
echo "Installation auf dem Pi:"
echo "  ssh ${PI_USER}@${PI_HOST}"
echo "  cd ${PI_TARGET}"
echo "  chmod +x INSTALL_ON_PI.sh"
echo "  ./INSTALL_ON_PI.sh"
