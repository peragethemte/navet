#!/bin/sh
# Run the sidecar locally for development.
# Credentials come from .env.local (gitignored) so they stay out of shell history.
set -eu

cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
fi

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8091}"
