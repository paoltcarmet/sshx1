#!/bin/bash
set -euo pipefail

# Host keys
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then ssh-keygen -A; fi

: "${SSH_USER:=n4}"
: "${SSH_PASSWORD:=N4@ssh123}"
: "${SSH_PORT:=22}"
echo "${SSH_USER}:${SSH_PASSWORD}" | chpasswd || true

# Minimal sshd (localhost only)
cat >/etc/ssh/sshd_config <<EOF
Port ${SSH_PORT}
ListenAddress 127.0.0.1
PasswordAuthentication yes
UsePAM yes
PermitRootLogin no
X11Forwarding no
AllowUsers ${SSH_USER}
Subsystem sftp /usr/lib/openssh/sftp-server
EOF

mkdir -p /var/run/sshd
/usr/sbin/sshd -D -e -f /etc/ssh/sshd_config &
SSHD_PID=$!

# WS bridge (Node server listens on $PORT and serves /healthz=200)
: "${PORT:=8080}"
: "${WS_PATH:=/app53}"
: "${AUTH_KEY:=change-this-key}"
node /opt/wsproxy/ws-bridge.js &
BRIDGE_PID=$!

# If any child dies, exit (Cloud Run will restart)
wait -n $SSHD_PID $BRIDGE_PID
exit $?
