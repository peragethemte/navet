#!/bin/sh
set -eu

# Supervise the local services together. Docker / Supervisor owns restarts.
service_pids=
nginx_pid=
cleanup() {
  trap '' INT TERM
  if [ -n "$nginx_pid" ]; then kill -TERM "$nginx_pid" 2>/dev/null || true; fi
  for pid in $service_pids; do kill -TERM "$pid" 2>/dev/null || true; done
  if [ -n "$nginx_pid" ]; then wait "$nginx_pid" 2>/dev/null || true; fi
  for pid in $service_pids; do wait "$pid" 2>/dev/null || true; done
}
trap 'cleanup; exit 143' TERM
trap 'cleanup; exit 130' INT

# Block until a service has bound its socket, failing fast if it dies first.
wait_for_socket() {
  service_name=$1
  service_pid=$2
  socket_path=$3
  attempt=0
  while [ ! -S "$socket_path" ]; do
    if ! kill -0 "$service_pid" 2>/dev/null; then
      echo "Navet $service_name exited before readiness" >&2
      cleanup
      exit 1
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 100 ]; then
      echo "Navet $service_name did not become ready" >&2
      cleanup
      exit 1
    fi
    sleep 0.1
  done
}

mkdir -p /run/navet
chown nginx:nginx /run/navet
chmod 750 /run/navet

rm -f /run/navet/rss-transport.sock
su-exec nginx /etc/navet/rss-transport &
transport_pid=$!
service_pids="$transport_pid"
wait_for_socket 'RSS transport' "$transport_pid" /run/navet/rss-transport.sock

# Not every image ships the sidecar - the Home Assistant add-on reuses this script without it -
# so supervise it only where it is installed. Where it is, it starts whether or not an Apple ID
# is configured: unconfigured it simply reports that, which keeps the calendar provider quiet
# instead of retrying a dead socket.
if [ -x /etc/navet/integrations-sidecar/run-container.sh ]; then
  rm -f /run/navet/icloud-sidecar.sock
  su-exec nginx /etc/navet/integrations-sidecar/run-container.sh &
  sidecar_pid=$!
  service_pids="$service_pids $sidecar_pid"
  wait_for_socket 'iCloud sidecar' "$sidecar_pid" /run/navet/icloud-sidecar.sock
fi

"$@" &
nginx_pid=$!
set +e
# BusyBox ash wait -n can miss a child terminated by a signal. Observe every known PID
# directly; ash reaps exited children while the foreground sleep completes.
all_running() {
  for pid in $service_pids $nginx_pid; do
    kill -0 "$pid" 2>/dev/null || return 1
  done
  return 0
}
while all_running; do
  sleep 1
done
# Report the status of whichever service exited first.
status=1
for pid in $service_pids $nginx_pid; do
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid"
    status=$?
    break
  fi
done
cleanup
# An unsolicited clean service exit is still an incomplete runtime.
if [ "$status" -eq 0 ]; then status=1; fi
exit "$status"
