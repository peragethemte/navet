#!/bin/sh
# Run the sidecar tests, bootstrapping the virtualenv on first use.
set -eu

cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
fi

exec .venv/bin/python -m unittest discover -s tests -t . -p 'test_*.py' "$@"
