#!/bin/sh
# Serve the sidecar over the Unix socket nginx's internal location proxies to.
set -eu

cd /etc/navet/integrations-sidecar

exec /opt/navet-sidecar/bin/python -m uvicorn app.main:app \
  --uds /run/navet/icloud-sidecar.sock \
  --log-level warning
